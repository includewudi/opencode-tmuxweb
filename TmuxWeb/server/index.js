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
const { handleTerminalConnection } = require('./services/terminal');
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

const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const paneId = url.searchParams.get('paneId');

  if (!validateToken(token)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  if (!paneId) {
    ws.close(4002, 'Missing paneId');
    return;
  }

  handleTerminalConnection(ws, paneId);
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
