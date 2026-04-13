const { execSync } = require('child_process');

/**
 * Parse paneKey into components.
 *
 * Supported formats:
 * - Session only: "session_name"
 * - Session + window (UI tab title): "session_name:windowIndex"
 * - Full legacy pane key: "sessionName:windowIndex:%paneId"
 * - Slash style from plugin: "session/window/%pane" (normalized before parse)
 */
function parsePaneKey(paneKey) {
  if (!paneKey) return null;
  const normalized = String(paneKey).replace(/\//g, ':');
  const parts = normalized.split(':');

  // Full legacy format: ...:<windowIndex>:%<paneId>
  if (parts.length >= 3 && parts[parts.length - 1].startsWith('%')) {
    return {
      sessionName: parts.slice(0, -2).join(':'),
      windowIndex: parseInt(parts[parts.length - 2], 10),
      paneIndex: parts[parts.length - 1],
    };
  }

  // UI tab title format: ...:<windowIndex>
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
    return {
      sessionName: parts.slice(0, -1).join(':'),
      windowIndex: parseInt(parts[parts.length - 1], 10),
      paneIndex: '0',
    };
  }

  return {
    sessionName: normalized,
    windowIndex: 0,
    paneIndex: '0',
  };
}

/**
 * Extract session_name from a pane_key (works for all supported formats).
 */
function getSessionName(paneKey) {
  const parsed = parsePaneKey(paneKey);
  return parsed ? parsed.sessionName : paneKey;
}

let _sessionGroupCache = { at: 0, rows: [] };

function listSessionGroups() {
  const now = Date.now();
  if (now - _sessionGroupCache.at < 2000) {
    return _sessionGroupCache.rows;
  }

  try {
    const out = execSync('tmux list-sessions -F "#{session_name}\t#{session_group}"', {
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const rows = out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf('\t');
        if (idx < 0) {
          return { sessionName: line.trim(), sessionGroup: '' };
        }
        return {
          sessionName: line.slice(0, idx).trim(),
          sessionGroup: line.slice(idx + 1).trim(),
        };
      });

    _sessionGroupCache = { at: now, rows };
    return rows;
  } catch {
    return [];
  }
}

/**
 * Canonical session name for storage/query.
 * For linked tmux sessions (__tw_*), session_group is the user-facing session.
 */
function getCanonicalSessionName(paneKey) {
  const sessionName = getSessionName(paneKey);
  if (!sessionName) return sessionName;

  const rows = listSessionGroups();
  const row = rows.find(r => r.sessionName === sessionName);
  if (!row) return sessionName;
  return row.sessionGroup || row.sessionName;
}

/**
 * All aliases that may appear in DB for the same logical session.
 * Includes canonical name + linked __tw_* names.
 */
function getSessionNameAliases(paneKey) {
  const sessionName = getSessionName(paneKey);
  if (!sessionName) return [];

  const canonical = getCanonicalSessionName(sessionName);
  const aliases = new Set([sessionName, canonical]);

  const rows = listSessionGroups();
  for (const row of rows) {
    const group = row.sessionGroup || row.sessionName;
    if (group === canonical) {
      aliases.add(row.sessionName);
    }
  }

  return Array.from(aliases).filter(Boolean);
}

/**
 * Sync pane status to tmux_session_meta so TmuxTree sidebar can show it.
 * Shared by task-events.js and tasks-db.js.
 *
 * Uses canonical session_name so linked sessions and real sessions stay consistent.
 */
async function syncPaneStatus(pool, token, profileKey, paneKey, status) {
  if (!pool) return;
  try {
    const sessionName = getCanonicalSessionName(paneKey);
    if (!sessionName) return;
    const now = Math.floor(Date.now() / 1000);

    const [existingRows] = await pool.query(
      `SELECT id, extra FROM tmux_session_meta WHERE token = ? AND profile_key = ? AND session_name = ?`,
      [token, profileKey, sessionName]
    );

    if (existingRows.length > 0) {
      let extra = {};
      try { extra = existingRows[0].extra ? JSON.parse(existingRows[0].extra) : {}; } catch (e) { extra = {}; }
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
    console.error('[syncPaneStatus] error:', err.message);
  }
}

module.exports = {
  parsePaneKey,
  getSessionName,
  getCanonicalSessionName,
  getSessionNameAliases,
  syncPaneStatus,
};
