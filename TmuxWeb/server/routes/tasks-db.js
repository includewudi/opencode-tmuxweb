const express = require('express');
const { pool } = require('../db/pool');
const { parsePaneKey } = require('../utils');

const router = express.Router();


/**
 * POST /api/panes/:paneKey/tasks
 * Create new task for a pane
 */
router.post('/:paneKey/tasks', async (req, res) => {
  try {
    const { paneKey } = req.params;
    const { title } = req.body;
    const token = req.token;

    const parsed = parsePaneKey(paneKey);
    if (!parsed) {
      return res.status(400).json({ error: 'invalid_pane_key', message: 'Invalid paneKey format' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const mon = now.getMonth() + 1;
    const timestamp = Math.floor(now.getTime() / 1000);

    const [result] = await pool.query(
      `INSERT INTO tmux_task_segment 
       (year, mon, token, session_name, window_index, pane_index, task_title, task_status, started_at, ctime, mtime, status, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, 1, 0)`,
      [year, mon, token, parsed.sessionName, parsed.windowIndex, parsed.paneIndex, title || '', timestamp, timestamp, timestamp]
    );

    res.json({
      id: result.insertId,
      task_title: title || '',
      task_status: 'in_progress',
      started_at: timestamp,
      paneKey
    });
  } catch (err) {
    console.error('[tasks-db POST /:paneKey/tasks]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

/**
 * GET /api/panes/:paneKey/tasks
 * List tasks for pane
 */
router.get('/:paneKey/tasks', async (req, res) => {
  try {
    const { paneKey } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const token = req.token;

    const parsed = parsePaneKey(paneKey);
    if (!parsed) {
      return res.status(400).json({ error: 'invalid_pane_key', message: 'Invalid paneKey format' });
    }

    const limitNum = parseInt(limit, 10) || 20;
    const offsetNum = parseInt(offset, 10) || 0;

    const [tasks] = await pool.query(
      `SELECT id, task_title, task_status, started_at, completed_at, ctime, mtime
       FROM tmux_task_segment
       WHERE token = ? AND session_name = ? AND window_index = ? AND pane_index = ? AND is_deleted = 0
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [token, parsed.sessionName, parsed.windowIndex, parsed.paneIndex, limitNum, offsetNum]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total
       FROM tmux_task_segment
       WHERE token = ? AND session_name = ? AND window_index = ? AND pane_index = ? AND is_deleted = 0`,
      [token, parsed.sessionName, parsed.windowIndex, parsed.paneIndex]
    );

    res.json({ tasks, total });
  } catch (err) {
    console.error('[tasks-db GET /:paneKey/tasks]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task (title, status)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { task_title, task_status } = req.body;
    const token = req.token;

    const [existing] = await pool.query(
      `SELECT id FROM tmux_task_segment WHERE id = ? AND token = ? AND is_deleted = 0`,
      [id, token]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const updates = [];
    const values = [];

    if (task_title !== undefined) {
      updates.push('task_title = ?');
      values.push(task_title);
    }
    if (task_status !== undefined) {
      updates.push('task_status = ?');
      values.push(task_status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'no_updates', message: 'No fields to update' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    updates.push('mtime = ?');
    values.push(timestamp);
    values.push(id);

    await pool.query(
      `UPDATE tmux_task_segment SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [[task]] = await pool.query(
      `SELECT id, task_title, task_status, started_at, completed_at, ctime, mtime
       FROM tmux_task_segment WHERE id = ?`,
      [id]
    );

    res.json({ success: true, task });
  } catch (err) {
    console.error('[tasks-db PUT /:id]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark task done
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.token;

    const [existing] = await pool.query(
      `SELECT id FROM tmux_task_segment WHERE id = ? AND token = ? AND is_deleted = 0`,
      [id, token]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    const timestamp = Math.floor(Date.now() / 1000);

    await pool.query(
      `UPDATE tmux_task_segment SET task_status = 'completed', completed_at = ?, mtime = ? WHERE id = ?`,
      [timestamp, timestamp, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[tasks-db POST /:id/complete]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

/**
 * GET /api/tasks/:id/detail
 * Get full task details with logs and summary
 */
router.get('/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.token;

    const [[task]] = await pool.query(
      `SELECT id, year, mon, token, session_name, window_index, pane_index, 
              task_title, task_status, started_at, completed_at, ctime, mtime
       FROM tmux_task_segment 
       WHERE id = ? AND token = ? AND is_deleted = 0`,
      [id, token]
    );

    if (!task) {
      return res.status(404).json({ error: 'not_found', message: 'Task not found' });
    }

    // Get conversation from tmux_chat_message
    const [conversation] = await pool.query(
      `SELECT role, content, msg_time
       FROM tmux_chat_message
       WHERE segment_id = ?
       ORDER BY msg_time ASC`,
      [id]
    );

    // Get commands from tmux_command_record
    const [commands] = await pool.query(
      `SELECT command, cmd_time
       FROM tmux_command_record
       WHERE segment_id = ?
       ORDER BY cmd_time ASC`,
      [id]
    );

    // Get summary from tmux_task_summary
    const [[summaryRow]] = await pool.query(
      `SELECT command_summary, output_summary, summary_status
       FROM tmux_task_summary
       WHERE segment_id = ?`,
      [id]
    );

    res.json({
      task,
      conversation,
      commands,
      summary: summaryRow || null
    });
  } catch (err) {
    console.error('[tasks-db GET /:id/detail]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = router;
