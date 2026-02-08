const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res) => {
  const { token } = req;
  const { profile_key } = req.query;

  if (!profile_key) {
    return res.status(400).json({ error: 'profile_key query param required' });
  }

  try {
    const [groups] = await pool.query(
      `SELECT 
        g.id, 
        g.group_name, 
        g.sort_order, 
        g.ctime,
        COUNT(m.id) as session_count
      FROM tmux_session_group g
      LEFT JOIN tmux_session_meta m ON m.group_id = g.id AND m.token = g.token AND m.profile_key = g.profile_key
      WHERE g.token = ? AND g.profile_key = ? AND g.is_deleted = 0
      GROUP BY g.id
      ORDER BY g.sort_order ASC, g.id ASC`,
      [token, profile_key]
    );

    res.json({ groups });
  } catch (err) {
    console.error('[GET /api/groups]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  const { token } = req;
  const { profile_key, group_name, sort_order = 0 } = req.body;

  if (!profile_key || !group_name) {
    return res.status(400).json({ error: 'profile_key and group_name required' });
  }

  const now = Math.floor(Date.now() / 1000);

  try {
    const [result] = await pool.query(
      `INSERT INTO tmux_session_group (token, profile_key, group_name, sort_order, ctime, mtime)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [token, profile_key, group_name, sort_order, now, now]
    );

    res.json({
      id: result.insertId,
      group_name,
      sort_order,
      ctime: now,
      mtime: now
    });
  } catch (err) {
    console.error('[POST /api/groups]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id', async (req, res) => {
  const { token } = req;
  const { id } = req.params;
  const { group_name, sort_order } = req.body;

  if (group_name === undefined && sort_order === undefined) {
    return res.status(400).json({ error: 'At least one of group_name or sort_order required' });
  }

  const now = Math.floor(Date.now() / 1000);
  const updates = [];
  const values = [];

  if (group_name !== undefined) {
    updates.push('group_name = ?');
    values.push(group_name);
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    values.push(sort_order);
  }
  updates.push('mtime = ?');
  values.push(now);

  values.push(id, token);

  try {
    const [result] = await pool.query(
      `UPDATE tmux_session_group SET ${updates.join(', ')} WHERE id = ? AND token = ? AND is_deleted = 0`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const [rows] = await pool.query(
      `SELECT id, group_name, sort_order, ctime, mtime FROM tmux_session_group WHERE id = ?`,
      [id]
    );

    res.json({ success: true, group: rows[0] });
  } catch (err) {
    console.error('[PUT /api/groups/:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { token } = req;
  const { id } = req.params;

  const now = Math.floor(Date.now() / 1000);

  try {
    const [result] = await pool.query(
      `UPDATE tmux_session_group SET is_deleted = 1, mtime = ? WHERE id = ? AND token = ? AND is_deleted = 0`,
      [now, id, token]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await pool.query(
      `UPDATE tmux_session_meta SET group_id = 0 WHERE group_id = ? AND token = ?`,
      [id, token]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/groups/:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
