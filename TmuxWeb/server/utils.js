/**
 * Parse paneKey into components.
 *
 * New format (v2): pane_key = session_name (e.g. "butler-backend")
 * Old format (v1): pane_key = "sessionName:windowIndex:paneId" (e.g. "butler-backend:0:%2")
 *
 * Returns { sessionName } for both formats (backward compatible).
 * Old callers that used windowIndex/paneIndex should migrate to session-only logic.
 */
function parsePaneKey(paneKey) {
    if (!paneKey) return null;
    const parts = paneKey.split(':');
    // Old format: at least 3 parts, last part starts with % (pane_id)
    if (parts.length >= 3 && parts[parts.length - 1].startsWith('%')) {
        return {
            sessionName: parts.slice(0, -2).join(':'),
            windowIndex: parseInt(parts[parts.length - 2], 10),
            paneIndex: parts[parts.length - 1]
        };
    }
    // New format: just session_name (may contain colons, but no trailing %paneId)
    return {
        sessionName: paneKey,
        windowIndex: 0,
        paneIndex: '0'
    };
}

/**
 * Extract session_name from a pane_key (works for both old and new formats).
 */
function getSessionName(paneKey) {
    const parsed = parsePaneKey(paneKey);
    return parsed ? parsed.sessionName : paneKey;
}

/**
 * Sync pane status to tmux_session_meta so TmuxTree sidebar can show it.
 * Shared by task-events.js and tasks-db.js.
 *
 * Now uses session_name as the status key (no more per-pane granularity).
 */
async function syncPaneStatus(pool, token, profileKey, paneKey, status) {
  if (!pool) return;
  try {
    const sessionName = getSessionName(paneKey);
    if (!sessionName) return;
    const now = Math.floor(Date.now() / 1000);

    const [existingRows] = await pool.query(
      `SELECT id, extra FROM tmux_session_meta WHERE token = ? AND profile_key = ? AND session_name = ?`,
      [token, profileKey, sessionName]
    );

    // Store status directly on the session level under "status" key
    if (existingRows.length > 0) {
      let extra = {};
      try { extra = existingRows[0].extra ? JSON.parse(existingRows[0].extra) : {}; } catch (e) { extra = {}; }
      // Keep backward compat: also write to panes map for old frontends
      if (!extra.panes) extra.panes = {};
      extra.panes['0:0'] = status;
      extra.sessionStatus = status;
      await pool.query(
        `UPDATE tmux_session_meta SET extra = ?, mtime = ? WHERE id = ?`,
        [JSON.stringify(extra), now, existingRows[0].id]
      );
    } else {
      const extra = { panes: { '0:0': status }, sessionStatus: status };
      await pool.query(
        `INSERT INTO tmux_session_meta (token, profile_key, session_name, extra, ctime, mtime) VALUES (?, ?, ?, ?, ?, ?)`,
        [token, profileKey, sessionName, JSON.stringify(extra), now, now]
      );
    }
  } catch (err) {
    console.error("[syncPaneStatus] error:", err.message);
  }
}

module.exports = { parsePaneKey, getSessionName, syncPaneStatus };
