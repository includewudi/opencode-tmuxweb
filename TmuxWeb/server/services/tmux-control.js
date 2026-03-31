/**
 * TmuxControlMode — Single-PTY tmux controller
 * 
 * Replaces per-pane PTY spawning with a single tmux control mode (-C) connection.
 * Reduces PTY consumption from O(panes) to O(1).
 * 
 * Protocol: tmux -C attach sends structured events:
 *   %output %<paneId> <escaped-data>   — pane output
 *   %begin <time> <id> <flags>         — command response start
 *   %end <time> <id> <flags>           — command response end
 *   %error <time> <id> <flags>         — command error
 *   %session-changed ...               — session switch
 *   %exit [reason]                     — controller exited
 */

const pty = require('node-pty');
const { exec } = require('child_process');
const { promisify } = require('util');
const { EventEmitter } = require('events');

const execAsync = promisify(exec);

// ── Unescape tmux control mode output ────────────────────────────────
// tmux escapes: \ooo (octal), \\ (backslash), \r, \n, \t
function unescapeTmuxOutput(str) {
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1];
      if (next >= '0' && next <= '7') {
        // Octal: \ooo (1-3 digits)
        let octal = '';
        let j = i + 1;
        while (j < str.length && j < i + 4 && str[j] >= '0' && str[j] <= '7') {
          octal += str[j];
          j++;
        }
        result += String.fromCharCode(parseInt(octal, 8));
        i = j;
      } else if (next === '\\') {
        result += '\\';
        i += 2;
      } else if (next === 'n') {
        result += '\n';
        i += 2;
      } else if (next === 'r') {
        result += '\r';
        i += 2;
      } else if (next === 't') {
        result += '\t';
        i += 2;
      } else {
        // Unknown escape, pass through
        result += str[i];
        i++;
      }
    } else {
      result += str[i];
      i++;
    }
  }
  return result;
}

// ── Escape string for tmux send-keys ──────────────────────────────────
// Certain characters need special handling in send-keys
function escapeForSendKeys(input) {
  // For raw byte input, use send-keys -l (literal) which handles most chars
  // But we need to escape ; and \ for tmux command parsing
  return input.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/"/g, '\\"');
}

