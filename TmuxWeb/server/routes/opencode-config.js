const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const router = express.Router();

const CONFIG_FILES = ['opencode.json', 'oh-my-opencode.json'];
const GLOBAL_CONFIG_DIR = path.join(require('os').homedir(), '.config', 'opencode');

/**
 * Try to resolve the project directory from the active tmux pane's cwd.
 * Falls back to null if tmux is not available or pane not found.
 */
function getTmuxPaneCwd(paneKey) {
  if (!paneKey) return null;
  try {
    // paneKey format: "session/window/paneId" e.g. "main/0/%5"
    const parts = paneKey.split('/');
    const paneId = parts[parts.length - 1];
    const cwd = execSync(`tmux display-message -p -t '${paneId}' '#{pane_current_path}'`, {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    return cwd || null;
  } catch {
    return null;
  }
}

/**
 * Read a config file, return { content, path } or { error, path }.
 */
function readConfig(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return { content: JSON.parse(raw), path: filePath };
    }
    return { content: null, path: filePath, missing: true };
  } catch (err) {
    return { content: null, path: filePath, error: err.message };
  }
}

/**
 * GET /api/opencode-config
 * Query: ?paneKey=session/window/paneId (optional, to resolve project cwd)
 */
router.get('/', async (req, res) => {
  try {
    const { paneKey } = req.query;
    const paneCwd = getTmuxPaneCwd(paneKey);

    const result = {};

    for (const fileName of CONFIG_FILES) {
      const key = fileName.replace('.json', '').replace(/-/g, '_');
      // camelCase: opencode, oh_my_opencode
      let found = null;

      // 1. Try project directory (tmux pane cwd)
      if (paneCwd) {
        const projectPath = path.join(paneCwd, fileName);
        const r = readConfig(projectPath);
        if (r.content) found = r;
      }

      // 2. Fallback to global config dir
      if (!found) {
        const globalPath = path.join(GLOBAL_CONFIG_DIR, fileName);
        found = readConfig(globalPath);
      }

      result[key] = found;
    }

    res.json(result);
  } catch (err) {
    console.error('[GET /api/opencode-config]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = router;
