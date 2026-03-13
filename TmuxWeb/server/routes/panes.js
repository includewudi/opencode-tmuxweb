const express = require('express');
const { pool } = require('../db/pool');
const { parsePaneKey } = require('../utils');

const router = express.Router();

const VALID_STATUSES = ['idle', 'in_progress', 'done', 'failed', 'waiting'];


/**
 * GET /api/panes/status
 * Query params:
 *   - paneKey (single): "sessionName:windowIndex:paneIndex"
 *   - paneKeys (multiple): comma-separated list
 *   - profile_key: required
 */
router.get('/status', async (req, res) => {
  try {
    const { paneKey, paneKeys, profile_key } = req.query;
    const token = req.token;

    if (!profile_key) {
      return res.status(400).json({ error: 'missing_profile_key', message: 'profile_key is required' });
    }

    let keys = [];
    if (paneKey) {
      keys.push(paneKey);
    }
    if (paneKeys) {
      keys = keys.concat(paneKeys.split(',').map(k => k.trim()).filter(Boolean));
    }

    if (keys.length === 0) {
      return res.status(400).json({ error: 'missing_pane_key', message: 'paneKey or paneKeys is required' });
    }

    const sessionMap = new Map();
    for (const key of keys) {
      const parsed = parsePaneKey(key);
      if (parsed) {
        if (!sessionMap.has(parsed.sessionName)) {
          sessionMap.set(parsed.sessionName, []);
        }
        sessionMap.get(parsed.sessionName).push(key);
      }
    }

    const sessionNames = Array.from(sessionMap.keys());
    if (sessionNames.length === 0) {
      return res.json({ panes: keys.map(k => ({ paneKey: k, status: 'idle', mtime: null })) });
    }

    const placeholders = sessionNames.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT session_name, extra, mtime FROM tmux_session_meta 
       WHERE token = ? AND profile_key = ? AND session_name IN (${placeholders})`,
      [token, profile_key, ...sessionNames]
    );

    const sessionDataMap = new Map();
    for (const row of rows) {
      let extra = {};
      try {
        extra = row.extra ? JSON.parse(row.extra) : {};
      } catch (e) {
        extra = {};
      }
      sessionDataMap.set(row.session_name, { extra, mtime: row.mtime });
    }

    const panes = keys.map(key => {
      const parsed = parsePaneKey(key);
      if (!parsed) {
        return { paneKey: key, status: 'idle', mtime: null };
      }

      const sessionData = sessionDataMap.get(parsed.sessionName);
      if (!sessionData) {
        return { paneKey: key, status: 'idle', mtime: null };
      }

      const paneStatusKey = `${parsed.windowIndex}:${parsed.paneIndex}`;
      const paneStatuses = sessionData.extra.panes || {};
      const status = paneStatuses[paneStatusKey] || 'idle';
      const mtime = sessionData.mtime ? sessionData.mtime * 1000 : null;

      return { paneKey: key, status, mtime };
    });

    res.json({ panes });
  } catch (err) {
    console.error('[panes/status GET]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

/**
 * PUT /api/panes/status
 * Body:
 *   - profile_key: string
 *   - paneKey: string "sessionName:windowIndex:paneIndex"
 *   - status: "idle" | "in_progress" | "done"
 */
router.put('/status', async (req, res) => {
  try {
    const { profile_key, paneKey, status } = req.body;
    const token = req.token;

    if (!profile_key) {
      return res.status(400).json({ error: 'missing_profile_key', message: 'profile_key is required' });
    }

    if (!paneKey) {
      return res.status(400).json({ error: 'missing_pane_key', message: 'paneKey is required' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'invalid_status', message: 'Status must be idle, in_progress, done, failed, or waiting' });
    }

    const parsed = parsePaneKey(paneKey);
    if (!parsed) {
      return res.status(400).json({ error: 'invalid_pane_key', message: 'Invalid paneKey format' });
    }

    const now = Math.floor(Date.now() / 1000);
    const paneStatusKey = `${parsed.windowIndex}:${parsed.paneIndex}`;

    const [existingRows] = await pool.query(
      `SELECT id, extra FROM tmux_session_meta 
       WHERE token = ? AND profile_key = ? AND session_name = ?`,
      [token, profile_key, parsed.sessionName]
    );

    if (existingRows.length > 0) {
      let extra = {};
      try {
        extra = existingRows[0].extra ? JSON.parse(existingRows[0].extra) : {};
      } catch (e) {
        extra = {};
      }

      if (!extra.panes) extra.panes = {};
      extra.panes[paneStatusKey] = status;

      await pool.query(
        `UPDATE tmux_session_meta SET extra = ?, mtime = ? WHERE id = ?`,
        [JSON.stringify(extra), now, existingRows[0].id]
      );
    } else {
      const extra = { panes: { [paneStatusKey]: status } };
      await pool.query(
        `INSERT INTO tmux_session_meta (token, profile_key, session_name, extra, ctime, mtime)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [token, profile_key, parsed.sessionName, JSON.stringify(extra), now, now]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[panes/status PUT]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = router;
