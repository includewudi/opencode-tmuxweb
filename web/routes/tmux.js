const express = require('express');
const { execSync } = require('child_process');

const router = express.Router();

function runTmuxCommand(cmd) {
  try {
    return execSync(`tmux ${cmd}`, { encoding: 'utf-8' }).trim();
  } catch (err) {
    return null;
  }
}

function parseTmuxList(output, delimiter = ':') {
  if (!output) return [];
  return output.split('\n').filter(Boolean).map(line => {
    const parts = line.split(delimiter);
    return parts;
  });
}

router.get('/tree', (req, res) => {
  const sessionsOutput = runTmuxCommand('list-sessions -F "#{session_name}:#{session_id}"');
  if (!sessionsOutput) {
    return res.json({ sessions: [], error: 'No tmux sessions found' });
  }

  const sessions = [];
  const sessionLines = parseTmuxList(sessionsOutput);

  for (const [sessionName, sessionId] of sessionLines) {
    const windowsOutput = runTmuxCommand(
      `list-windows -t "${sessionName}" -F "#{window_index}:#{window_name}:#{window_id}"`
    );
    const windows = [];

    if (windowsOutput) {
      const windowLines = parseTmuxList(windowsOutput);
      for (const [windowIndex, windowName, windowId] of windowLines) {
        const panesOutput = runTmuxCommand(
          `list-panes -t "${sessionName}:${windowIndex}" -F "#{pane_id}:#{pane_title}:#{pane_current_command}"`
        );
        const panes = [];

        if (panesOutput) {
          const paneLines = parseTmuxList(panesOutput);
          for (const [paneId, paneTitle, paneCommand] of paneLines) {
            panes.push({ paneId, paneTitle, paneCommand });
          }
        }

        windows.push({ windowIndex: parseInt(windowIndex, 10), windowName, windowId, panes });
      }
    }

    sessions.push({ sessionName, sessionId, windows });
  }

  res.json({ sessions });
});

router.put('/windows/:sessionName/:windowIndex/rename', (req, res) => {
  const { sessionName, windowIndex } = req.params;
  const { name } = req.body;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'name is required' });
  }
  
  const sanitizedName = name.replace(/["'\\]/g, '');
  const target = `${sessionName}:${windowIndex}`;
  
  try {
    execSync(`tmux rename-window -t "${target}" "${sanitizedName}"`, { encoding: 'utf-8' });
    res.json({ success: true, name: sanitizedName });
  } catch (err) {
    res.status(500).json({ error: 'tmux_error', message: err.message });
  }
});

module.exports = router;
