const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const router = Router();

// ── SQLite connection (readonly) ─────────────────────────────────
const dbPath = path.join(os.homedir(), '.local/share/opencode/opencode.db');

let db = null;
try {
  if (fs.existsSync(dbPath)) {
    db = new Database(dbPath, { readonly: true });
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
  }
} catch (err) {
  console.error('[project-overview] Failed to open DB:', err.message);
}

// ── In-memory cache ──────────────────────────────────────────────
const cache = {};
function getCached(key, ttl, fn) {
  const entry = cache[key];
  if (entry && (Date.now() - entry.timestamp) < ttl) {
    return entry.data;
  }
  const data = fn();
  cache[key] = { data, timestamp: Date.now() };
  return data;
}

// ── Helpers ──────────────────────────────────────────────────────

function extractPlanName(planPath) {
  if (!planPath) return null;
  const name = planPath.split('/').pop();
  return name ? name.replace(/\.md$/, '') : null;
}

function readBoulderJson(worktree) {
  const boulderPath = path.join(worktree, '.sisyphus/boulder.json');
  if (!fs.existsSync(boulderPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ── GET /summary ─────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'opencode.db not found', path: dbPath });
  }

  try {
    const data = getCached('summary', 30_000, () => {
      // 1. Project stats
      const projects = db.prepare(`
        SELECT p.id, p.name, p.worktree as path,
               COUNT(DISTINCT s.id) as session_count,
               MAX(s.time_updated) as last_activity
        FROM project p
        LEFT JOIN session s ON s.project_id = p.id
        GROUP BY p.id
        ORDER BY last_activity DESC
      `).all();

      // 2. Latest user message per project (via part table)
      const latestMsgStmt = db.prepare(`
        SELECT substr(json_extract(pt.data, '$.text'), 1, 200) as text
        FROM part pt
        JOIN message m ON pt.message_id = m.id
        JOIN (SELECT id FROM session WHERE project_id = ? ORDER BY time_updated DESC LIMIT 1) s
        ON m.session_id = s.id
        WHERE json_extract(pt.data, '$.type') = 'text'
          AND json_extract(m.data, '$.role') = 'user'
        ORDER BY pt.id DESC LIMIT 1
      `);

      // 3. TODO stats per project
      const todoStatsStmt = db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending
        FROM todo t
        JOIN session s ON s.id = t.session_id
        WHERE s.project_id = ?
      `);

      return projects.map(proj => {
        // Latest message
        const msgRow = latestMsgStmt.get(proj.id);
        const latestMessage = msgRow?.text || null;

        // TODO stats
        const todoRow = todoStatsStmt.get(proj.id);
        const todoStats = todoRow
          ? { total: todoRow.total || 0, completed: todoRow.completed || 0, pending: todoRow.pending || 0 }
          : { total: 0, completed: 0, pending: 0 };

        // Boulder.json (plans)
        const boulder = readBoulderJson(proj.path);
        const activePlan = boulder?.active_plan ? extractPlanName(boulder.active_plan) : null;
        const completedPlans = Array.isArray(boulder?.completed_plans)
          ? boulder.completed_plans.map(p => extractPlanName(p.plan)).filter(Boolean)
          : [];

        return {
          id: proj.id,
          name: proj.name,
          path: proj.path,
          lastActivity: proj.last_activity ? new Date(proj.last_activity).toISOString() : null,
          sessionCount: proj.session_count || 0,
          todoStats,
          latestMessage,
          activePlan,
          completedPlans,
        };
      });
    });

    res.json({ success: true, data: { projects: data } });
  } catch (err) {
    console.error('[project-overview] /summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /project/:id ─────────────────────────────────────────────
router.get('/project/:id', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'opencode.db not found', path: dbPath });
  }

  try {
    const projectId = req.params.id;

    // 1. Project basic info
    const proj = db.prepare(`
      SELECT p.id, p.name, p.worktree as path,
             COUNT(DISTINCT s.id) as session_count,
             MAX(s.time_updated) as last_activity
      FROM project p
      LEFT JOIN session s ON s.project_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(projectId);

    if (!proj) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 2. TODO stats
    const todoRow = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending
      FROM todo t
      JOIN session s ON s.id = t.session_id
      WHERE s.project_id = ?
    `).get(projectId);

    const todoStats = todoRow
      ? { total: todoRow.total || 0, completed: todoRow.completed || 0, pending: todoRow.pending || 0 }
      : { total: 0, completed: 0, pending: 0 };

    // 3. Full TODO list
    const todos = db.prepare(`
      SELECT t.content, t.status, t.priority
      FROM todo t
      JOIN session s ON s.id = t.session_id
      WHERE s.project_id = ?
      ORDER BY t.position
    `).all(projectId);

    // 4. Latest user message
    const msgRow = db.prepare(`
      SELECT substr(json_extract(pt.data, '$.text'), 1, 200) as text
      FROM part pt
      JOIN message m ON pt.message_id = m.id
      JOIN (SELECT id FROM session WHERE project_id = ? ORDER BY time_updated DESC LIMIT 1) s
      ON m.session_id = s.id
      WHERE json_extract(pt.data, '$.type') = 'text'
        AND json_extract(m.data, '$.role') = 'user'
      ORDER BY pt.id DESC LIMIT 1
    `).get(projectId);
    const latestMessage = msgRow?.text || null;

    // 5. Boulder.json (plans)
    const boulder = readBoulderJson(proj.path);
    const activePlan = boulder?.active_plan ? extractPlanName(boulder.active_plan) : null;
    const completedPlans = Array.isArray(boulder?.completed_plans)
      ? boulder.completed_plans.map(p => extractPlanName(p.plan)).filter(Boolean)
      : [];
    const plans = [];
    if (activePlan) plans.push({ name: activePlan, status: 'active' });
    for (const name of completedPlans) {
      plans.push({ name, status: 'completed' });
    }

    // 6. Recent 10 sessions
    const recentSessions = db.prepare(`
      SELECT id, title, time_updated, time_created,
             summary_additions, summary_deletions, summary_files
      FROM session
      WHERE project_id = ?
      ORDER BY time_updated DESC LIMIT 10
    `).all(projectId);

    // 7. Batch query latest messages for these sessions (via part table)
    let sessionMessages = {};
    if (recentSessions.length > 0) {
      const sessionIds = recentSessions.map(s => s.id);
      const placeholders = sessionIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT m.session_id, substr(json_extract(pt.data, '$.text'), 1, 200) as text,
               json_extract(m.data, '$.role') as role
        FROM part pt
        JOIN message m ON pt.message_id = m.id
        WHERE m.session_id IN (${placeholders})
          AND json_extract(pt.data, '$.type') = 'text'
          AND json_extract(m.data, '$.role') IN ('user', 'assistant')
        ORDER BY m.session_id, pt.id DESC
      `).all(...sessionIds);

      const grouped = {};
      for (const row of rows) {
        if (!grouped[row.session_id]) grouped[row.session_id] = { user: null, assistant: null };
        const g = grouped[row.session_id];
        if (row.role === 'user' && !g.user) g.user = row.text;
        else if (row.role === 'assistant' && !g.assistant) g.assistant = row.text;
      }
      sessionMessages = grouped;
    }

    const mappedSessions = recentSessions.map(s => ({
      id: s.id,
      title: s.title,
      timeUpdated: s.time_updated ? new Date(s.time_updated).toISOString() : null,
      timeCreated: s.time_created ? new Date(s.time_created).toISOString() : null,
      summaryAdditions: s.summary_additions || 0,
      summaryDeletions: s.summary_deletions || 0,
      summaryFiles: s.summary_files || 0,
      latestUserMessage: sessionMessages[s.id]?.user || null,
      latestAssistantMessage: sessionMessages[s.id]?.assistant || null,
    }));

    res.json({
      success: true,
      data: {
        project: {
          id: proj.id,
          name: proj.name,
          path: proj.path,
          lastActivity: proj.last_activity ? new Date(proj.last_activity).toISOString() : null,
          sessionCount: proj.session_count || 0,
          todoStats,
          latestMessage,
          activePlan,
          completedPlans,
        },
        todos,
        recentSessions: mappedSessions,
        plans,
      },
    });
  } catch (err) {
    console.error('[project-overview] /project/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/project/:id/goals', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'opencode.db not found', path: dbPath });
  }

  try {
    const projectId = req.params.id;

    const proj = db.prepare(`
      SELECT p.id, p.name, p.worktree as path, MAX(s.time_updated) as last_activity
      FROM project p
      LEFT JOIN session s ON s.project_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(projectId);

    if (!proj) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const boulder = readBoulderJson(proj.path);
    const taskSessions = boulder?.task_sessions || {};
    const coveredSessionIds = new Set();
    const boulderGoals = [];
    const sessionMeta = {};

    for (const [key, entry] of Object.entries(taskSessions)) {
      if (!entry?.session_id) continue;

      const title = entry.task_title || `Task: ${key}`;
      const sessionId = entry.session_id;
      coveredSessionIds.add(sessionId);
      sessionMeta[sessionId] = { agent: entry.agent || null, category: entry.category || null };

      const childSessions = db.prepare('SELECT id FROM session WHERE parent_id = ?').all(sessionId);
      for (const child of childSessions) {
        coveredSessionIds.add(child.id);
        sessionMeta[child.id] = { agent: entry.agent || null, category: entry.category || null };
      }

      boulderGoals.push({
        id: `goal-${key}`,
        title,
        status: 'active',
        sessionIds: [sessionId, ...childSessions.map(c => c.id)],
        rawKey: key,
      });
    }

    if (coveredSessionIds.size > 0) {
      const coveredArr = Array.from(coveredSessionIds);
      const coveredPH = coveredArr.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT id FROM session
        WHERE project_id = ? AND parent_id IS NULL AND id NOT IN (${coveredPH})
      `).all(projectId, ...coveredArr);
      for (const row of rows) {
        coveredSessionIds.add(row.id);

        const childSessions = db.prepare('SELECT id FROM session WHERE parent_id = ?').all(row.id);
        for (const child of childSessions) {
          coveredSessionIds.add(child.id);
        }

        const firstMsg = db.prepare(`
          SELECT substr(json_extract(pt.data, '$.text'), 1, 100) as text
          FROM part pt
          JOIN message m ON pt.message_id = m.id
          WHERE m.session_id = ? AND json_extract(pt.data, '$.type') = 'text' AND json_extract(m.data, '$.role') = 'user'
          ORDER BY pt.id ASC LIMIT 1
        `).get(row.id);
        boulderGoals.push({
          id: `goal-remaining-${row.id}`,
          title: firstMsg?.text || `Session ${row.id}`,
          status: 'active',
          sessionIds: [row.id, ...childSessions.map(c => c.id)],
          rawKey: `remaining-${row.id}`,
        });
      }
    } else {
      const rows = db.prepare(`
        SELECT id FROM session WHERE project_id = ? AND parent_id IS NULL
        ORDER BY time_updated DESC LIMIT 50
      `).all(projectId);
      for (const row of rows) {
        coveredSessionIds.add(row.id);
        const childSessions = db.prepare('SELECT id FROM session WHERE parent_id = ?').all(row.id);
        for (const child of childSessions) {
          coveredSessionIds.add(child.id);
        }
        const firstMsg = db.prepare(`
          SELECT substr(json_extract(pt.data, '$.text'), 1, 100) as text
          FROM part pt
          JOIN message m ON pt.message_id = m.id
          WHERE m.session_id = ? AND json_extract(pt.data, '$.type') = 'text' AND json_extract(m.data, '$.role') = 'user'
          ORDER BY pt.id ASC LIMIT 1
        `).get(row.id);
        boulderGoals.push({
          id: `goal-remaining-${row.id}`,
          title: firstMsg?.text || `Session ${row.id}`,
          status: 'active',
          sessionIds: [row.id, ...childSessions.map(c => c.id)],
          rawKey: `remaining-${row.id}`,
        });
      }
    }

    const goals = [];

    for (const goal of boulderGoals) {
      const sessionIds = goal.sessionIds;
      const placeholders = sessionIds.map(() => '?').join(',');

      const msgCounts = db.prepare(`
        SELECT json_extract(m.data, '$.role') as role, COUNT(*) as count
        FROM message m
        WHERE m.session_id IN (${placeholders})
        GROUP BY role
      `).all(...sessionIds);

      let userMsgs = 0;
      let assistantMsgs = 0;
      for (const row of msgCounts) {
        if (row.role === 'user') userMsgs = row.count;
        else if (row.role === 'assistant') assistantMsgs = row.count;
      }

      const codeRows = db.prepare(`
        SELECT COALESCE(SUM(summary_additions), 0) as additions,
               COALESCE(SUM(summary_deletions), 0) as deletions,
               COALESCE(SUM(summary_files), 0) as files
        FROM session
        WHERE id IN (${placeholders})
      `).all(...sessionIds);

      const codeChange = codeRows[0] || { additions: 0, deletions: 0, files: 0 };

      const todos = db.prepare(`
        SELECT content, status, priority
        FROM todo
        WHERE session_id IN (${placeholders})
        ORDER BY position
      `).all(...sessionIds);

      const lastActivity = db.prepare(`
        SELECT MAX(time_updated) as max_time
        FROM session
        WHERE id IN (${placeholders})
      `).get(...sessionIds);

      let status = 'active';
      if (todos.length > 0) {
        const allCompleted = todos.every(t => t.status === 'completed');
        status = allCompleted ? 'completed' : 'active';
      }

      const firstMsg = db.prepare(`
        SELECT substr(json_extract(pt.data, '$.text'), 1, 200) as text
        FROM part pt
        JOIN message m ON pt.message_id = m.id
        WHERE m.session_id IN (${placeholders})
          AND json_extract(pt.data, '$.type') = 'text'
          AND json_extract(m.data, '$.role') = 'user'
        ORDER BY pt.id ASC LIMIT 1
      `).get(...sessionIds);

      goals.push({
        id: goal.id,
        title: goal.title,
        status,
        sessionCount: sessionIds.length,
        userMessages: userMsgs,
        assistantMessages: assistantMsgs,
        todoStats: {
          total: todos.length,
          completed: todos.filter(t => t.status === 'completed').length,
          pending: todos.filter(t => t.status !== 'completed').length,
        },
        codeChanges: {
          additions: codeChange.additions,
          deletions: codeChange.deletions,
          files: codeChange.files,
        },
        lastActivity: lastActivity.max_time ? new Date(lastActivity.max_time).toISOString() : null,
        todos: todos.map(t => ({
          content: t.content,
          status: t.status,
          priority: t.priority,
        })),
        sessions: sessionIds.map(sid => {
          const session = db.prepare(`
            SELECT id, title, summary_additions, summary_deletions, summary_files, time_updated
            FROM session WHERE id = ?
          `).get(sid);
          if (!session) return null;

          const meta = sessionMeta[sid] || {};
          const firstMsg = db.prepare(`
            SELECT substr(json_extract(pt.data, '$.text'), 1, 200) as text
            FROM part pt
            JOIN message m ON pt.message_id = m.id
            WHERE m.session_id = ? AND json_extract(pt.data, '$.type') = 'text' AND json_extract(m.data, '$.role') = 'user'
            ORDER BY pt.id ASC LIMIT 1
          `).get(sid);

          return {
            id: session.id,
            title: session.title,
            agent: meta.agent || null,
            category: meta.category || null,
            timeUpdated: session.time_updated ? new Date(session.time_updated).toISOString() : null,
            firstUserMessage: firstMsg?.text || null,
            summaryAdditions: session.summary_additions || 0,
            summaryDeletions: session.summary_deletions || 0,
            summaryFiles: session.summary_files || 0,
          };
        }).filter(Boolean),
      });
    }

    goals.sort((a, b) => {
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    const allGoalTodos = goals.flatMap(g => g.todos);
    const projTodoStats = {
      total: allGoalTodos.length,
      completed: allGoalTodos.filter(t => t.status === 'completed').length,
      pending: allGoalTodos.filter(t => t.status !== 'completed').length,
    };
    const activePlan = boulder?.active_plan ? extractPlanName(boulder.active_plan) : null;
    const completedPlans = Array.isArray(boulder?.completed_plans)
      ? boulder.completed_plans.map(p => extractPlanName(p.plan)).filter(Boolean)
      : [];
    const latestMsg = db.prepare(`
      SELECT substr(json_extract(pt.data, '$.text'), 1, 200) as text
      FROM part pt
      JOIN message m ON pt.message_id = m.id
      JOIN (SELECT id FROM session WHERE project_id = ? ORDER BY time_updated DESC LIMIT 1) s
      ON m.session_id = s.id
      WHERE json_extract(pt.data, '$.type') = 'text' AND json_extract(m.data, '$.role') = 'user'
      ORDER BY pt.id DESC LIMIT 1
    `).get(projectId);

    res.json({
      success: true,
      data: {
        project: {
          id: proj.id,
          name: proj.name,
          path: proj.path,
          lastActivity: proj.last_activity ? new Date(proj.last_activity).toISOString() : null,
          sessionCount: goals.reduce((sum, g) => sum + g.sessionCount, 0),
          todoStats: projTodoStats,
          latestMessage: latestMsg?.text || null,
          activePlan,
          completedPlans,
        },
        goals,
      },
    });
  } catch (err) {
    console.error('[project-overview] /project/:id/goals error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
