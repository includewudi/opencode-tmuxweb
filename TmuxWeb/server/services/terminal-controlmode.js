/**
 * Terminal handler using tmux control mode (-C).
 * Drop-in replacement for terminal.js with same interface:
 *   exports { handleTerminalConnection, getStats }
 *
 * Instead of spawning one PTY per pane, uses a single TmuxControlMode
 * controller that multiplexes all pane I/O through tmux's control protocol.
 * PTY consumption: O(1) instead of O(N panes).
 */

const { getController } = require('./tmux-control');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ── Connection tracking ─────────────────────────────────────────────
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

// Map<paneId, { clients: Set<ws>, unsubscribe: Function|null, createdAt: number }>
const activePanes = new Map();
const allConnections = new Set();

// Output coalescing buffer: Map<paneId, { chunks: Buffer[], timer: NodeJS.Timeout }>
const outputBuffers = new Map();
const COALESCE_MS = 16; // ~60fps, coalesce rapid %output events

// ── Controller singleton (lazy init) ────────────────────────────────
let controller = null;
let controllerStarted = false;

async function ensureController() {
  if (!controller) {
    controller = getController();
  }
  if (!controllerStarted) {
    controllerStarted = true;
    await controller.start();
  }
  return controller;
}

function getStats() {
  const panes = [];
  for (const [paneId, entry] of activePanes) {
    panes.push({
      paneId,
      clients: entry.clients.size,
      createdAt: entry.createdAt,
    });
  }
  return {
    mode: 'controlmode',
    totalPanes: activePanes.size,
    controllerRunning: controller?.isRunning || false,
    controllerPid: controller?.ptyProcess?.pid || null,
    totalWsConnections: allConnections.size,
    totalPTYs: controller?.isRunning ? 1 : 0, // Always 0 or 1
    panes,
  };
}

