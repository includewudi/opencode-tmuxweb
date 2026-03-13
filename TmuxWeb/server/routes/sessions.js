const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

router.put('/:sessionName/group', async (req, res) => {
  const { token } = req;
  const { sessionName } = req.params;
  const { profile_key, group_id } = req.body;

  if (!profile_key) {
    return res.status(400).json({ error: 'profile_key required' });
  }

  const normalizedGroupId = group_id === null || group_id === undefined ? 0 : group_id;
  const now = Math.floor(Date.now() / 1000);

  try {
    await pool.query(
      `INSERT INTO tmux_session_meta (token, profile_key, session_name, group_id, ctime, mtime)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE group_id = VALUES(group_id), mtime = VALUES(mtime)`,
      [token, profile_key, sessionName, normalizedGroupId, now, now]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/sessions/:sessionName/group]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
