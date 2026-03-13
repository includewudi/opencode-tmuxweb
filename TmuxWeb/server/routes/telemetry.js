const express = require('express');
const fsp = require('fs').promises;
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../backend/data/telemetry');
const NDJSON_FILE = path.join(DATA_DIR, 'mobile-telemetry.ndjson');
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function requireDebug(req, res, next) {
  if (req.query.debug === '1') {
    return next();
  }
  return res.status(403).json({ error: 'Debug mode required' });
}

router.use(requireDebug);

async function ensureDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function rotateIfNeeded() {
  try {
    const stat = await fsp.stat(NDJSON_FILE);
    if (stat.size > MAX_FILE_SIZE) {
      const now = new Date();
      const ts = now.getFullYear().toString()
        + String(now.getMonth() + 1).padStart(2, '0')
        + String(now.getDate()).padStart(2, '0')
        + '-'
        + String(now.getHours()).padStart(2, '0')
        + String(now.getMinutes()).padStart(2, '0')
        + String(now.getSeconds()).padStart(2, '0');
      const rotatedPath = path.join(DATA_DIR, `mobile-telemetry-${ts}.ndjson`);
      await fsp.rename(NDJSON_FILE, rotatedPath);
      console.log(`[telemetry] Rotated log to ${path.basename(rotatedPath)}`);
    }
  } catch (err) {
    // ENOENT = file not yet created, safe to skip rotation
    if (err.code !== 'ENOENT') throw err;
  }
}

router.post('/', async (req, res) => {
  try {
    await ensureDir();
    await rotateIfNeeded();

    const body = req.body;
    let events;

    if (body && Array.isArray(body.events)) {
      events = body.events;
    } else if (body && typeof body === 'object' && !Array.isArray(body)) {
      events = [body];
    } else {
      return res.status(400).json({ error: 'Expected {"events":[...]} or single event object' });
    }

    const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';

    await fsp.appendFile(NDJSON_FILE, lines, 'utf8');
    return res.status(204).end();
  } catch (err) {
    console.error('[telemetry] POST error:', err.message);
    return res.status(500).json({ error: 'Failed to write telemetry' });
  }
});

router.get('/', async (req, res) => {
  try {
    const tail = parseInt(req.query.tail, 10) || 500;

    let content;
    try {
      content = await fsp.readFile(NDJSON_FILE, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json([]);
      }
      throw err;
    }

    const lines = content.trim().split('\n').filter(l => l.length > 0);
    const lastN = lines.slice(-tail);
    const events = [];

    for (const line of lastN) {
      try {
        events.push(JSON.parse(line));
      } catch (parseErr) {
      }
    }

    return res.json(events);
  } catch (err) {
    console.error('[telemetry] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to read telemetry' });
  }
});

router.post('/clear', async (req, res) => {
  try {
    await ensureDir();
    await fsp.writeFile(NDJSON_FILE, '', 'utf8');
    return res.status(204).end();
  } catch (err) {
    console.error('[telemetry] CLEAR error:', err.message);
    return res.status(500).json({ error: 'Failed to clear telemetry' });
  }
});

module.exports = router;
