const express = require('express');
const { pool, dbEnabled } = require('../db/pool');

const router = express.Router();

async function ensureProfilesTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tmux_profile (
      id int(11) unsigned NOT NULL AUTO_INCREMENT,
      token varchar(128) NOT NULL DEFAULT '',
      profile_key varchar(64) NOT NULL DEFAULT '',
      name varchar(128) NOT NULL DEFAULT '',
      sort_order int(11) NOT NULL DEFAULT 0,
      ctime int(11) NOT NULL DEFAULT 0,
      mtime int(11) NOT NULL DEFAULT 0,
      status tinyint(4) NOT NULL DEFAULT 1,
      is_deleted tinyint(4) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uk_token_profile (token, profile_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户 Profile 表'
  `);
}

if (dbEnabled) {
  ensureProfilesTable().catch(err => {
    console.error('[Profiles] Failed to ensure table:', err.message);
  });
}

// GET /api/profiles - List all profiles for current user
router.get('/', async (req, res) => {
  try {
    const token = req.token;
    const [rows] = await pool.query(
      `SELECT id, profile_key, name, sort_order, ctime, mtime 
       FROM tmux_profile 
       WHERE token = ? AND is_deleted = 0 
       ORDER BY sort_order ASC, id ASC`,
      [token]
    );
    res.json({ profiles: rows });
  } catch (err) {
    console.error('[Profiles] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// POST /api/profiles - Create new profile
router.post('/', async (req, res) => {
  try {
    const token = req.token;
    const { profile_key, name = '' } = req.body;

    if (!profile_key) {
      return res.status(400).json({ error: 'profile_key is required' });
    }

    const now = Math.floor(Date.now() / 1000);
    const [result] = await pool.query(
      `INSERT INTO tmux_profile (token, profile_key, name, ctime, mtime)
       VALUES (?, ?, ?, ?, ?)`,
      [token, profile_key, name, now, now]
    );

    const [rows] = await pool.query(
      `SELECT id, profile_key, name, sort_order, ctime, mtime 
       FROM tmux_profile WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Profile key already exists' });
    }
    console.error('[Profiles] POST / error:', err.message);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// PUT /api/profiles/:id - Update profile
router.put('/:id', async (req, res) => {
  try {
    const token = req.token;
    const { id } = req.params;
    const { name, sort_order } = req.body;

    const [existing] = await pool.query(
      `SELECT id FROM tmux_profile WHERE id = ? AND token = ? AND is_deleted = 0`,
      [id, token]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('mtime = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    await pool.query(
      `UPDATE tmux_profile SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [rows] = await pool.query(
      `SELECT id, profile_key, name, sort_order, ctime, mtime 
       FROM tmux_profile WHERE id = ?`,
      [id]
    );

    res.json({ success: true, profile: rows[0] });
  } catch (err) {
    console.error('[Profiles] PUT /:id error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// DELETE /api/profiles/:id - Soft delete profile
router.delete('/:id', async (req, res) => {
  try {
    const token = req.token;
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE tmux_profile SET is_deleted = 1, mtime = ? 
       WHERE id = ? AND token = ? AND is_deleted = 0`,
      [Math.floor(Date.now() / 1000), id, token]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Profiles] DELETE /:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// GET /api/profiles/:id/order - Get session/group ordering for profile
router.get('/:id/order', async (req, res) => {
  try {
    const token = req.token;
    const { id } = req.params;

    const [profile] = await pool.query(
      `SELECT id, profile_key FROM tmux_profile 
       WHERE id = ? AND token = ? AND is_deleted = 0`,
      [id, token]
    );

    if (profile.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileKey = profile[0].profile_key;

    const [groups] = await pool.query(
      `SELECT id, group_name, sort_order 
       FROM tmux_session_group 
       WHERE token = ? AND profile_key = ? AND is_deleted = 0
       ORDER BY sort_order ASC, id ASC`,
      [token, profileKey]
    );

    const [sessions] = await pool.query(
      `SELECT session_name, group_id, sort_order 
       FROM tmux_session_meta 
       WHERE token = ? AND profile_key = ?
       ORDER BY sort_order ASC`,
      [token, profileKey]
    );

    const groupMap = new Map();
    for (const g of groups) {
      groupMap.set(g.id, { ...g, sessions: [] });
    }

    const ungrouped = [];
    for (const s of sessions) {
      if (s.group_id && groupMap.has(s.group_id)) {
        groupMap.get(s.group_id).sessions.push({
          session_name: s.session_name,
          sort_order: s.sort_order
        });
      } else {
        ungrouped.push({
          session_name: s.session_name,
          sort_order: s.sort_order
        });
      }
    }

    res.json({
      groups: Array.from(groupMap.values()),
      ungrouped
    });
  } catch (err) {
    console.error('[Profiles] GET /:id/order error:', err.message);
    res.status(500).json({ error: 'Failed to fetch ordering' });
  }
});

// PUT /api/profiles/:id/order - Save new ordering
router.put('/:id/order', async (req, res) => {
  try {
    const token = req.token;
    const { id } = req.params;
    const { groups = [], sessions = [] } = req.body;

    const [profile] = await pool.query(
      `SELECT id, profile_key FROM tmux_profile 
       WHERE id = ? AND token = ? AND is_deleted = 0`,
      [id, token]
    );

    if (profile.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileKey = profile[0].profile_key;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const g of groups) {
        await connection.query(
          `UPDATE tmux_session_group 
           SET sort_order = ? 
           WHERE id = ? AND token = ? AND profile_key = ?`,
          [g.sort_order, g.id, token, profileKey]
        );
      }

      const now = Math.floor(Date.now() / 1000);
      for (const s of sessions) {
        await connection.query(
          `INSERT INTO tmux_session_meta (token, profile_key, session_name, group_id, sort_order, ctime, mtime)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE group_id = VALUES(group_id), sort_order = VALUES(sort_order), mtime = VALUES(mtime)`,
          [token, profileKey, s.session_name, s.group_id || 0, s.sort_order || 0, now, now]
        );
      }

      await connection.commit();
      res.json({ success: true });
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('[Profiles] PUT /:id/order error:', err.message);
    res.status(500).json({ error: 'Failed to save ordering' });
  }
});

module.exports = router;
