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


// POST /api/tmux/sessions/:name/rebuild
// Capture session's windows + pane directories, kill, and recreate
router.post('/sessions/:name/rebuild', async (req, res) => {
  const { name } = req.params;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'session name is required' });
  }

  const sanitizedName = name.replace(/['"\\`]/g, '').slice(0, 60);

  // 1. Verify session exists
  const sessionsOut = runTmuxCommand('list-sessions -F "#{session_name}"');
  if (!sessionsOut || !sessionsOut.split('\n').includes(sanitizedName)) {
    return res.status(404).json({ error: 'not_found', message: `Session '${sanitizedName}' not found` });
  }

  try {
    // 2. Capture windows and their pane directories
    const windowsOut = runTmuxCommand(`list-windows -t "${sanitizedName}" -F "#{window_index}:#{window_name}"`);
    if (!windowsOut) {
      return res.status(500).json({ error: 'tmux_error', message: 'Failed to list windows' });
    }

    const windows = windowsOut.split('\n').filter(Boolean).map(line => {
      const colonIdx = line.indexOf(':');
      const windowIndex = line.substring(0, colonIdx);
      const windowName = line.substring(colonIdx + 1);
      // Get panes for this window — capture directories
      const panesOut = runTmuxCommand(`list-panes -t "${sanitizedName}:${windowIndex}" -F "#{pane_index}:#{pane_current_path}"`);
      const panes = (panesOut || '').split('\n').filter(Boolean).map(pl => {
        const colonIdx = pl.indexOf(':');
        return {
          paneIndex: pl.substring(0, colonIdx),
          currentPath: pl.substring(colonIdx + 1),
        };
      });
      return {
        windowIndex: parseInt(windowIndex, 10),
        windowName,
        panes,
      };
    });

    // 3. Kill the session
    runTmuxCommand(`kill-session -t "${sanitizedName}"`);

    // 4. Small delay to let tmux clean up
    await new Promise(resolve => setTimeout(resolve, 200));

    // 5. Recreate: first window from new-session
    const firstWindow = windows[0];
    const firstDir = (firstWindow && firstWindow.panes[0]) ? firstWindow.panes[0].currentPath : os.homedir();
    const sanitizedDir = firstDir.replace(/['"\\`]/g, '');
    runTmuxCommand(`new-session -d -s "${sanitizedName}" -c "${sanitizedDir}"`);

    // Rename first window
    if (firstWindow && firstWindow.windowName) {
      const sanitizedWinName = firstWindow.windowName.replace(/['"\\`]/g, '').slice(0, 60);
      runTmuxCommand(`rename-window -t "${sanitizedName}:0" "${sanitizedWinName}"`);
    }

    // 6. Create additional windows
    for (let i = 1; i < windows.length; i++) {
      const w = windows[i];
      const dir = (w.panes[0]) ? w.panes[0].currentPath : os.homedir();
      const safeDirW = dir.replace(/['"\\`]/g, '');
      const safeWinName = (w.windowName || '').replace(/['"\\`]/g, '').slice(0, 60);
      let newWinCmd = `new-window -t "${sanitizedName}"`;
      if (safeWinName) newWinCmd += ` -n "${safeWinName}"`;
      newWinCmd += ` -c "${safeDirW}"`;
      runTmuxCommand(newWinCmd);
    }

    res.json({
      success: true,
      sessionName: sanitizedName,
      windows: windows.map(w => ({
        windowIndex: w.windowIndex,
        windowName: w.windowName,
        directory: w.panes[0] ? w.panes[0].currentPath : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'tmux_error', message: err.message });
  }
});
module.exports = router;
