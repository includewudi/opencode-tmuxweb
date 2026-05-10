const { pool, dbEnabled } = require('../db/pool');
const config = require('../config-loader');

const crypto = require('crypto');

const MAX_SESSION_USES = 10;
const MAX_SESSION_CACHE = 50;
const MAX_TRANSLATION_CACHE = 200;
const sessionCache = new Map();
const translationCache = new Map();

const SYSTEM_PROMPT = `你是终端内容的翻译助手。逐行中英对照翻译。
输出格式要求：对每一行有意义的英文内容，输出两行：
[EN] 原文
[ZH] 中文翻译
空行、纯符号行、纯数字行跳过不翻译。
保留技术术语原文（API、SDK、React、TypeScript 等）。
代码块内容不翻译，只翻译注释。
只输出 [EN]/[ZH] 配对，不要添加任何解释。`;

function getCachedSession(key) {
  const entry = sessionCache.get(key);
  if (!entry || entry.useCount >= MAX_SESSION_USES) {
    if (entry) sessionCache.delete(key);
    return null;
  }
  entry.useCount++;
  return entry.sessionId;
}

function putCachedSession(key, sessionId) {
  if (sessionCache.size >= MAX_SESSION_CACHE) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, val] of sessionCache) {
      if (val.createdAt < oldestTime) {
        oldestTime = val.createdAt;
        oldestKey = k;
      }
    }
    if (oldestKey !== null) sessionCache.delete(oldestKey);
  }
  sessionCache.set(key, { sessionId, useCount: 1, createdAt: Date.now() });
}

function getOcBase() {
  const ocConfig = config.openCodeServer || {};
  const host = ocConfig.host || process.env.OPENCODE_SERVER_HOST || '127.0.0.1';
  const port = ocConfig.port || process.env.OPENCODE_SERVER_PORT || 13460;
  return `http://${host}:${port}`;
}

function fetchLocal(url, init) {
  const prev = process.env.NO_PROXY;
  process.env.NO_PROXY = '127.0.0.1,localhost';
  return fetch(url, init).finally(() => {
    if (prev === undefined) delete process.env.NO_PROXY;
    else process.env.NO_PROXY = prev;
  });
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function extractText(data) {
  const parts = data?.value?.parts || data?.parts;
  if (!Array.isArray(parts)) return '';
  let text = '';
  for (const part of parts) {
    if (part.type === 'text' && part.text) text += part.text;
  }
  return text;
}

async function createPreloadedSession() {
  const ocBase = getOcBase();

  const sessionRes = await fetchLocal(`${ocBase}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'translator:en-zh' })
  });
  if (!sessionRes.ok) throw new Error(`OpenCode server unavailable: ${sessionRes.status}`);
  const { id: sessionId } = await sessionRes.json();

  fetchLocal(`${ocBase}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text: SYSTEM_PROMPT }], noReply: true })
  }).catch(() => {});

  return sessionId;
}

async function getOrCreateSession() {
  const key = 'translator';
  const cached = getCachedSession(key);
  if (cached) return cached;
  const sessionId = await createPreloadedSession();
  putCachedSession(key, sessionId);
  return sessionId;
}