class TmuxControlMode extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ptyProcess = null;
    this.isRunning = false;
    this.reconnectTimer = null;
    this.reconnectDelay = options.reconnectDelay || 2000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.currentReconnectDelay = this.reconnectDelay;
    this.tmuxSocket = options.tmuxSocket || null; // -L socket name
    
    // %begin/%end response tracking
    // Map<commandId, { resolve, reject, output: string[] }>
    this.pendingCommands = new Map();
    this.commandCounter = 0;
    
    // Pane subscribers: Map<paneId, Set<callback>>
    this.paneSubscribers = new Map();
    
    // Line buffer for control mode parsing
    this._lineBuffer = '';
    this._currentBeginId = null;
    this._currentOutput = [];
  }

  // ── Start the control mode controller ──────────────────────────────
  async start() {
    if (this.isRunning) return;
    
    // Find a session to attach to (any session works, we see all panes)
    let targetSession;
    try {
      const socketArgs = this.tmuxSocket ? `-L ${this.tmuxSocket}` : '';
      const { stdout } = await execAsync(
        `tmux ${socketArgs} list-sessions -F "#{session_name}" 2>/dev/null | head -1`,
        { timeout: 3000 }
      );
      targetSession = stdout.trim();
    } catch {
      // No sessions exist yet — that's ok, we'll retry
    }

    if (!targetSession) {
      console.log('[TmuxControl] No tmux sessions found, will retry...');
      this._scheduleReconnect();
      return;
    }

    const socketArgs = this.tmuxSocket ? ['-L', this.tmuxSocket] : [];
    const args = ['-C', '-u', ...socketArgs, 'attach-session', '-t', targetSession, '-r'];
    
    console.log(`[TmuxControl] Starting control mode: tmux ${args.join(' ')}`);
    
    try {
      this.ptyProcess = pty.spawn('tmux', args, {
        name: 'xterm-256color',
        cols: 200,
        rows: 50,
        cwd: process.env.HOME || '/tmp',
        env: process.env,
        encoding: 'utf8',
      });
    } catch (err) {
      console.error(`[TmuxControl] Failed to spawn controller: ${err.message}`);
      this._scheduleReconnect();
      return;
    }

    this.isRunning = true;
    this.currentReconnectDelay = this.reconnectDelay; // Reset on success
    console.log(`[TmuxControl] Controller started (PID: ${this.ptyProcess.pid})`);

    this.ptyProcess.onData((data) => {
      this._parseLine(data);
    });

    this.ptyProcess.onExit((code) => {
      console.log(`[TmuxControl] Controller exited (code: ${code?.exitCode})`);
      this.isRunning = false;
      this.ptyProcess = null;
      
      // Reject pending commands
      for (const [id, pending] of this.pendingCommands) {
        pending.reject(new Error('Controller exited'));
      }
      this.pendingCommands.clear();
      
      this.emit('disconnected');
      this._scheduleReconnect();
    });

    this.emit('connected');
  }

  // ── Parse control mode protocol ────────────────────────────────────
  _parseLine(data) {
    this._lineBuffer += data;
    
    let newlineIdx;
    while ((newlineIdx = this._lineBuffer.indexOf('\n')) !== -1) {
      const line = this._lineBuffer.substring(0, newlineIdx);
      this._lineBuffer = this._lineBuffer.substring(newlineIdx + 1);
      this._handleLine(line);
    }
  }

  _handleLine(line) {
    // %output %<paneId> <data>
    if (line.startsWith('%output ')) {
      const spaceAfterPane = line.indexOf(' ', 8);
      if (spaceAfterPane === -1) return;
      const paneId = line.substring(8, spaceAfterPane);
      const rawData = line.substring(spaceAfterPane + 1);
      const data = unescapeTmuxOutput(rawData);
      
      this._broadcastToPane(paneId, data);
      return;
    }

    // %begin <time> <id> <flags>
    if (line.startsWith('%begin ')) {
      const parts = line.split(' ');
      if (parts.length >= 3) {
        this._currentBeginId = parts[2]; // command number
        this._currentOutput = [];
      }
      return;
    }

    // %end <time> <id> <flags>
    if (line.startsWith('%end ')) {
      const parts = line.split(' ');
      if (parts.length >= 3) {
        const cmdId = parts[2];
        const pending = this.pendingCommands.get(cmdId);
        if (pending) {
          pending.resolve(this._currentOutput.join('\n'));
          this.pendingCommands.delete(cmdId);
        }
        this._currentBeginId = null;
        this._currentOutput = [];
      }
      return;
    }

    // %error <time> <id> <flags>
    if (line.startsWith('%error ')) {
      const parts = line.split(' ');
      if (parts.length >= 3) {
        const cmdId = parts[2];
        const pending = this.pendingCommands.get(cmdId);
        if (pending) {
          pending.reject(new Error(this._currentOutput.join('\n') || 'tmux command error'));
          this.pendingCommands.delete(cmdId);
        }
        this._currentBeginId = null;
        this._currentOutput = [];
      }
      return;
    }

    // %session-changed, %window-add, etc. — ignore for now
    if (line.startsWith('%')) {
      return;
    }

    // Regular output line (part of a %begin/%end response)
    if (this._currentBeginId !== null) {
      this._currentOutput.push(line);
    }
  }

  // ── Broadcast output to pane subscribers ───────────────────────────
  _broadcastToPane(paneId, data) {
    const subscribers = this.paneSubscribers.get(paneId);
    if (!subscribers || subscribers.size === 0) return;
    
    for (const callback of subscribers) {
      try {
        callback(data);
      } catch (err) {
        console.error(`[TmuxControl] Subscriber error for pane ${paneId}: ${err.message}`);
      }
    }
  }

  // ── Send a command to the controller ───────────────────────────────
  sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.isRunning || !this.ptyProcess) {
        return reject(new Error('Controller not running'));
      }
      
      // tmux control mode assigns sequential command IDs
      // We track them via %begin/%end
      this.commandCounter++;
      const cmdId = String(this.commandCounter);
      
      this.pendingCommands.set(cmdId, { resolve, reject, output: [] });
      
      // Send command + newline
      this.ptyProcess.write(command + '\n');
      
      // Timeout: clean up if no response in 10s
      setTimeout(() => {
        if (this.pendingCommands.has(cmdId)) {
          this.pendingCommands.delete(cmdId);
          reject(new Error(`Command timeout: ${command}`));
        }
      }, 10000);
    });
  }

  // ── Fire-and-forget command (no response tracking) ─────────────────
  sendCommandRaw(command) {
    if (!this.isRunning || !this.ptyProcess) return;
    this.ptyProcess.write(command + '\n');
  }

  // ── Subscribe to pane output ───────────────────────────────────────
  subscribePaneOutput(paneId, callback) {
    if (!this.paneSubscribers.has(paneId)) {
      this.paneSubscribers.set(paneId, new Set());
    }
    this.paneSubscribers.get(paneId).add(callback);
    
    return () => {
      const subs = this.paneSubscribers.get(paneId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.paneSubscribers.delete(paneId);
        }
      }
    };
  }

  // ── Send keystrokes to a pane ──────────────────────────────────────
  sendKeys(paneId, keys) {
    // Use send-keys -l for literal text (handles most special chars)
    // For control sequences (Ctrl+C, etc.), caller should use send-keys without -l
    const escaped = escapeForSendKeys(keys);
    this.sendCommandRaw(`send-keys -t "${paneId}" -l "${escaped}"`);
  }

  // ── Send raw key names (Enter, C-c, etc.) ──────────────────────────
  sendKeyRaw(paneId, keyName) {
    this.sendCommandRaw(`send-keys -t "${paneId}" ${keyName}`);
  }

  // ── Resize a pane ──────────────────────────────────────────────────
  resizePane(paneId, cols, rows) {
    // Use resize-pane for specific pane sizing
    this.sendCommandRaw(`resize-pane -t "${paneId}" -x ${cols} -y ${rows}`);
  }

  // ── Capture current pane content (for initial snapshot) ────────────
  async capturePaneContent(paneId) {
    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -t "${paneId}" -p -e`,
        { timeout: 3000 }
      );
      return stdout;
    } catch (err) {
      console.error(`[TmuxControl] capture-pane failed for ${paneId}: ${err.message}`);
      return '';
    }
  }

  // ── Get session name for a pane ────────────────────────────────────
  async getSessionForPane(paneId) {
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

  // ── Reconnect logic ────────────────────────────────────────────────
  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    console.log(`[TmuxControl] Reconnecting in ${this.currentReconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, this.currentReconnectDelay);
    
    // Exponential backoff
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * 2,
      this.maxReconnectDelay
    );
  }

  // ── Shutdown ───────────────────────────────────────────────────────
  shutdown() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch {}
      this.ptyProcess = null;
    }
    this.isRunning = false;
    this.paneSubscribers.clear();
    this.pendingCommands.clear();
    console.log('[TmuxControl] Shutdown complete');
  }
}

// Singleton
let instance = null;

function getController(options) {
  if (!instance) {
    instance = new TmuxControlMode(options);
  }
  return instance;
}

module.exports = { TmuxControlMode, getController, unescapeTmuxOutput };
