const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

router.post('/:segmentId/conversation', async (req, res) => {
  const { segmentId } = req.params;
  const { role, content } = req.body;

  if (!role || !content) {
    return res.status(400).json({ error: 'role and content required' });
  }

  if (role !== 'user' && role !== 'assistant') {
    return res.status(400).json({ error: 'role must be "user" or "assistant"' });
  }

  const now = new Date();
  const year = now.getFullYear();
  const mon = now.getMonth() + 1;
  const timestamp = Math.floor(Date.now() / 1000);

  try {
    const [result] = await pool.query(
      `INSERT INTO tmux_chat_message (year, mon, segment_id, role, content, msg_time, ctime, mtime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [year, mon, segmentId, role, content, timestamp, timestamp, timestamp]
    );

    res.json({
      id: result.insertId,
      segment_id: parseInt(segmentId, 10),
      role,
      content,
      msg_time: timestamp
    });
  } catch (err) {
    console.error('[POST /api/segments/:segmentId/conversation]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/:segmentId/commands', async (req, res) => {
  const { segmentId } = req.params;
  const { command, exit_code } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'command required' });
  }

  const now = new Date();
  const year = now.getFullYear();
  const mon = now.getMonth() + 1;
  const timestamp = Math.floor(Date.now() / 1000);
  const exitCode = exit_code !== undefined ? exit_code : 0;

  try {
    const [result] = await pool.query(
      `INSERT INTO tmux_command_record (year, mon, segment_id, command, cmd_time, exit_code, ctime, mtime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [year, mon, segmentId, command, timestamp, exitCode, timestamp, timestamp]
    );

    res.json({
      id: result.insertId,
      segment_id: parseInt(segmentId, 10),
      command,
      cmd_time: timestamp,
      exit_code: exitCode
    });
  } catch (err) {
    console.error('[POST /api/segments/:segmentId/commands]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:segmentId/logs', async (req, res) => {
  const { segmentId } = req.params;
  const { type = 'all' } = req.query;

  try {
    let conversation = [];
    let commands = [];

    if (type === 'all' || type === 'conversation') {
      const [rows] = await pool.query(
        `SELECT id, role, content, msg_time
         FROM tmux_chat_message
         WHERE segment_id = ? AND is_deleted = 0
         ORDER BY msg_time ASC`,
        [segmentId]
      );
      conversation = rows;
    }

    if (type === 'all' || type === 'commands') {
      const [rows] = await pool.query(
        `SELECT id, command, cmd_time, exit_code
         FROM tmux_command_record
         WHERE segment_id = ? AND is_deleted = 0
         ORDER BY cmd_time ASC`,
        [segmentId]
      );
      commands = rows;
    }

    res.json({ conversation, commands });
  } catch (err) {
    console.error('[GET /api/segments/:segmentId/logs]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