async function translatePart(text) {
  const ocBase = getOcBase();
  const sessionId = await getOrCreateSession();

  const truncated = text.length > 4000 ? text.substring(0, 4000) : text;

  const res = await fetchLocal(`${ocBase}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: truncated }]
    })
  });

  if (!res.ok) {
    throw new Error(`Translation request failed: ${res.status}`);
  }

  const body = await res.text();
  let lastText = '';

  const json = tryParseJSON(body);
  if (json) {
    lastText = extractText(json);
  } else {
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = tryParseJSON(trimmed.slice(6));
      if (data) lastText = extractText(data);
    }
  }

  return lastText || truncated;
}

function extractTextParts(messages) {
  const parts = [];
  if (!Array.isArray(messages)) return parts;

  for (const msg of messages) {
    if (!msg.parts || !Array.isArray(msg.parts)) continue;
    for (const part of msg.parts) {
      if (part.type === 'text' && part.text && part.text.trim()) {
        parts.push({ partId: part.id || `msg-${msg.id}-part`, text: part.text });
      }
    }
  }
  return parts;
}

async function translateSession(sessionId, messages) {
  if (!dbEnabled || !pool) {
    console.log('[Translator] DB not enabled, skipping translation');
    return;
  }

  const targetLang = 'zh';
  const now = Math.floor(Date.now() / 1000);

  try {
    const [existing] = await pool.query(
      `SELECT id, job_status FROM cli_session_translation
       WHERE session_id = ? AND target_lang = ? AND is_deleted = 0`,
      [sessionId, targetLang]
    );

    if (existing.length > 0 && ['done', 'running'].includes(existing[0].job_status)) {
      console.log(`[Translator] Session ${sessionId} already ${existing[0].job_status}, skipping`);
      return;
    }

    const textParts = extractTextParts(messages);
    if (textParts.length === 0) {
      console.log(`[Translator] No text parts found for session ${sessionId}`);
      return;
    }

    let jobId;

    if (existing.length > 0) {
      jobId = existing[0].id;
      await pool.query(
        `UPDATE cli_session_translation
         SET job_status = 'running', total_parts = ?, translated_parts = 0,
             started_at = ?, mtime = ?
         WHERE id = ?`,
        [textParts.length, now, now, jobId]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO cli_session_translation
           (session_id, target_lang, job_status, total_parts, translated_parts,
            started_at, ctime, mtime)
         VALUES (?, ?, 'running', ?, 0, ?, ?, ?)`,
        [sessionId, targetLang, textParts.length, now, now, now]
      );
      jobId = result.insertId;
    }

    console.log(`[Translator] Starting translation for session ${sessionId}, ${textParts.length} parts`);

    const translatedParts = [];

    for (let i = 0; i < textParts.length; i++) {
      const part = textParts[i];
      try {
        const translated = await translatePart(part.text);
        translatedParts.push({ partId: part.partId, text: translated });

        await pool.query(
          `UPDATE cli_session_translation
           SET translated_parts = ?, parts_json = ?, mtime = ?
           WHERE id = ?`,
          [i + 1, JSON.stringify(translatedParts), Math.floor(Date.now() / 1000), jobId]
        );
      } catch (partErr) {
        console.error(`[Translator] Part ${i} failed for session ${sessionId}:`, partErr.message);
        translatedParts.push({ partId: part.partId, text: part.text, error: partErr.message });

        await pool.query(
          `UPDATE cli_session_translation
           SET translated_parts = ?, parts_json = ?, mtime = ?
           WHERE id = ?`,
          [i + 1, JSON.stringify(translatedParts), Math.floor(Date.now() / 1000), jobId]
        );
      }
    }

    const doneNow = Math.floor(Date.now() / 1000);
    await pool.query(
      `UPDATE cli_session_translation
       SET job_status = 'done', parts_json = ?, completed_at = ?, mtime = ?
       WHERE id = ?`,
      [JSON.stringify(translatedParts), doneNow, doneNow, jobId]
    );

    console.log(`[Translator] Completed translation for session ${sessionId}, ${translatedParts.length} parts`);
  } catch (err) {
    console.error(`[Translator] Translation failed for session ${sessionId}:`, err);
    try {
      await pool.query(
        `UPDATE cli_session_translation
         SET job_status = 'error', job_error = ?, mtime = ?
         WHERE session_id = ? AND target_lang = ? AND is_deleted = 0`,
        [err.message, Math.floor(Date.now() / 1000), sessionId, targetLang]
      );
    } catch (dbErr) {
      console.error('[Translator] Failed to update error status:', dbErr.message);
    }
  }
}

async function translatePaneText(text) {
  if (!text || !text.trim()) return '';

  const trimmed = text.trimEnd();
  const hash = crypto.createHash('md5').update(trimmed).digest('hex');

  if (dbEnabled && pool) {
    try {
      const [rows] = await pool.query(
        'SELECT translated FROM pane_translation_cache WHERE content_hash = ?',
        [hash]
      );
      if (rows.length > 0) {
        await pool.query(
          'UPDATE pane_translation_cache SET atime = ?, hit_count = hit_count + 1 WHERE content_hash = ?',
          [Math.floor(Date.now() / 1000), hash]
        );
        console.log(`[Translator] Cache hit for pane ${hash.slice(0, 8)}`);
        return rows[0].translated;
      }
    } catch (e) {
      console.error('[Translator] Cache lookup failed:', e.message);
    }
  }

  const CHUNK_SIZE = 4000;
  let translated;
  if (trimmed.length <= CHUNK_SIZE) {
    translated = await translatePart(trimmed);
  } else {
    const chunks = [];
    let current = '';
    for (const line of trimmed.split('\n')) {
      if (current.length + line.length + 1 > CHUNK_SIZE && current.length > 0) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) chunks.push(current);
    const results = [];
    for (const chunk of chunks) {
      results.push(await translatePart(chunk));
    }
    translated = results.join('\n');
  }

  if (dbEnabled && pool) {
    try {
      const now = Math.floor(Date.now() / 1000);
      await pool.query(
        'INSERT IGNORE INTO pane_translation_cache (content_hash, original_hash, original, translated, ctime, atime) VALUES (?, ?, ?, ?, ?, ?)',
        [hash, hash, trimmed, translated, now, now]
      );
    } catch (e) {
      console.error('[Translator] Cache write failed:', e.message);
    }
  }

  return translated;
}

module.exports = { translateSession, translatePaneText };
