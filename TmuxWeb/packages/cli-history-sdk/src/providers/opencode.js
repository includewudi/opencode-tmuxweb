/**
 * OpenCode CLI History Provider
 * Reads from OpenCode's SQLite database in read-only mode.
 *
 * Exported as a factory: `createOpenCodeProvider(opts?)` → provider object.
 * This avoids module-level side effects and makes DB path configurable.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  '.local/share/opencode/opencode.db'
);

/**
 * Create an OpenCode CLI history provider.
 * @param {object} [opts]
 * @param {string} [opts.dbPath] - Path to opencode.db. Defaults to ~/.local/share/opencode/opencode.db
 * @returns {object} Provider instance
 */
function createOpenCodeProvider(opts = {}) {
  const dbPath = opts.dbPath || DEFAULT_DB_PATH;

  let db = null;
  let _enabled = false;

  function openDb() {
    if (db) return true;
    if (!fs.existsSync(dbPath)) {
      console.warn('[opencode-provider] DB not found:', dbPath);
      return false;
    }
    try {
      const Database = require('better-sqlite3');
      db = new Database(dbPath, { readonly: true });
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 5000');
      _enabled = true;
      return true;
    } catch (err) {
      console.error('[opencode-provider] Failed to open DB:', err.message);
      _enabled = false;
      return false;
    }
  }

  function safeJsonParse(str) {
    try { return JSON.parse(str); }
    catch { return null; }
  }

  /** Convert milliseconds timestamp to seconds */
  function msToSec(ms) {
    return ms ? Math.floor(ms / 1000) : null;
  }

  function listSessions(opts = {}) {
    const limit = Math.min(parseInt(opts.limit, 10) || 30, 200);
    const offset = parseInt(opts.offset, 10) || 0;
    const search = (opts.search || '').trim();

    openDb();
    if (!db) return { sessions: [], total: 0 };

    const directory = (opts.directory || '').trim();
    let whereClause = '1=1';
    const params = [];

    if (directory) {
      whereClause += ' AND (s.directory = ? OR s.directory LIKE ?)';
      params.push(directory, `%${directory}%`);
    }

    if (search) {
      whereClause += ' AND s.title LIKE ?';
      params.push(`%${search}%`);
    }

    const total = db.prepare(
      `SELECT COUNT(*) as cnt FROM session s WHERE ${whereClause}`
    ).get(params).cnt;

    const rows = db.prepare(
      `SELECT s.id, s.title, s.directory, s.time_created, s.time_updated,
              COALESCE(NULLIF(p.name, ''), p.worktree) as project_name,
              p.worktree as project_path,
              (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) as msg_count
       FROM session s
       LEFT JOIN project p ON s.project_id = p.id
       WHERE ${whereClause}
       ORDER BY s.time_updated DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    // Prepare a statement to find the agent from the last assistant message
    const agentStmt = db.prepare(
      `SELECT json_extract(data, '$.agent') as agent,
              json_extract(data, '$.mode') as mode
       FROM message
       WHERE session_id = ? AND json_extract(data, '$.role') = 'assistant'
       ORDER BY time_created DESC LIMIT 1`
    );

    const sessions = rows.map(row => {
      const agentRow = agentStmt.get(row.id);
      return {
        id: row.id,
        title: row.title || '(untitled)',
        directory: row.directory,
        projectName: row.project_name || row.directory,
        projectPath: row.project_path || row.directory,
        agent: agentRow?.agent || agentRow?.mode || null,
        messageCount: row.msg_count || 0,
        timeCreated: msToSec(row.time_created),
        timeUpdated: msToSec(row.time_updated),
      };
    });

    return { sessions, total };
  }

  function getSession(sessionId) {
    openDb();
    if (!db) return null;

    const session = db.prepare(
      `SELECT s.id, s.title, s.directory, s.time_created, s.time_updated,
              p.name as project_name
       FROM session s
       LEFT JOIN project p ON s.project_id = p.id
       WHERE s.id = ?`
    ).get(sessionId);

    if (!session) return null;

    const messages = db.prepare(
      `SELECT id, time_created, time_updated, data
       FROM message
       WHERE session_id = ?
       ORDER BY time_created ASC, id ASC`
    ).all(sessionId);

    const partsStmt = db.prepare(
      `SELECT id, data
       FROM part
       WHERE message_id = ?
       ORDER BY time_created ASC, id ASC`
    );

    const mappedMessages = messages.map(msg => {
      const d = safeJsonParse(msg.data) || {};
      const parts = partsStmt.all(msg.id).map(p => {
        const pd = safeJsonParse(p.data) || {};
        const result = {
          id: p.id,
          type: pd.type || 'text',
          text: pd.type === 'text' ? (pd.text || null) : null,
          tool: pd.type === 'tool' ? (pd.tool || null) : null,
          callID: pd.type === 'tool' ? (pd.callID || null) : null,
          status: pd.type === 'tool' ? (pd.state?.status || null) : null,
          input: pd.type === 'tool' ? (pd.state?.input || null) : null,
          output: pd.type === 'tool' ? (pd.state?.output || null) : null,
          duration: pd.type === 'tool' ? (pd.state?.time
            ? (pd.state.time.end || 0) - (pd.state.time.start || 0)
            : null) : null,
        };
        return result;
      });

      const errorData = d.error || null;

      return {
        id: msg.id,
        role: d.role || 'unknown',
        agent: d.agent || d.mode || null,
        modelID: d.modelID || null,
        providerID: d.providerID || null,
        tokens: d.tokens || null,
        error: errorData ? {
          name: errorData.name || null,
          message: errorData.data?.message || errorData.message || null,
          statusCode: errorData.data?.statusCode || errorData.statusCode || null,
          isRetryable: errorData.data?.isRetryable ?? errorData.isRetryable ?? null,
        } : null,
        timeCreated: msToSec(msg.time_created),
        timeUpdated: msToSec(msg.time_updated),
        parts,
      };
    });

    // Determine agent from last assistant message
    const lastAssistant = [...mappedMessages].reverse().find(m => m.role === 'assistant');

    return {
      id: session.id,
      title: session.title || '(untitled)',
      directory: session.directory,
      projectName: session.project_name,
      agent: lastAssistant?.agent || null,
      messageCount: mappedMessages.length,
      timeCreated: msToSec(session.time_created),
      timeUpdated: msToSec(session.time_updated),
      messages: mappedMessages,
    };
  }

  function getToolCalls(sessionId, opts = {}) {
    const limit = Math.min(parseInt(opts.limit, 10) || 50, 500);
    const offset = parseInt(opts.offset, 10) || 0;

    openDb();
    if (!db) return { toolCalls: [], total: 0 };

    const countRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM part
       WHERE session_id = ? AND json_extract(data, '$.type') = 'tool'`
    ).get(sessionId);

    const total = countRow?.cnt || 0;

    const rows = db.prepare(
      `SELECT p.id, p.data, m.time_created as msg_time
       FROM part p
       JOIN message m ON p.message_id = m.id
       WHERE p.session_id = ? AND json_extract(p.data, '$.type') = 'tool'
       ORDER BY m.time_created ASC, p.time_created ASC, p.id ASC
       LIMIT ? OFFSET ?`
    ).all(sessionId, limit, offset);

    const toolCalls = rows.map(row => {
      const d = safeJsonParse(row.data) || {};
      const st = d.state || {};
      return {
        id: row.id,
        tool: d.tool || 'unknown',
        callID: d.callID || null,
        status: st.status || 'unknown',
        input: st.input || null,
        output: typeof st.output === 'string' ? st.output : JSON.stringify(st.output),
        duration: st.time
          ? (st.time.end || 0) - (st.time.start || 0)
          : null,
        timeCreated: msToSec(row.msg_time),
      };
    });

    return { toolCalls, total };
  }

  function search(query, opts = {}) {
    const limit = Math.min(parseInt(opts.limit, 10) || 20, 100);
    const term = `%${(query || '').trim()}%`;

    openDb();
    if (!db) return [];

    // Search session titles
    const titleMatches = db.prepare(
      `SELECT s.id, s.title, s.time_updated, 'title' as match_type
       FROM session s
       WHERE s.title LIKE ?
       ORDER BY s.time_updated DESC LIMIT ?`
    ).all(term, limit);

    // Search text parts (content)
    const contentMatches = db.prepare(
      `SELECT DISTINCT s.id, s.title, s.time_updated, 'content' as match_type,
              substr(json_extract(p.data, '$.text'), 1, 200) as context
       FROM session s
       JOIN part p ON p.session_id = s.id
       WHERE json_extract(p.data, '$.type') = 'text'
         AND json_extract(p.data, '$.text') LIKE ?
       ORDER BY s.time_updated DESC LIMIT ?`
    ).all(term, limit);

    const seen = new Set();
    const results = [];

    for (const row of [...titleMatches, ...contentMatches]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      results.push({
        sessionId: row.id,
        sessionTitle: row.title || '(untitled)',
        matchType: row.match_type,
        context: row.context || row.title || '',
        timeUpdated: msToSec(row.time_updated),
      });
    }

    return results.slice(0, limit);
  }

  // Eagerly try to open DB on creation
  openDb();

  return {
    id: 'opencode',
    name: 'OpenCode',
    get enabled() { return _enabled; },
    listSessions,
    getSession,
    getToolCalls,
    search,
  };
}

module.exports = { createOpenCodeProvider };
