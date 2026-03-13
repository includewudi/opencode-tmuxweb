const express = require('express');
const { pool, dbEnabled } = require('../db/pool');
const config = require('../config-loader');
const { syncPaneStatus } = require('../utils');

const router = express.Router();

// CLI sends slash-separated pane_key ("session/window/pane"), frontend uses colon-separated
function normalizePaneKey(key) {
  if (!key) return key;
  return key.replace(/\//g, ':');
}

// syncPaneStatus is now imported from ../utils

const sseSubscribers = new Map();

function addSubscriber(paneKey, res) {
  if (!sseSubscribers.has(paneKey)) {
    sseSubscribers.set(paneKey, new Set());
  }
  sseSubscribers.get(paneKey).add(res);
}

function removeSubscriber(paneKey, res) {
  const subs = sseSubscribers.get(paneKey);
  if (subs) {
    subs.delete(res);
    if (subs.size === 0) {
      sseSubscribers.delete(paneKey);
    }
  }
}

function broadcast(paneKey, eventData) {
  const subs = sseSubscribers.get(paneKey);
  if (!subs || subs.size === 0) return;
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const res of subs) {
    try {
      res.write(payload);
    } catch (err) {
      console.error('[task-events] SSE write error:', err.message);
    }
  }
}

router.get('/stream/:pane_key(*)', (req, res) => {
  const paneKey = normalizePaneKey(req.params.pane_key);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');

  addSubscriber(paneKey, res);
  console.log(`[task-events] SSE subscriber added for ${paneKey} (total: ${sseSubscribers.get(paneKey).size})`);

  req.on('close', () => {
    removeSubscriber(paneKey, res);
    console.log(`[task-events] SSE subscriber removed for ${paneKey}`);
  });
});

router.post('/', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'database_not_configured', message: 'Task events require MySQL.' });
  }

  const { event, conversation_id, user_message, content, assistant_message, timestamp } = req.body;
  const rawPaneKey = req.body.pane_key;

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
      if (!rawPaneKey) {
        return res.status(400).json({ error: 'task_started requires pane_key' });
      }

      const paneKey = normalizePaneKey(rawPaneKey);

      // Auto-close any stale in_progress conversations on this pane
      await pool.query(
        `UPDATE ai_conversation SET conv_status = "aborted", mtime = ? WHERE pane_key = ? AND conv_status = "in_progress" AND conversation_id != ?`,
        [now, paneKey, conversation_id]
      );

      await pool.query(
        `INSERT INTO ai_conversation 
         (conversation_id, pane_key, user_message, conv_status, started_at, year, mon, ctime, mtime)
         VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           user_message = VALUES(user_message),
           started_at = VALUES(started_at),
           mtime = VALUES(mtime)`,
        [conversation_id, paneKey, user_message || '', eventTime, year, mon, now, now]
      );

      // Sync pane status to sidebar
      const token = req.token || req.query.token || config.token;
        await syncPaneStatus(pool, token, 'default', paneKey, 'in_progress');

      broadcast(paneKey, {
        type: 'task_started',
        conversation_id,
        pane_key: paneKey,
        user_message: user_message || '',
        timestamp: eventTime,
      });

      return res.json({ success: true, event: 'task_started' });
    }

    if (event === 'assistant_chunk') {
      const [existing] = await pool.query(
        'SELECT id, pane_key FROM ai_conversation WHERE conversation_id = ?',
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
      const [existing] = await pool.query(
        'SELECT pane_key FROM ai_conversation WHERE conversation_id = ?',
        [conversation_id]
      );
      if (existing.length > 0) {
        const paneKeyForBroadcast = existing[0].pane_key;

        // Sync pane status to sidebar
        const token = req.token || req.query.token || config.token;
        await syncPaneStatus(pool, token, 'default', paneKeyForBroadcast, 'done');

        broadcast(paneKeyForBroadcast, {
          type: 'task_completed',
          conversation_id,
          pane_key: paneKeyForBroadcast,
          assistant_message: assistant_message || '',
          timestamp: eventTime,
        });
      }

      await pool.query(
        `UPDATE ai_conversation SET 
         assistant_message = ?, conv_status = 'completed', completed_at = ?, mtime = ?
         WHERE conversation_id = ?`,
        [assistant_message || '', eventTime, now, conversation_id]
      );

      return res.json({ success: true, event: 'task_completed' });
    }

    if (event === 'task_failed') {
      const [existing] = await pool.query(
        'SELECT pane_key FROM ai_conversation WHERE conversation_id = ?',
        [conversation_id]
      );
      if (existing.length > 0) {
        const paneKeyForBroadcast = existing[0].pane_key;

        const token = req.token || req.query.token || config.token;
        await syncPaneStatus(pool, token, 'default', paneKeyForBroadcast, 'failed');

        broadcast(paneKeyForBroadcast, {
          type: 'task_failed',
          conversation_id,
          pane_key: paneKeyForBroadcast,
          assistant_message: assistant_message || '',
          timestamp: eventTime,
        });
      }

      await pool.query(
        `UPDATE ai_conversation SET
         assistant_message = ?, conv_status = 'failed', completed_at = ?, mtime = ?
         WHERE conversation_id = ?`,
        [assistant_message || '', eventTime, now, conversation_id]
      );

      return res.json({ success: true, event: 'task_failed' });
    }

    if (event === 'task_waiting') {
      const [existing] = await pool.query(
        'SELECT pane_key FROM ai_conversation WHERE conversation_id = ?',
        [conversation_id]
      );
      if (existing.length > 0) {
        const paneKeyForBroadcast = existing[0].pane_key;

        const token = req.token || req.query.token || config.token;
        await syncPaneStatus(pool, token, 'default', paneKeyForBroadcast, 'waiting');

        broadcast(paneKeyForBroadcast, {
          type: 'task_waiting',
          conversation_id,
          pane_key: paneKeyForBroadcast,
          assistant_message: assistant_message || '',
          timestamp: eventTime,
        });
      }

      await pool.query(
        `UPDATE ai_conversation SET
         assistant_message = ?, conv_status = 'waiting', mtime = ?
         WHERE conversation_id = ?`,
        [assistant_message || '', now, conversation_id]
      );

      return res.json({ success: true, event: 'task_waiting' });
    }


    return res.status(400).json({ error: `unknown event type: ${event}` });

  } catch (err) {
    console.error('[task-events] Error:', err.message);
    return res.status(500).json({ error: 'database error' });
  }
});

router.get('/:pane_key(*)', async (req, res) => {
  if (!dbEnabled) {
    return res.json({ conversations: [] });
  }

  const paneKey = normalizePaneKey(req.params.pane_key);
  const limit = parseInt(req.query.limit, 10) || 20;

  try {
    const [conversations] = await pool.query(
      `SELECT conversation_id, pane_key, user_message, assistant_message, conv_status, started_at, completed_at
       FROM ai_conversation
       WHERE pane_key = ? AND is_deleted = 0
       ORDER BY started_at DESC
       LIMIT ?`,
      [paneKey, limit]
    );

    return res.json({ conversations });
  } catch (err) {
    console.error('[task-events] GET error:', err.message);
    return res.status(500).json({ error: 'database error' });
  }
});

module.exports = router;