// ── Heartbeat: detect zombie WS connections ─────────────────────────
const heartbeatTimer = setInterval(() => {
  for (const ws of allConnections) {
    if (ws._isAlive === false) {
      console.log('[TermCM] Heartbeat timeout, terminating zombie WS');
      ws.terminate();
      continue;
    }
    ws._isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);
heartbeatTimer.unref();

// ── Output coalescing ───────────────────────────────────────────────
// Buffers rapid %output events and flushes to WS clients at ~60fps
function broadcastToClients(paneId, data) {
  const entry = activePanes.get(paneId);
  if (!entry || entry.clients.size === 0) return;

  let buf = outputBuffers.get(paneId);
  if (!buf) {
    buf = { chunks: [], timer: null };
    outputBuffers.set(paneId, buf);
  }

  buf.chunks.push(Buffer.from(data, 'utf8'));

  if (!buf.timer) {
    buf.timer = setTimeout(() => {
      flushOutputBuffer(paneId);
    }, COALESCE_MS);
  }
}

function flushOutputBuffer(paneId) {
  const buf = outputBuffers.get(paneId);
  if (!buf || buf.chunks.length === 0) return;

  const combined = Buffer.concat(buf.chunks);
  buf.chunks = [];
  buf.timer = null;

  const entry = activePanes.get(paneId);
  if (!entry) return;

  for (const client of entry.clients) {
    if (client.readyState === client.OPEN) {
      client.send(combined, { binary: true, compress: false });
    }
  }
}

// ── Input translation: raw xterm bytes → tmux send-keys ─────────────
// xterm.js sends raw terminal bytes. We must translate them to tmux commands.

// Map of single-byte control chars → tmux key names
const CTRL_KEY_MAP = {
  '\x01': 'C-a', '\x02': 'C-b', '\x03': 'C-c', '\x04': 'C-d',
  '\x05': 'C-e', '\x06': 'C-f', '\x07': 'C-g', '\x08': 'BSpace',
  '\x09': 'Tab',  '\x0a': 'Enter', '\x0b': 'C-k', '\x0c': 'C-l',
  '\x0d': 'Enter', '\x0e': 'C-n', '\x0f': 'C-o', '\x10': 'C-p',
  '\x11': 'C-q', '\x12': 'C-r', '\x13': 'C-s', '\x14': 'C-t',
  '\x15': 'C-u', '\x16': 'C-v', '\x17': 'C-w', '\x18': 'C-x',
  '\x19': 'C-y', '\x1a': 'C-z',
  '\x7f': 'BSpace',
};

// Map of escape sequences → tmux key names
const ESC_SEQ_MAP = {
  '\x1b[A': 'Up',    '\x1b[B': 'Down',
  '\x1b[C': 'Right', '\x1b[D': 'Left',
  '\x1b[H': 'Home',  '\x1b[F': 'End',
  '\x1b[2~': 'IC',   '\x1b[3~': 'DC',
  '\x1b[5~': 'PPage', '\x1b[6~': 'NPage',
  '\x1b[1;5A': 'C-Up',   '\x1b[1;5B': 'C-Down',
  '\x1b[1;5C': 'C-Right', '\x1b[1;5D': 'C-Left',
  '\x1bOP': 'F1',  '\x1bOQ': 'F2',  '\x1bOR': 'F3',  '\x1bOS': 'F4',
  '\x1b[15~': 'F5',  '\x1b[17~': 'F6',  '\x1b[18~': 'F7',  '\x1b[19~': 'F8',
  '\x1b[20~': 'F9',  '\x1b[21~': 'F10', '\x1b[23~': 'F11', '\x1b[24~': 'F12',
  '\x1b': 'Escape',
};

/**
 * Translate raw xterm input into tmux send-keys calls.
 * Strategy:
 *  - Single control char → send-keys <keyname>
 *  - Known escape sequence → send-keys <keyname>
 *  - Printable text → send-keys -l "text" (literal)
 *  - Mixed → split and handle each segment
 */
function translateInput(ctrl, paneId, rawInput) {
  let i = 0;
  let literalBuf = '';

  function flushLiteral() {
    if (literalBuf.length > 0) {
      ctrl.sendKeys(paneId, literalBuf);
      literalBuf = '';
    }
  }

  while (i < rawInput.length) {
    const ch = rawInput[i];
    const charCode = rawInput.charCodeAt(i);

    // Check escape sequences first (multi-byte)
    if (ch === '\x1b' && i + 1 < rawInput.length) {
      // Try matching longest escape sequence first
      let matched = false;
      // Try up to 7 chars (longest sequence we handle)
      for (let len = 7; len >= 2; len--) {
        const seq = rawInput.substring(i, i + len);
        if (ESC_SEQ_MAP[seq]) {
          flushLiteral();
          ctrl.sendKeyRaw(paneId, ESC_SEQ_MAP[seq]);
          i += len;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // Bare ESC (no recognized sequence follows)
      if (i + 1 >= rawInput.length || ESC_SEQ_MAP['\x1b']) {
        flushLiteral();
        ctrl.sendKeyRaw(paneId, 'Escape');
        i++;
        continue;
      }
    }

    // Single-byte control chars
    if (CTRL_KEY_MAP[ch]) {
      flushLiteral();
      ctrl.sendKeyRaw(paneId, CTRL_KEY_MAP[ch]);
      i++;
      continue;
    }

    // Printable character → accumulate for literal send
    if (charCode >= 0x20 && charCode !== 0x7f) {
      literalBuf += ch;
      i++;
      continue;
    }

    // Unknown control char → skip
    i++;
  }

  flushLiteral();
}

// ── Helpers ─────────────────────────────────────────────────────────
function removeClient(ws, paneId) {
  allConnections.delete(ws);

  const entry = activePanes.get(paneId);
  if (entry) {
    entry.clients.delete(ws);
    console.log(`[TermCM] Client removed from pane ${paneId}. Remaining: ${entry.clients.size}`);

    // If no clients left, unsubscribe from controller output
    if (entry.clients.size === 0) {
      if (entry.unsubscribe) {
        entry.unsubscribe();
        entry.unsubscribe = null;
      }
      // Clean up output buffer
      const buf = outputBuffers.get(paneId);
      if (buf) {
        if (buf.timer) clearTimeout(buf.timer);
        outputBuffers.delete(paneId);
      }
      activePanes.delete(paneId);
      console.log(`[TermCM] Pane ${paneId} fully cleaned up. Active: ${activePanes.size}`);
    }
  }
}

// ── Main handler ────────────────────────────────────────────────────
async function handleTerminalConnection(ws, paneId, clientId) {
  console.log(`[TermCM] handleTerminalConnection paneId=${paneId} clientId=${clientId ?? 'none'} (active panes: ${activePanes.size})`);

  // ── Heartbeat setup ──
  ws._isAlive = true;
  ws._clientId = clientId || null;
  ws.on('pong', () => { ws._isAlive = true; });
  allConnections.add(ws);

  // ── Ensure controller is running ──
  let ctrl;
  try {
    ctrl = await ensureController();
  } catch (err) {
    console.error(`[TermCM] Controller start failed: ${err.message}`);
    allConnections.delete(ws);
    ws.close(4005, 'Controller start failed');
    return;
  }

  if (!ctrl.isRunning) {
    console.log(`[TermCM] Controller not running yet, waiting...`);
    // Give it a moment to connect
    await new Promise(r => setTimeout(r, 2000));
    if (!ctrl.isRunning) {
      console.error(`[TermCM] Controller still not running after wait`);
      allConnections.delete(ws);
      ws.close(4005, 'Controller not ready');
      return;
    }
  }

  // ── Verify pane exists ──
  const sessionName = await ctrl.getSessionForPane(paneId);
  if (!sessionName) {
    console.log(`[TermCM] Pane ${paneId} not found or no session`);
    allConnections.delete(ws);
    ws.close(4003, `Pane ${paneId} not found`);
    return;
  }

  // ── Reuse or create pane entry ──
  let entry = activePanes.get(paneId);

  if (entry) {
    // Evict stale WS with same clientId (prevent ghost/double connections)
    if (clientId) {
      for (const oldWs of entry.clients) {
        if (oldWs._clientId === clientId && oldWs !== ws) {
          console.log(`[TermCM] Evicting stale WS for pane ${paneId} (clientId=${clientId})`);
          oldWs._isAlive = false;
          try { oldWs.terminate(); } catch {}
          entry.clients.delete(oldWs);
          allConnections.delete(oldWs);
        }
      }
    }
    console.log(`[TermCM] Reusing pane entry for ${paneId} (existing clients: ${entry.clients.size})`);
    entry.clients.add(ws);
  } else {
    // New pane subscription
    entry = {
      clients: new Set([ws]),
      unsubscribe: null,
      createdAt: Date.now(),
      sessionName,
    };
    activePanes.set(paneId, entry);

    // Subscribe to pane output from controller
    entry.unsubscribe = ctrl.subscribePaneOutput(paneId, (data) => {
      broadcastToClients(paneId, data);
    });

    console.log(`[TermCM] Subscribed to pane ${paneId}. Active panes: ${activePanes.size}`);
  }

  // ── Send initial snapshot (capture current pane content) ──
  try {
    const snapshot = await ctrl.capturePaneContent(paneId);
    if (snapshot && ws.readyState === ws.OPEN) {
      ws.send(Buffer.from(snapshot, 'utf8'), { binary: true, compress: false });
    }
  } catch (err) {
    console.log(`[TermCM] Snapshot failed for ${paneId}: ${err.message}`);
  }

  // ── WS → Controller (input) ──
  let lastMessage = '';
  let lastMessageTime = 0;
  let firstResizeDone = false;

  // Fallback resize after 1.5s if no resize message received
  const sigwinchFallback = setTimeout(() => {
    if (!firstResizeDone) {
      // Trigger a resize to force tmux to redraw
      ctrl.resizePane(paneId, 81, 24);
      ctrl.resizePane(paneId, 80, 24);
    }
  }, 1500);

  ws.on('message', (message) => {
    const content = message.toString();

    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ctrl.resizePane(paneId, parsed.cols, parsed.rows);
        if (!firstResizeDone) {
          firstResizeDone = true;
          clearTimeout(sigwinchFallback);
          // Also resize the tmux window to match
          setTimeout(() => {
            execAsync(
              `tmux resize-window -t "${paneId}" -A`,
              { timeout: 1000 }
            ).catch(() => {});
          }, 200);
        }
        return;
      }
      if (parsed.type === 'fit-window' && parsed.cols && parsed.rows) {
        ctrl.resizePane(paneId, parsed.cols, parsed.rows);
        if (sessionName) {
          execAsync(
            `tmux resize-window -t "${sessionName}" -x ${parsed.cols} -y ${parsed.rows}`,
            { timeout: 3000 }
          ).then(() => console.log(`[TermCM] fit-window: resized ${sessionName} to ${parsed.cols}x${parsed.rows}`))
           .catch(err => console.log(`[TermCM] fit-window error: ${err.message}`));
        }
        return;
      }
    } catch {}

    // Filter xterm.js terminal protocol responses (NOT user input)
    if (content === '\x1b[I' || content === '\x1b[O' ||
      (content.startsWith('\x1b[?') && content.endsWith('c')) ||
      (content.startsWith('\x1b[>') && content.endsWith('c')) ||
      content.startsWith('\x1b]')) {
      return;
    }

    // Dedup rapid identical messages
    const now = Date.now();
    if (content === lastMessage && (now - lastMessageTime) < 30) {
      return;
    }
    lastMessage = content;
    lastMessageTime = now;

    // Translate raw xterm input → tmux send-keys
    translateInput(ctrl, paneId, content);
  });

  // ── WS close / error → remove client ──
  ws.on('close', () => {
    console.log(`[TermCM] WS closed for pane ${paneId}`);
    clearTimeout(sigwinchFallback);
    removeClient(ws, paneId);
  });

  ws.on('error', (err) => {
    console.log(`[TermCM] WS error for pane ${paneId}: ${err.message}`);
    clearTimeout(sigwinchFallback);
    removeClient(ws, paneId);
  });
}

// ── Graceful shutdown ───────────────────────────────────────────────
function shutdownAll(signal) {
  console.log(`[TermCM] ${signal} received. Cleaning up...`);
  for (const [paneId, entry] of activePanes) {
    if (entry.unsubscribe) entry.unsubscribe();
    for (const client of entry.clients) {
      try { client.terminate(); } catch {}
    }
  }
  activePanes.clear();
  allConnections.clear();
  for (const [, buf] of outputBuffers) {
    if (buf.timer) clearTimeout(buf.timer);
  }
  outputBuffers.clear();
  clearInterval(heartbeatTimer);
  if (controller) {
    controller.shutdown();
    controller = null;
    controllerStarted = false;
  }
  console.log('[TermCM] Shutdown complete');
}

process.on('SIGTERM', () => { shutdownAll('SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { shutdownAll('SIGINT'); process.exit(0); });
process.on('exit', () => { shutdownAll('exit'); });

module.exports = { handleTerminalConnection, getStats };
