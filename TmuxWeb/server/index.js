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
const { handleTerminalConnection, getStats } = require('./services/terminal');
const { handleSpeechConnection } = require('./services/speech');
const { pool, testConnection } = require('./db/pool');

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
  try {
    const [rows] = await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', timestamp });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', error: err.message, timestamp });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/tasks/events', taskEventsRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/tmux', tokenMiddleware, tmuxRouter);
app.use('/api/tasks', tokenMiddleware, tasksDbRouter);
app.use('/api/groups', tokenMiddleware, groupsRouter);
app.use('/api/sessions', tokenMiddleware, sessionsRouter);
app.use('/api/panes', tokenMiddleware, tasksDbRouter);
app.use('/api/panes', tokenMiddleware, panesRouter);
app.use('/api/profiles', tokenMiddleware, profilesRouter);
app.use('/api/segments', tokenMiddleware, segmentsRouter);
app.use('/api/tasks', tokenMiddleware, taskSummariesRouter);
app.use('/api/panes', tokenMiddleware, paneSummariesRouter);
app.use('/api/ai', tokenMiddleware, aiRouter);
app.use('/api/roles', tokenMiddleware, rolesRouter);
app.use('/api/snippets', tokenMiddleware, snippetsRouter);
app.use('/api/hotwords', tokenMiddleware, hotwordsRouter);

// PTY debug endpoint
app.get('/api/debug/pty-status', tokenMiddleware, (req, res) => {
  res.json(getStats());
});

app.use(express.static(path.join(__dirname, '../web/dist')));

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
  handleTerminalConnection(ws, paneId);
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
  
  testConnection().then(ok => {
    if (ok) {
      console.log('[DB] Database connection verified');
    } else {
      console.warn('[DB] Database connection failed - server running in degraded mode');
    }
  });
});

if (hasCerts) {
  const CA_ROOT = path.join(require('os').homedir(), 'Library/Application Support/mkcert/rootCA.pem');
  const CERT_PORT = 8280;
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
