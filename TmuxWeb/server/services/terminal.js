const pty = require('node-pty');
const { execSync } = require('child_process');

function paneExists(paneId) {
  try {
    execSync(`tmux list-panes -a -F "#{pane_id}" | grep -q "^${paneId}$"`, { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

function getSessionForPane(paneId) {
  try {
    // Get the session name that contains this pane
    const result = execSync(
      `tmux display-message -t "${paneId}" -p "#{session_name}"`,
      { encoding: 'utf-8' }
    );
    return result.trim();
  } catch {
    return null;
  }
}

function handleTerminalConnection(ws, paneId) {
  if (!paneExists(paneId)) {
    ws.close(4003, `Pane ${paneId} not found`);
    return;
  }

  const sessionName = getSessionForPane(paneId);
  if (!sessionName) {
    ws.close(4004, `Could not find session for pane ${paneId}`);
    return;
  }

  const shell = process.env.SHELL || '/bin/zsh';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || '/tmp',
    env: process.env
  });

  const tmuxCmd = `exec tmux attach -t "${sessionName}" \\; select-pane -t "${paneId}"\r`;
  ptyProcess.write(tmuxCmd);

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  ptyProcess.onExit(() => {
    if (ws.readyState === ws.OPEN) {
      ws.close(1000, 'PTY exited');
    }
  });

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {}
    ptyProcess.write(message.toString());
  });

  ws.on('close', () => {
    ptyProcess.kill();
  });

  ws.on('error', () => {
    ptyProcess.kill();
  });
}

module.exports = { handleTerminalConnection };
