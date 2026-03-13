const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const config = require('./config-loader');
const { tokenMiddleware, validateToken } = require('./middleware/auth');
const { requireDb } = require('./middleware/db');
const { router: authRouter } = require('./routes/auth');
const tmuxRouter = require('./routes/tmux');
const tasksRouter = require('./routes/tasks');
const tasksDbRouter = require('./routes/tasks-db');
const groupsRouter = require('./routes/groups');
const sessionsRouter = require('./routes/sessions');
const panesRouter = require('./routes/panes');
const profilesRouter = require('./routes/profiles');
const segmentsRouter = require('./routes/segments');
const { taskSummariesRouter, paneSummariesRouter } = require('./routes/summaries');
const taskEventsRouter = require('./routes/task-events');
const telemetryRouter = require('./routes/telemetry');
const aiRouter = require('./routes/ai');
const { router: rolesRouter } = require('./routes/roles');
const snippetsRouter = require('./routes/snippets');
const hotwordsRouter = require('./routes/hotwords');
const opencodeConfigRouter = require('./routes/opencode-config');
const butlerProxyRouter = require('./routes/butler-proxy');
const capabilitiesRouter = require('./routes/capabilities');
const uploadRouter = require('./routes/upload');
// Terminal mode: 'pty' (default, one PTY per pane) or 'controlmode' (single PTY via tmux -C)
const terminalMode = config.terminalMode || 'pty';
const terminalModule = terminalMode === 'controlmode'
  ? require('./services/terminal-controlmode')
  : require('./services/terminal');
const { handleTerminalConnection, getStats } = terminalModule;
console.log(`[Server] Terminal mode: ${terminalMode}`);
const { handleSpeechConnection } = require('./services/speech');
const { pool, dbEnabled, testConnection } = require('./db/pool');
const { bootstrap } = require('./db/bootstrap');

const app = express();

const CERT_FILE = path.join(__dirname, 'cert.pem');
const KEY_FILE = path.join(__dirname, 'key.pem');
const hasCerts = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);

const server = hasCerts
  ? https.createServer({ cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) }, app)
  : http.createServer(app);
const PROTOCOL = hasCerts ? 'https' : 'http';

app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/healthz', async (req, res) => {
  const timestamp = new Date().toISOString();
  if (!pool) {
    return res.json({ status: 'ok', db: 'not configured', timestamp });
  }
  try {
    const [rows] = await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', timestamp });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', error: err.message, timestamp });
  }
});

