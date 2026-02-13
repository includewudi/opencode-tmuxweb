const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

router.post('/', async (req, res) => {
  const { event, conversation_id, pane_key, user_message, content, assistant_message, timestamp } = req.body;

  if (!event || !conversation_id) {
    return res.status(400).json({ error: 'missing required fields: event, conversation_id' });
  }

  const now = Math.floor(Date.now() / 1000);
  const eventTime = timestamp || now;
  const date = new Date(eventTime * 1000);
  const year = date.getFullYear();
  const mon = date.getMonth() + 1;

  try {
    if (event === 'task_started') {
      if (!pane_key) {
        return res.status(400).json({ error: 'task_started requires pane_key' });
      }

      await pool.query(
        `INSERT INTO ai_conversation 
         (conversation_id, pane_key, user_message, conv_status, started_at, year, mon, ctime, mtime)
         VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           user_message = VALUES(user_message),
           started_at = VALUES(started_at),
           mtime = VALUES(mtime)`,
        [conversation_id, pane_key, user_message || '', eventTime, year, mon, now, now]
      );

      return res.json({ success: true, event: 'task_started' });
    }

    if (event === 'assistant_chunk') {
      const [existing] = await pool.query(
        'SELECT id FROM ai_conversation WHERE conversation_id = ?',
        [conversation_id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: 'conversation not found' });
      }

      const [maxSeq] = await pool.query(
        'SELECT COALESCE(MAX(seq), 0) as max_seq FROM ai_conversation_chunk WHERE conversation_id = ?',
        [conversation_id]
      );
      const nextSeq = maxSeq[0].max_seq + 1;

      await pool.query(
        `INSERT INTO ai_conversation_chunk (conversation_id, seq, content, chunk_time, ctime)
         VALUES (?, ?, ?, ?, ?)`,
        [conversation_id, nextSeq, content || '', eventTime, now]
      );

      return res.json({ success: true, event: 'assistant_chunk', seq: nextSeq });
    }

    if (event === 'task_completed') {
      const [result] = await pool.query(
        `UPDATE ai_conversation 
         SET assistant_message = ?, conv_status = 'completed', completed_at = ?, mtime = ?
         WHERE conversation_id = ?`,
        [assistant_message || '', eventTime, now, conversation_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'conversation not found' });
      }

      return res.json({ success: true, event: 'task_completed' });
    }

    return res.status(400).json({ error: `unknown event type: ${event}` });

  } catch (err) {
    console.error('[task-events] Error:', err.message);
    return res.status(500).json({ error: 'database error' });
  }
});

router.get('/:pane_key', async (req, res) => {
  const { pane_key } = req.params;
  const limit = parseInt(req.query.limit, 10) || 20;

  try {
    const [conversations] = await pool.query(
      `SELECT conversation_id, pane_key, user_message, assistant_message, conv_status, started_at, completed_at
       FROM ai_conversation
       WHERE pane_key = ? AND is_deleted = 0
       ORDER BY started_at DESC
       LIMIT ?`,
      [pane_key, limit]
    );

    return res.json({ conversations });
  } catch (err) {
    console.error('[task-events] GET error:', err.message);
    return res.status(500).json({ error: 'database error' });
  }
});

module.exports = router;
