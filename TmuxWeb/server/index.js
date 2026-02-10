const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const config = require('./config.json');
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
const { handleTerminalConnection } = require('./services/terminal');
const { handleSpeechConnection } = require('./services/speech');
const { pool, testConnection } = require('./db/pool');

const app = express();
const server = http.createServer(app);

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
  console.log(`TmuxWeb backend listening on http://${config.bind}:${config.port}`);
  
  testConnection().then(ok => {
    if (ok) {
      console.log('[DB] Database connection verified');
    } else {
      console.warn('[DB] Database connection failed - server running in degraded mode');
    }
  });
});