app.use('/api/capabilities', capabilitiesRouter);
app.use('/api/auth', authRouter);
app.use('/api/tasks/events', taskEventsRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/tmux', tokenMiddleware, tmuxRouter);
app.use('/api/groups', tokenMiddleware, requireDb, groupsRouter);
app.use('/api/sessions', tokenMiddleware, requireDb, sessionsRouter);
// Pane routes: status (panes.js), task CRUD (tasks-db.js)
app.use('/api/panes', tokenMiddleware, requireDb, panesRouter);        // GET/PUT /status
app.use('/api/panes', tokenMiddleware, requireDb, tasksDbRouter);      // /:paneKey/tasks
app.use('/api/panes', tokenMiddleware, requireDb, paneSummariesRouter); // /:paneKey/summary
app.use('/api/profiles', tokenMiddleware, requireDb, profilesRouter);
app.use('/api/segments', tokenMiddleware, requireDb, segmentsRouter);
app.use('/api/ai', tokenMiddleware, aiRouter);
app.use('/api/roles', tokenMiddleware, rolesRouter);
app.use('/api/snippets', tokenMiddleware, snippetsRouter);
app.use('/api/hotwords', tokenMiddleware, hotwordsRouter);
app.use('/api/opencode-config', tokenMiddleware, opencodeConfigRouter);
app.use('/api/butler', tokenMiddleware, butlerProxyRouter);
app.use('/api/upload', tokenMiddleware, uploadRouter);

// Task routes: task CRUD (tasks-db.js), summaries
app.use('/api/tasks', tokenMiddleware, requireDb, tasksDbRouter);       // /:id, /:id/complete, /:id/detail
app.use('/api/tasks', tokenMiddleware, requireDb, taskSummariesRouter); // /summaries

// PTY debug endpoint
app.get('/api/debug/pty-status', tokenMiddleware, (req, res) => {
  res.json(getStats());
});

// Serve uploaded files (auth not required for direct URL access)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Hashed assets get long-lived cache; index.html must not be cached
// to ensure browsers always fetch fresh HTML after each build.
app.use(express.static(path.join(__dirname, '../web/dist'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// SPA fallback: serve index.html for all non-API routes so client-side
// routing (e.g. /m for mobile, / for desktop) works on direct navigation.
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
});

// Use noServer mode to avoid multiple WebSocketServer conflict
// See: docs/errors/ws-multiple-websocketserver-rsv1-error.md
const terminalWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const speechWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

// Manually handle HTTP upgrade to route to correct WebSocketServer
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/speech') {
    speechWss.handleUpgrade(request, socket, head, (ws) => {
      speechWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

terminalWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const paneId = url.searchParams.get('paneId');
  const clientId = url.searchParams.get('clientId') || null;

  console.log(`[WS] Connection attempt: paneId=${paneId}, token=${token ? 'present' : 'missing'}, from=${req.socket.remoteAddress}`);

  if (!validateToken(token)) {
    console.log(`[WS] Rejected: invalid token`);
    ws.close(4001, 'Unauthorized');
    return;
  }

  if (!paneId) {
    console.log(`[WS] Rejected: missing paneId`);
    ws.close(4002, 'Missing paneId');
    return;
  }

  console.log(`[WS] Accepted: paneId=${paneId}`);
  handleTerminalConnection(ws, paneId, clientId);
});

speechWss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!validateToken(token)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  handleSpeechConnection(ws);
});

server.listen(config.port, config.bind, () => {
  console.log(`TmuxWeb backend listening on ${PROTOCOL}://${config.bind}:${config.port}`);

  if (dbEnabled) {
    // Auto-create tables, then verify connection
    bootstrap().then(() => {
      return testConnection();
    }).then(ok => {
      if (ok) {
        console.log('[DB] Database connection verified');
      } else {
        console.warn('[DB] Database connection failed — server running in degraded mode');
      }
    });
  } else {
    console.log('[DB] No database configured — task tracking, profiles, groups stored in-memory only');
  }
});

if (hasCerts) {
  const CA_ROOT = path.join(require('os').homedir(), 'Library/Application Support/mkcert/rootCA.pem');
  const CERT_PORT = config.certPort || (config.port + 65);
  http.createServer((req, res) => {
    if (req.url === '/rootCA.pem' && fs.existsSync(CA_ROOT)) {
      res.writeHead(200, {
        'Content-Type': 'application/x-pem-file',
        'Content-Disposition': 'attachment; filename="rootCA.pem"',
      });
      fs.createReadStream(CA_ROOT).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body style="font-family:system-ui;text-align:center;padding:60px 20px;background:#1a1c20;color:#fff">
        <h2>Install CA Certificate</h2>
        <p style="color:#aaa">Open this page in Safari on iPhone</p>
        <a href="/rootCA.pem" style="display:inline-block;margin:20px;padding:16px 32px;background:#4d78cc;color:#fff;border-radius:12px;text-decoration:none;font-size:18px">Download CA Certificate</a>
        <p style="color:#888;font-size:14px;margin-top:30px">After download: Settings → Downloaded Profile → Install<br>Then: Settings → General → About → Certificate Trust Settings → Enable</p>
      </body></html>`);
    }
  }).listen(CERT_PORT, '0.0.0.0', () => {
    console.log(`[Server] CA cert download at http://0.0.0.0:${CERT_PORT}`);
  });
}
