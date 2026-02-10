const pty = require('node-pty');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

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

async function handleTerminalConnection(ws, paneId) {
  console.log(`[Terminal] handleTerminalConnection called for paneId=${paneId}`);
  
  const sessionName = await getSessionForPane(paneId);
  if (!sessionName) {
    console.log(`[Terminal] Pane ${paneId} not found or no session`);
    ws.close(4003, `Pane ${paneId} not found`);
    return;
  }

  console.log(`[Terminal] Found session ${sessionName} for pane ${paneId}`);

  const ptyProcess = pty.spawn('tmux', ['attach', '-t', sessionName, ';', 'select-pane', '-t', paneId], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || '/tmp',
    env: process.env
  });

  console.log(`[Terminal] PTY spawned with tmux attach to session=${sessionName}, pane=${paneId}`);

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data, { binary: false, compress: false });
    }
  });

  ptyProcess.onExit((code) => {
    console.log(`[Terminal] PTY exited with code=${code?.exitCode}`);
    if (ws.readyState === ws.OPEN) {
      ws.close(1000, 'PTY exited');
    }
  });

  let lastMessage = '';
  let lastMessageTime = 0;

  ws.on('message', (message) => {
    const content = message.toString();
    
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {}
    
    // Filter xterm.js terminal protocol responses (NOT user input)
    // Focus: \x1b[I, \x1b[O | DA1: \x1b[?...c | DA2: \x1b[>...c | OSC: \x1b]...
    if (content === '\x1b[I' || content === '\x1b[O' ||
        (content.startsWith('\x1b[?') && content.endsWith('c')) ||
        (content.startsWith('\x1b[>') && content.endsWith('c')) ||
        content.startsWith('\x1b]')) {
      console.log(`[Terminal] Filtered control sequence from ${paneId}:`, JSON.stringify(content));
      return;
    }
    
    const charCodes = [...content].map(c => c.charCodeAt(0));
    console.log(`[Terminal] Input from ${paneId}:`, { content: JSON.stringify(content), charCodes, len: content.length });
    
    const now = Date.now();
    if (content === lastMessage && (now - lastMessageTime) < 30) {
      console.log(`[Terminal] Dropped duplicate from ${paneId}`);
      return;
    }
    lastMessage = content;
    lastMessageTime = now;
    
    ptyProcess.write(content);
  });

  ws.on('close', () => {
    console.log(`[Terminal] WebSocket closed for pane ${paneId}`);
    ptyProcess.kill();
  });

  ws.on('error', (err) => {
    console.log(`[Terminal] WebSocket error for pane ${paneId}: ${err.message}`);
    ptyProcess.kill();
  });
}

module.exports = { handleTerminalConnection };
