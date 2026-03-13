const pty = require('node-pty');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const isDev = process.env.NODE_ENV !== 'production';

// ── PTY Connection Manager ──────────────────────────────────────────
const MAX_PTYS = 20;
const HEARTBEAT_INTERVAL = 30000; // 30s ping interval
const HEARTBEAT_TIMEOUT = 10000;  // 10s pong timeout

// Map<paneId, { ptyProcess, clients: Set<ws>, createdAt }>
const activePTYs = new Map();

// ── Spawn Circuit Breaker ────────────────────────────────────────────
// Map<paneId, { failures: number, circuitOpenUntil: number }>
const spawnCircuitBreaker = new Map();
const CIRCUIT_MAX_FAILURES = 5;
const CIRCUIT_OPEN_DURATION = 60000; // 60s cooldown after 5 consecutive failures

// Track all WS connections for heartbeat
const allConnections = new Set();

function getStats() {
  const panes = [];
  for (const [paneId, entry] of activePTYs) {
    panes.push({
      paneId,
      clients: entry.clients.size,
      createdAt: entry.createdAt,
    });
  }
  return {
    totalPTYs: activePTYs.size,
    maxPTYs: MAX_PTYS,
    totalWsConnections: allConnections.size,
    panes,
  };
}

// ── Heartbeat: detect zombie WS connections ─────────────────────────
const heartbeatTimer = setInterval(() => {
  for (const ws of allConnections) {
    if (ws._isAlive === false) {
      console.log('[Terminal] Heartbeat timeout, terminating zombie WS');
      ws.terminate();
      continue;
    }
    ws._isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

// Don't keep process alive just for heartbeat
heartbeatTimer.unref();

// ── Helpers ─────────────────────────────────────────────────────────
async function getSessionForPane(paneId) {
  try {
    const { stdout } = await execAsync(
      `tmux display-message -t "${paneId}" -p "#{session_name}"`,
      { timeout: 2000 }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function cleanupPTY(paneId) {
  const entry = activePTYs.get(paneId);
  if (!entry) return;

  // Only kill PTY if no clients remain
  if (entry.clients.size === 0) {
    console.log(`[Terminal] No clients left for pane ${paneId}, killing PTY`);
    try {
      entry.ptyProcess.kill();
    } catch (err) {
      console.log(`[Terminal] PTY kill error for ${paneId}: ${err.message}`);
    }
    activePTYs.delete(paneId);
    console.log(`[Terminal] PTY removed. Active: ${activePTYs.size}/${MAX_PTYS}`);
  }
}

function removeClient(ws, paneId) {
  allConnections.delete(ws);

  const entry = activePTYs.get(paneId);
  if (entry) {
    entry.clients.delete(ws);
    console.log(`[Terminal] Client removed from pane ${paneId}. Remaining: ${entry.clients.size}`);
    cleanupPTY(paneId);
  }
}

// ── Main handler ────────────────────────────────────────────────────
async function handleTerminalConnection(ws, paneId, clientId) {
  console.log(`[Terminal] handleTerminalConnection paneId=${paneId} clientId=${clientId ?? 'none'} (active: ${activePTYs.size}/${MAX_PTYS})`);

  // ── Heartbeat setup ──
  ws._isAlive = true;
  ws._clientId = clientId || null;
  ws.on('pong', () => { ws._isAlive = true; });
  allConnections.add(ws);

  // ── Check PTY limit ──
  if (!activePTYs.has(paneId) && activePTYs.size >= MAX_PTYS) {
    console.log(`[Terminal] PTY limit reached (${MAX_PTYS}). Rejecting pane ${paneId}`);
    allConnections.delete(ws);
    ws.close(4004, 'PTY limit reached');
    return;
  }

  // ── Reuse existing PTY or spawn new one ──
  let entry = activePTYs.get(paneId);

  // Dead PTY check: if the stored process has exited, remove it
  if (entry && entry.ptyProcess.killed) {
    console.log(`[Terminal] Dead PTY detected for pane ${paneId}, removing`);
    activePTYs.delete(paneId);
    entry = null;
  }

  if (entry) {
    // 驱逐同 clientId 的旧 WS，防止双重广播（重影）
    if (clientId) {
      for (const oldWs of entry.clients) {
        if (oldWs._clientId === clientId && oldWs !== ws) {
          console.log(`[Terminal] Evicting stale WS for pane ${paneId} (clientId=${clientId})`);
          oldWs._isAlive = false;
          try { oldWs.terminate(); } catch { }
          entry.clients.delete(oldWs);
          allConnections.delete(oldWs);
        }
      }
    }
    // Reuse: attach this WS to existing PTY
    console.log(`[Terminal] Reusing PTY for pane ${paneId} (existing clients: ${entry.clients.size})`);
    entry.clients.add(ws);
  } else {
    // ── Circuit breaker check ──
    const breaker = spawnCircuitBreaker.get(paneId);
    if (breaker && Date.now() < breaker.circuitOpenUntil) {
      const remainSec = Math.ceil((breaker.circuitOpenUntil - Date.now()) / 1000);
      console.log(`[Terminal] Circuit OPEN for pane ${paneId} (${breaker.failures} failures). Retry in ${remainSec}s`);
      allConnections.delete(ws);
      ws.close(4006, `Spawn circuit open, retry in ${remainSec}s`);
      return;
    }
    // Reset if cooldown expired
    if (breaker && Date.now() >= breaker.circuitOpenUntil) {
      spawnCircuitBreaker.delete(paneId);
    }

    // Spawn new PTY
    const sessionName = await getSessionForPane(paneId);
    if (!sessionName) {
      console.log(`[Terminal] Pane ${paneId} not found or no session`);
      allConnections.delete(ws);
      ws.close(4003, `Pane ${paneId} not found`);
      return;
    }

    console.log(`[Terminal] Spawning new PTY for session=${sessionName}, pane=${paneId}`);

    let ptyProcess;
    try {
      // Use shell -c so we can chain commands: attach then select the right pane
      ptyProcess = pty.spawn('/bin/sh', ['-c',
        `tmux set-option -t "${sessionName}" window-size latest \\; attach-session -t "${sessionName}" \\; select-pane -t "${paneId}"`
      ], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || '/tmp',
        env: process.env,
        encoding: null,
      });
    } catch (err) {
      console.error(`[Terminal] pty.spawn FAILED for pane ${paneId}: ${err.message}`);
      // ── Circuit breaker: record failure ──
      const cb = spawnCircuitBreaker.get(paneId) || { failures: 0, circuitOpenUntil: 0 };
      cb.failures++;
      if (cb.failures >= CIRCUIT_MAX_FAILURES) {
        cb.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION;
        console.error(`[Terminal] Circuit OPEN for pane ${paneId}: ${cb.failures} consecutive failures. Blocking for 60s.`);
      }
      spawnCircuitBreaker.set(paneId, cb);
      allConnections.delete(ws);
      ws.close(4005, 'PTY spawn failed');
      return;
    }
    // Spawn succeeded — reset circuit breaker
    spawnCircuitBreaker.delete(paneId);

    entry = {
      ptyProcess,
      clients: new Set([ws]),
      createdAt: Date.now(),
      sessionName,
    };
    activePTYs.set(paneId, entry);
    console.log(`[Terminal] PTY spawned. Active: ${activePTYs.size}/${MAX_PTYS}`);

    // ── PTY → all WS clients (broadcast) ──
    ptyProcess.onData((data) => {
      for (const client of entry.clients) {
        if (client.readyState === client.OPEN) {
          client.send(data, { binary: true, compress: false });
        }
      }
    });

    ptyProcess.onExit((code) => {
      console.log(`[Terminal] PTY exited for pane ${paneId}, code=${code?.exitCode}`);
      // Close all clients when PTY exits
      for (const client of entry.clients) {
        if (client.readyState === client.OPEN) {
          client.close(1000, 'PTY exited');
        }
      }
      entry.clients.clear();
      activePTYs.delete(paneId);
      console.log(`[Terminal] PTY cleaned up. Active: ${activePTYs.size}/${MAX_PTYS}`);
    });
  }

  const { ptyProcess } = entry;

  // ── WS → PTY (input) ──
  let lastMessage = ''
  let lastMessageTime = 0
  let firstResizeDone = false  // 首次 resize 后触发一次 SIGWINCH 重绘

  // 兜底：1.5s 后如果还没收到 resize，用当前 PTY 尺寸触发一次
  const sigwinchFallback = setTimeout(() => {
    if (!firstResizeDone) {
      try {
        const c = ptyProcess.cols || 80, r = ptyProcess.rows || 24;
        ptyProcess.resize(c + 1, r); ptyProcess.resize(c, r);
      } catch { }
    }
  }, 1500);

  ws.on('message', (message) => {
    const content = message.toString();

    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        // Only resize if dimensions actually changed—avoids unnecessary SIGWINCH/redraws
        if (parsed.cols !== ptyProcess.cols || parsed.rows !== ptyProcess.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
        }
        if (!firstResizeDone) {
          firstResizeDone = true;
          clearTimeout(sigwinchFallback);
          setTimeout(async () => {
            try {
              // 扩展 tmux window 到当前最大 client 尺寸（解决旧 window 保留小尺寸的问题）
              await execAsync(
                `tmux resize-window -t "${paneId}" -A`,
                { timeout: 1000 }
              ).catch(() => { });
              // 查 pane 真实宽高后做一次干净的 resize（不用 cols±1 trick 避免多余重绘）
              const { stdout } = await execAsync(
                `tmux display-message -t "${paneId}" -p "#{pane_width} #{pane_height}"`,
                { timeout: 1000 }
              );
              const parts = stdout.trim().split(' ');
              const actualCols = parseInt(parts[0], 10) || ptyProcess.cols;
              const actualRows = parseInt(parts[1], 10) || ptyProcess.rows;
              if (actualCols !== ptyProcess.cols || actualRows !== ptyProcess.rows) {
                ptyProcess.resize(actualCols, actualRows);
              }
            } catch {
              // no-op, PTY already at correct size
            }
          }, 200);
        }
        return;
      }
      if (parsed.type === 'fit-window' && parsed.cols && parsed.rows) {
        const sess = entry.sessionName;
        if (sess) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          execAsync(`tmux resize-window -t "${sess}" -x ${parsed.cols} -y ${parsed.rows}`, { timeout: 3000 })
            .then(() => console.log(`[Terminal] fit-window: resized ${sess} to ${parsed.cols}x${parsed.rows}`))
            .catch(err => console.log(`[Terminal] fit-window error: ${err.message}`));
        }
        return;
      }
    } catch { }

    // Filter xterm.js terminal protocol responses (NOT user input)
    if (content === '\x1b[I' || content === '\x1b[O' ||
      (content.startsWith('\x1b[?') && content.endsWith('c')) ||
      (content.startsWith('\x1b[>') && content.endsWith('c')) ||
      content.startsWith('\x1b]')) {
      if (isDev) {
        console.log(`[Terminal] Filtered control sequence from ${paneId}:`, JSON.stringify(content));
      }
      return;
    }

    if (isDev) {
      const charCodes = [...content].map(c => c.charCodeAt(0));
      console.log(`[Terminal] Input from ${paneId}:`, { content: JSON.stringify(content), charCodes, len: content.length });
    }

    const now = Date.now();
    if (content === lastMessage && (now - lastMessageTime) < 30) {
      if (isDev) {
        console.log(`[Terminal] Dropped duplicate from ${paneId}`);
      }
      return;
    }
    lastMessage = content;
    lastMessageTime = now;

    ptyProcess.write(content);
  });

  // ── WS close / error → remove client ──
  ws.on('close', () => {
    console.log(`[Terminal] WS closed for pane ${paneId}`);
    removeClient(ws, paneId);
  });

  ws.on('error', (err) => {
    console.log(`[Terminal] WS error for pane ${paneId}: ${err.message}`);
    removeClient(ws, paneId);
  });
}

// ── Graceful Shutdown: kill all PTYs on process exit ─────────────────
function shutdownAllPTYs(signal) {
  console.log(`[Terminal] ${signal} received. Cleaning up ${activePTYs.size} PTYs...`);
  for (const [paneId, entry] of activePTYs) {
    try {
      entry.ptyProcess.kill();
      console.log(`[Terminal] Killed PTY for pane ${paneId}`);
    } catch (err) {
      console.log(`[Terminal] Failed to kill PTY ${paneId}: ${err.message}`);
    }
    // Close all WS clients
    for (const client of entry.clients) {
      try { client.terminate(); } catch {}
    }
  }
  activePTYs.clear();
  allConnections.clear();
  clearInterval(heartbeatTimer);
  console.log('[Terminal] All PTYs cleaned up');
}

process.on('SIGTERM', () => { shutdownAllPTYs('SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { shutdownAllPTYs('SIGINT'); process.exit(0); });
process.on('exit', () => { shutdownAllPTYs('exit'); });

// ── Startup: kill orphaned tmux attach-session processes ─────────────
async function cleanupOrphanedPTYs() {
  try {
    // Find tmux attach-session processes spawned by previous server instances
    // that are now orphaned (parent PID = 1 on Linux, or parent is launchd/init)
    const { stdout } = await execAsync(
      'pgrep -f "tmux attach-session" | xargs -r ps -o pid,ppid,command -p 2>/dev/null || true',
      { timeout: 5000 }
    );
    if (stdout.trim()) {
      console.log('[Terminal] Found potential orphaned tmux attach processes:');
      console.log(stdout.trim());
    }

    // Kill orphaned attach-session processes whose parent is NOT a running node server
    // Use a safer approach: kill only those with PPID=1 (truly orphaned)
    const { stdout: orphans } = await execAsync(
      'pgrep -f "tmux attach-session" | while read pid; do ppid=$(ps -o ppid= -p $pid 2>/dev/null | tr -d " "); if [ "$ppid" = "1" ]; then echo $pid; fi; done',
      { timeout: 5000 }
    );
    const orphanPids = orphans.trim().split('\n').filter(Boolean);
    if (orphanPids.length > 0) {
      console.log(`[Terminal] Killing ${orphanPids.length} orphaned tmux attach-session processes: ${orphanPids.join(', ')}`);
      await execAsync(`kill ${orphanPids.join(' ')}`, { timeout: 5000 }).catch(() => {});
    } else {
      console.log('[Terminal] No orphaned tmux attach-session processes found');
    }
  } catch (err) {
    console.log(`[Terminal] Orphan cleanup check failed (non-fatal): ${err.message}`);
  }
}

// Run cleanup on module load
cleanupOrphanedPTYs();

module.exports = { handleTerminalConnection, getStats };
