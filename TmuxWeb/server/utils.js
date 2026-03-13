/**
 * Parse paneKey into components
 * Format: "sessionName:windowIndex:paneIndex"
 * Session names may contain colons, so we split from the right.
 */
function parsePaneKey(paneKey) {
    const parts = paneKey.split(':');
    if (parts.length < 3) return null;
    return {
        sessionName: parts.slice(0, -2).join(':'),
        windowIndex: parseInt(parts[parts.length - 2], 10),
        paneIndex: parts[parts.length - 1]
    };
}

/**
 * Sync pane status to tmux_session_meta so TmuxTree sidebar can show it.
 * Shared by task-events.js and tasks-db.js.
 */
async function syncPaneStatus(pool, token, profileKey, paneKey, status) {
  if (!pool) return;
  try {
    const parts = paneKey.split(":");
    if (parts.length < 3) return;
    const sessionName = parts.slice(0, -2).join(":");
    const windowIndex = parts[parts.length - 2];
    const paneIndex = parts[parts.length - 1];
    const paneStatusKey = `${windowIndex}:${paneIndex}`;
    const now = Math.floor(Date.now() / 1000);

    const [existingRows] = await pool.query(
      `SELECT id, extra FROM tmux_session_meta WHERE token = ? AND profile_key = ? AND session_name = ?`,
      [token, profileKey, sessionName]
    );

    if (existingRows.length > 0) {
      let extra = {};
      try { extra = existingRows[0].extra ? JSON.parse(existingRows[0].extra) : {}; } catch (e) { extra = {}; }
      if (!extra.panes) extra.panes = {};
      extra.panes[paneStatusKey] = status;
      await pool.query(
        `UPDATE tmux_session_meta SET extra = ?, mtime = ? WHERE id = ?`,
        [JSON.stringify(extra), now, existingRows[0].id]
      );
    } else {
      const extra = { panes: { [paneStatusKey]: status } };
      await pool.query(
        `INSERT INTO tmux_session_meta (token, profile_key, session_name, extra, ctime, mtime) VALUES (?, ?, ?, ?, ?, ?)`,
        [token, profileKey, sessionName, JSON.stringify(extra), now, now]
      );
    }
  } catch (err) {
    console.error("[syncPaneStatus] error:", err.message);
  }
}

module.exports = { parsePaneKey, syncPaneStatus };
