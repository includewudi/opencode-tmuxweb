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

router.get('/config', (req, res) => {
  try {
    const raw = runTmuxCommand('show-option -gv prefix');
    if (!raw) {
      return res.json({ code: '\x02', label: 'Ctrl+B', raw: 'C-b' });
    }
    const match = raw.match(/^C-(.+)$/i);
    if (match) {
      const key = match[1].toLowerCase();
      const ctrlCode = key.charCodeAt(0) - 96;
      return res.json({
        code: String.fromCharCode(ctrlCode),
        label: `Ctrl+${key.toUpperCase()}`,
        raw,
      });
    }
    res.json({ code: raw, label: raw, raw });
  } catch (err) {
    console.error('[tmux config]', err);
    res.json({ code: '\x02', label: 'Ctrl+B', raw: 'C-b' });
  }
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

// GET /api/tmux/pane-mode?paneId=%XX
// Returns { alternate_on, mouse_any_flag } for deciding scroll strategy
router.get('/pane-mode', (req, res) => {
  const { paneId } = req.query;
  if (!paneId) {
    return res.status(400).json({ error: 'missing_paneId', message: 'paneId is required' });
  }
  try {
    const raw = runTmuxCommand(
      `display-message -t "${paneId}" -p "#{alternate_on} #{mouse_any_flag}"`
    );
    if (raw === null) {
      return res.status(404).json({ error: 'pane_not_found', message: `Pane ${paneId} not found` });
    }
    const parts = raw.split(' ');
    res.json({
      alternate_on: parts[0] === '1',
      mouse_any_flag: parts[1] === '1',
    });
  } catch (err) {
    console.error('[tmux pane-mode]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

const config = require('../config-loader');
const os = require('os');

// GET /api/tmux/quick-dirs - 返回配置的常用目录列表
router.get('/quick-dirs', (req, res) => {
  const dirs = (config.quickDirs || []).map(d => ({
    name: d.name,
    path: d.path.replace(/^~/, os.homedir()),
  }));
  res.json({ dirs });
});

// POST /api/tmux/new-session
// body: { name?, dir? }
router.post('/new-session', (req, res) => {
  const { name, dir } = req.body;

  let cmd = 'new-session -d'; // -d: detached (don't attach)

  if (name && typeof name === 'string') {
    const sanitizedName = name.replace(/['"\\]/g, '').slice(0, 60);
    cmd += ` -s "${sanitizedName}"`;
  }

  if (dir && typeof dir === 'string') {
    const resolvedDir = dir.replace(/^~/, os.homedir()).replace(/['"\\]/g, '');
    cmd += ` -c "${resolvedDir}"`;
  }

  try {
    runTmuxCommand(cmd);
    // Return the new session name
    const nameOut = name
      ? name.replace(/['"\\]/g, '').slice(0, 60)
      : runTmuxCommand('display-message -p "#{session_name}"');
    return res.json({ success: true, sessionName: nameOut });
  } catch (err) {
    res.status(500).json({ error: 'tmux_error', message: err.message });
  }
});

// POST /api/tmux/new-window
// body: { session, dir? }  — dir 为可选工作目录（绝对路径）
router.post('/new-window', (req, res) => {
  const { session, dir, name } = req.body;
  if (!session || typeof session !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'session is required' });
  }

  const sanitizedSession = session.replace(/['"\\]/g, '');
  let cmd = `new-window -t "${sanitizedSession}"`;

  if (name && typeof name === 'string') {
    const sanitizedName = name.replace(/['"\\]/g, '').slice(0, 60);
    cmd += ` -n "${sanitizedName}"`;
  }

  if (dir && typeof dir === 'string') {
    const resolvedDir = dir.replace(/^~/, os.homedir()).replace(/['"\\]/g, '');
    cmd += ` -c "${resolvedDir}"`;
  }

  try {
    runTmuxCommand(cmd);
    const newWinOut = runTmuxCommand(`display-message -t "${sanitizedSession}" -p "#{window_index}:#{window_name}:#{pane_id}"`);
    if (newWinOut) {
      const [windowIndex, windowName, paneId] = newWinOut.split(':');
      return res.json({ success: true, windowIndex: parseInt(windowIndex, 10), windowName, paneId });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'tmux_error', message: err.message });
  }
});

module.exports = router;
