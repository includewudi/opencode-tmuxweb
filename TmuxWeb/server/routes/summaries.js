const express = require('express');
const { pool } = require('../db/pool');
const config = require('../config-loader');
const { execSync } = require('child_process');

const taskSummariesRouter = express.Router();
const paneSummariesRouter = express.Router();

function isSummaryServiceConfigured() {
  return config.summaryServiceUrl && config.summaryServiceUrl.trim() !== '';
}

function parsePaneKey(paneKey) {
  const parts = paneKey.split(':');
  if (parts.length < 3) return null;
  return {
    sessionName: parts.slice(0, -2).join(':'),
    windowIndex: parseInt(parts[parts.length - 2], 10),
    paneIndex: parseInt(parts[parts.length - 1], 10)
  };
}

function generatePreview(outputSummary, commandSummary, maxLength = 120) {
  const source = outputSummary || commandSummary || '';
  const normalized = source
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength) + '...';
}

taskSummariesRouter.post('/:taskId/summarize', async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!isSummaryServiceConfigured()) {
      return res.status(501).json({
        error: 'not_configured',
        message: 'Summary service not configured'
      });
    }

    // 1. Get segment info to find the pane
    const [segments] = await pool.query(
      `SELECT session_name, window_index, pane_index 
       FROM tmux_task_segment 
       WHERE id = ?`,
      [taskId]
    );

    if (segments.length === 0) {
      return res.status(404).json({ error: 'task_not_found' });
    }

    const { session_name, window_index, pane_index } = segments[0];
    const paneTarget = `${session_name}:${window_index}.${pane_index}`;

    // 2. Capture pane content
    let capturedContent = '';
    try {
      capturedContent = execSync(`tmux capture-pane -p -t "${paneTarget}" -S -2000`, { encoding: 'utf-8' });
    } catch (e) {
      console.warn(`[Summarize] Failed to capture pane ${paneTarget}:`, e.message);
      capturedContent = 'Error capturing terminal content.';
    }

    const now = Math.floor(Date.now() / 1000);
    const date = new Date();
    const year = date.getFullYear();
    const mon = date.getMonth() + 1;
    const summaryJobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 3. Create pending entry
    const [result] = await pool.query(
      `INSERT INTO tmux_task_summary 
       (year, mon, segment_id, summary_job_id, summary_status, ctime, mtime)
       VALUES (?, ?, ?, ?, 'running', ?, ?)`,
      [year, mon, parseInt(taskId, 10), summaryJobId, now, now]
    );

    const summaryId = result.insertId;

    // 4. Trigger generation (async updates DB)
    // We do this asynchronously so we can return the job ID immediately
    // or we can await it if we want to return the result immediately. 
    // Given the previous implementation returned 'pending', let's stick to that 
    // but trigger the async process.

    (async () => {
      try {
        console.log(`[Summarize] Generating summary for task ${taskId}...`);
        // TODO: call summaryServiceUrl if configured
        console.log(`[Summarize] No summary service configured for task ${taskId}`);
        await pool.query(
          `UPDATE tmux_task_summary SET summary_status = 'error', summary_error = 'No summary service configured' WHERE id = ?`,
          [summaryId]
        );
      } catch (err) {
        console.error(`[Summarize] Async generation failed for task ${taskId}:`, err);
        await pool.query(
          `UPDATE tmux_task_summary 
                 SET summary_status = 'error', summary_error = ?
                 WHERE id = ?`,
          [err.message, summaryId]
        );
      }
    })();

    res.json({
      id: summaryId,
      summary_job_id: summaryJobId,
      summary_status: 'running'
    });
  } catch (err) {
    console.error('[summaries/summarize POST]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

taskSummariesRouter.post('/:taskId/load-summary', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { summary_id } = req.body;

    if (!summary_id) {
      return res.status(400).json({
        error: 'missing_summary_id',
        message: 'summary_id is required'
      });
    }

    const [sourceRows] = await pool.query(
      `SELECT id, session_name, window_index, window_name, command_summary, output_summary
       FROM tmux_task_summary
       WHERE id = ? AND is_deleted = 0`,
      [summary_id]
    );

    if (sourceRows.length === 0) {
      return res.status(404).json({
        error: 'summary_not_found',
        message: 'Source summary not found'
      });
    }

    const source = sourceRows[0];
    const now = Math.floor(Date.now() / 1000);
    const date = new Date();
    const year = date.getFullYear();
    const mon = date.getMonth() + 1;

    const [result] = await pool.query(
      `INSERT INTO tmux_task_summary 
       (year, mon, segment_id, session_name, window_index, window_name, 
        command_summary, output_summary, summary_status, generated_at, ctime, mtime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'done', ?, ?, ?)`,
      [
        year, mon, parseInt(taskId, 10),
        source.session_name, source.window_index, source.window_name,
        source.command_summary, source.output_summary,
        now, now, now
      ]
    );

    res.json({
      success: true,
      summary: {
        id: result.insertId,
        segment_id: parseInt(taskId, 10),
        session_name: source.session_name,
        window_index: source.window_index,
        window_name: source.window_name,
        command_summary: source.command_summary,
        output_summary: source.output_summary,
        summary_status: 'done',
        generated_at: now
      }
    });
  } catch (err) {
    console.error('[summaries/load-summary POST]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

paneSummariesRouter.get('/:paneKey/summary-candidates', async (req, res) => {
  try {
    const { paneKey } = req.params;
    const parsed = parsePaneKey(paneKey);

    if (!parsed) {
      return res.status(400).json({
        error: 'invalid_pane_key',
        message: 'Invalid paneKey format. Expected: sessionName:windowIndex:paneIndex'
      });
    }

    const [rows] = await pool.query(
      `SELECT id, segment_id, session_name, window_index, command_summary, output_summary, generated_at
       FROM tmux_task_summary
       WHERE session_name = ? AND window_index = ? AND summary_status = 'done' AND is_deleted = 0
       ORDER BY generated_at DESC
       LIMIT 50`,
      [parsed.sessionName, parsed.windowIndex]
    );

    res.json({
      candidates: rows.map(row => ({
        id: row.id,
        segment_id: row.segment_id,
        session_name: row.session_name,
        window_index: row.window_index,
        command_summary: row.command_summary,
        output_summary: row.output_summary,
        generated_at: row.generated_at,
        preview: generatePreview(row.output_summary, row.command_summary)
      }))
    });
  } catch (err) {
    console.error('[summaries/summary-candidates GET]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = { taskSummariesRouter, paneSummariesRouter };
