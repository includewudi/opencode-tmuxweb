const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const config = require('./config');
const { tokenMiddleware, validateToken } = require('./middleware/auth');
const { router: authRouter } = require('./routes/auth');
const tmuxRouter = require('./routes/tmux');
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
const { handleSpeechConnection } = require('./speech');
const { pool, testConnection } = require('./db/pool');

// --- Constants ---
const PORT = process.env.PORT || config.port || 8215;
const APP_DIST = path.join(__dirname, 'app/dist');
const PTY_HELPER = path.join(__dirname, 'pty_helper.py');
const CERT_FILE = path.join(__dirname, 'cert.pem');
const KEY_FILE = path.join(__dirname, 'key.pem');
const clientLogs = []; // Remote client logs buffer

// --- HTTPS / HTTP server ---
const hasCerts = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);
const app = express();
const server = hasCerts
    ? https.createServer({ cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) }, app)
    : http.createServer(app);
const PROTOCOL = hasCerts ? 'https' : 'http';

app.use(cors({
  origin: config.allowedOrigins || '*',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// --- Health ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Tmux Config ---
function getTmuxPrefix() {
  try {
    const prefix = execSync('tmux show-option -gv prefix', { encoding: 'utf8', timeout: 2000 }).trim();
    const match = prefix.match(/^C-(.)$/);
    if (match) {
      const key = match[1].toUpperCase();
      const ctrlCode = String.fromCharCode(key.charCodeAt(0) - 64);
      return { prefix, key, code: ctrlCode, label: `Ctrl+${key}` };
    }
    return { prefix, key: null, code: '\x02', label: 'Ctrl+B (default)' };
  } catch (e) {
    return { prefix: 'C-b', key: 'B', code: '\x02', label: 'Ctrl+B (default)' };
  }
}

app.get('/api/tmux-config', (req, res) => {
  res.json(getTmuxPrefix());
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

// --- No-auth routes ---
app.use('/api/auth', authRouter);
app.use('/api/tasks/events', taskEventsRouter);
app.use('/api/telemetry', telemetryRouter);

// --- Existing features (no auth — backward compat) ---

// Tmux sessions listing (existing format for current frontend)
app.get('/api/sessions', (req, res) => {
  const sessions = getTmuxSessions();
  res.json({ sessions });
});

// Client remote logging
app.post('/api/log', (req, res) => {
  const entry = req.body;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[CLIENT ${ts}] ${entry.level || 'info'}: ${entry.message}`, entry.data || '');
  clientLogs.push({ ts, ...entry });
  if (clientLogs.length > 100) clientLogs.splice(0, clientLogs.length - 100);
  res.json({ ok: true });
});

app.get('/api/logs', (req, res) => {
  res.json(clientLogs.slice(-50));
});

// AI command generation
app.post('/api/ai/command', async (req, res) => {
  try {
    const { prompt, role } = req.body;
    const result = await generateAiCommand(prompt, role);
    res.json(result);
  } catch (e) {
    res.status(500).json({ command: '', explanation: '生成失败: ' + e.message });
  }
});

// Custom roles CRUD
const CUSTOM_ROLES_FILE = path.join(__dirname, 'custom_roles.json');
function loadCustomRoles() {
  try {
    if (fs.existsSync(CUSTOM_ROLES_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_ROLES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Roles] Failed to load custom_roles.json:', e.message);
  }
  return [];
}
function saveCustomRoles(roles) {
  fs.writeFileSync(CUSTOM_ROLES_FILE, JSON.stringify(roles, null, 2), 'utf8');
}

app.get('/api/roles', (req, res) => {
  const builtinList = Object.keys(ROLE_DEFS).map(id => ({ id, ...ROLE_DEFS[id], builtin: true }));
  const customList = loadCustomRoles().map(r => ({ ...r, builtin: false }));
  res.json({ roles: [...builtinList, ...customList] });
});

app.post('/api/roles', (req, res) => {
  const { id, emoji, label, desc, prompt, suffix } = req.body;
  if (!id || !prompt || !suffix) return res.status(400).json({ error: 'id, prompt, suffix 必填' });
  if (ROLE_DEFS[id]) return res.status(400).json({ error: '不能覆盖内置角色' });
  const customs = loadCustomRoles().filter(r => r.id !== id);
  customs.push({ id, emoji: emoji || '🤖', label: label || id, desc: desc || '', prompt, suffix });
  saveCustomRoles(customs);
  res.json({ ok: true });
});

app.put('/api/roles/:roleId', (req, res) => {
  const { roleId } = req.params;
  if (ROLE_DEFS[roleId]) return res.status(400).json({ error: '不能编辑内置角色' });
  const customs = loadCustomRoles();
  const idx = customs.findIndex(r => r.id === roleId);
  if (idx === -1) return res.status(404).json({ error: '角色不存在' });
  customs[idx] = { ...customs[idx], ...req.body, id: roleId };
  saveCustomRoles(customs);
  res.json({ ok: true });
});

app.delete('/api/roles/:roleId', (req, res) => {
  const { roleId } = req.params;
  if (ROLE_DEFS[roleId]) return res.status(400).json({ error: '不能删除内置角色' });
  const customs = loadCustomRoles().filter(r => r.id !== roleId);
  saveCustomRoles(customs);
  res.json({ ok: true });
});

// Snippets CRUD
const SNIPPETS_FILE = path.join(__dirname, 'snippets.json');
function loadSnippets() {
  try {
    if (fs.existsSync(SNIPPETS_FILE)) return JSON.parse(fs.readFileSync(SNIPPETS_FILE, 'utf-8'));
  } catch {}
  return [];
}
function saveSnippets(arr) { fs.writeFileSync(SNIPPETS_FILE, JSON.stringify(arr, null, 2)); }

app.get('/api/snippets', (req, res) => { res.json(loadSnippets()); });

app.post('/api/snippets', (req, res) => {
  const { name, command } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });
  const snippets = loadSnippets();
  snippets.push({ name: name || command.slice(0, 30), command, createdAt: Date.now() });
  saveSnippets(snippets);
  res.json({ ok: true });
});

app.delete('/api/snippets', (req, res) => {
  const idx = parseInt(req.query.index, 10);
  const snippets = loadSnippets();
  if (idx >= 0 && idx < snippets.length) {
    snippets.splice(idx, 1);
    saveSnippets(snippets);
  }
  res.json({ ok: true });
});

// --- Token-protected TmuxWeb routes ---
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

// Static files + SPA fallback
app.use(express.static(APP_DIST));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();
  const indexPath = path.join(APP_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found: ' + req.path);
  }
});

const terminalWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const speechWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const legacyWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = parsedUrl.pathname;
  
  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/speech') {
    speechWss.handleUpgrade(request, socket, head, (ws) => {
      speechWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws') {
    legacyWss.handleUpgrade(request, socket, head, (ws) => {
      legacyWss.emit('connection', ws, request);
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

// Legacy /ws?target=... handler (existing frontend uses this for PTY via pty_helper.py)
legacyWss.on('connection', (ws, req) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/ws' && parsedUrl.searchParams.has('speech')) {
    handleSpeechConnection(ws);
    return;
  }

  const target = parsedUrl.searchParams.get('target');
  console.log('[WS] Legacy client connected, target:', target || 'new shell');

  const shell = process.env.SHELL || '/bin/zsh';
  const proc = spawn('python3', [PTY_HELPER, shell, '80', '24'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.env.HOME,
  });

  console.log('[Shell] Spawned PID:', proc.pid);

  if (target) {
    setTimeout(() => {
      if (!proc.killed && proc.stdin.writable) {
        proc.stdin.write(`tmux attach-session -t '${target}' 2>/dev/null || echo 'Could not attach to ${target}'\n`);
      }
    }, 300);
  }

  proc.stdout.on('data', (data) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'output', data: data.toString('utf8') }));
    }
  });

  proc.stderr.on('data', (data) => {
    console.error('[Shell stderr]', data.toString());
  });

  proc.on('close', (code) => {
    console.log('[Shell] Exited, code:', code);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'output', data: '\r\n[Session ended]\r\n' }));
      ws.close();
    }
  });

  proc.on('error', (err) => {
    console.error('[Shell] Error:', err.message);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'output', data: '\r\nShell error: ' + err.message + '\r\n' }));
      ws.close();
    }
  });

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      switch (parsed.type) {
        case 'input':
          if (!proc.killed && proc.stdin.writable) proc.stdin.write(parsed.data);
          break;
        case 'resize':
          if (!proc.killed && proc.stdin.writable && parsed.cols && parsed.rows) {
            proc.stdin.write(`\x1b]resize;${parsed.cols};${parsed.rows}\x07`);
          }
          break;
      }
    } catch (e) {
      if (!proc.killed && proc.stdin.writable) proc.stdin.write(msg.toString());
    }
  });

  ws.on('close', () => {
    console.log('[WS] Legacy client disconnected');
    if (!proc.killed) proc.kill('SIGTERM');
  });
});

// --- Start server ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] ${PROTOCOL.toUpperCase()} at ${PROTOCOL}://localhost:${PORT}`);
  console.log(`[Server] Static files from: ${APP_DIST}`);
  
  testConnection().then(ok => {
    if (ok) {
      console.log('[DB] Database connection verified');
    } else {
      console.warn('[DB] Database connection failed - server running in degraded mode');
    }
  });
});

// CA cert download server (iPhone needs HTTP to install CA before trusting HTTPS)
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
          <h2>📜 安装 CA 证书</h2>
          <p style="color:#aaa">iPhone 用 Safari 打开此页面</p>
          <a href="/rootCA.pem" style="display:inline-block;margin:20px;padding:16px 32px;background:#4d78cc;color:#fff;border-radius:12px;text-decoration:none;font-size:18px">下载 CA 证书</a>
          <p style="color:#888;font-size:14px;margin-top:30px">下载后：设置 → 已下载描述文件 → 安装<br>然后：设置 → 通用 → 关于本机 → 证书信任设置 → 启用</p>
      </body></html>`);
    }
  }).listen(CERT_PORT, '0.0.0.0', () => {
    console.log(`[Server] CA cert download at http://localhost:${CERT_PORT}`);
  });
}

// --- Tmux Session API (existing) ---
function getTmuxSessions() {
  try {
    const sessionsRaw = execSync(
      "tmux list-sessions -F '#{session_id}|#{session_name}|#{session_windows}|#{session_attached}'",
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (!sessionsRaw) return [];

    const sessions = sessionsRaw.split('\n').map(line => {
      const [id, name, windowCount, attached] = line.split('|');
      return {
        id: id.trim(), name: name.trim(),
        windowCount: parseInt(windowCount) || 0,
        attached: attached === '1', windows: [],
      };
    });

    for (const session of sessions) {
      try {
        const windowsRaw = execSync(
          `tmux list-windows -t '${session.name}' -F '#{window_id}|#{window_index}|#{window_name}|#{window_panes}|#{window_active}'`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();

        if (windowsRaw) {
          session.windows = windowsRaw.split('\n').map(line => {
            const [wId, wIndex, wName, paneCount, wActive] = line.split('|');
            return {
              id: wId.trim(), index: parseInt(wIndex) || 0,
              name: wName.trim(), paneCount: parseInt(paneCount) || 0,
              active: wActive === '1', panes: [],
            };
          });

          for (const win of session.windows) {
            try {
              const panesRaw = execSync(
                `tmux list-panes -t '${session.name}:${win.index}' -F '#{pane_id}|#{pane_index}|#{pane_title}|#{pane_current_command}|#{pane_active}'`,
                { encoding: 'utf8', timeout: 5000 }
              ).trim();

              if (panesRaw) {
                win.panes = panesRaw.split('\n').map(line => {
                  const [pId, pIndex, pTitle, pCmd, pActive] = line.split('|');
                  return {
                    id: pId.trim(), index: parseInt(pIndex) || 0,
                    title: pTitle.trim(), command: pCmd.trim(),
                    active: pActive === '1',
                    target: `${session.name}:${win.index}.${pIndex.trim()}`,
                  };
                });
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    return sessions;
  } catch (e) {
    console.log('[API] tmux not available or no sessions:', e.message);
    return [];
  }
}

// --- Role Definitions (existing) ---
const ROLE_DEFS = {
  cli: {
    emoji: '🖥️', label: '命令行大神', desc: '生成可执行的终端命令',
    prompt: '你是一位资深 Linux/macOS 命令行专家，拥有 20 年系统管理经验。\n精通 Bash/Zsh 脚本、awk/sed/grep/find/xargs 文本处理、管道组合、进程管理、文件系统操作、网络调试。\n了解 macOS brew、systemd、cron 等工具链。\n\n规则：\n1. 优先 POSIX 兼容语法，必要时标注 bash/zsh 特有语法\n2. 危险命令（rm -rf、dd 等）必须加 # ⚠️ 注释\n3. 多步骤用 && 连接或多行脚本\n4. 多种方案选最简洁的',
    suffix: '请只返回可直接执行的命令，不要加解释。多条命令用 && 或换行连接。危险命令加 # ⚠️ 注释。'
  },
  ops: {
    emoji: '🔧', label: '运维专家', desc: '优化 DevOps/运维提示词',
    prompt: '你是资深 DevOps/SRE 运维提示词优化专家。\n精通 Docker、Kubernetes、Nginx/Caddy、systemd、CI/CD（GitHub Actions）、Terraform/Ansible、监控（Prometheus/Grafana）。\n\n优化时确保：\n1. 指定目标环境（开发/测试/生产）\n2. 安全最佳实践（最小权限、密钥管理）\n3. 高可用、容灾、回滚方案\n4. 监控告警和日志需求\n5. 幂等性和自动化',
    suffix: '请将运维需求优化为适合 AI 助手生成 DevOps 方案的提示词。直接输出，Markdown 格式，不要解释。'
  },
  prompt: {
    emoji: '✨', label: '提示词优化', desc: '通用 AI 提示词优化',
    prompt: '你是一位顶级 AI 提示词工程师。擅长将模糊需求转化为高质量结构化提示词。\n精通 OpenAI/Claude/Gemini/DeepSeek 模型的提示词最佳实践、Chain-of-Thought、Few-shot、Role-playing 技术、结构化输出控制。\n\n优化原则：\n1. 明确角色定义（Role）和任务目标（Task）\n2. 清晰的输出格式要求（Format）\n3. 加入约束条件和边界（Constraints）\n4. 必要时附带示例（Examples）\n5. Markdown 结构化组织',
    suffix: '请将用户的输入优化为一个高质量的 AI 提示词。直接输出优化后的提示词，Markdown 格式。不要解释优化过程。'
  },
  frontend: {
    emoji: '🎨', label: '前端优化', desc: '前端开发提示词优化',
    prompt: '你是资深前端开发 AI 提示词优化专家。\n了解 React/Vue/Svelte/Next.js、Tailwind CSS/CSS Modules、Vite/TypeScript、Jest/Playwright、Zustand/Redux、shadcn/ui/Ant Design。\n\n优化时确保：\n1. 指定技术栈和版本\n2. 明确组件结构和数据流\n3. 考虑响应式、可访问性、性能\n4. 包含错误处理和边界情况',
    suffix: '请将需求优化为适合 AI 编程助手（Cursor/Copilot/Gemini）使用的前端开发提示词。直接输出，Markdown 格式，不要解释。'
  },
  backend: {
    emoji: '⚙️', label: '后端优化', desc: '后端开发提示词优化',
    prompt: '你是资深后端开发 AI 提示词优化专家。\n了解 Node.js/Python/Go/Java/Rust、Express/FastAPI/Gin、PostgreSQL/MongoDB/Redis、RabbitMQ/Kafka、RESTful/GraphQL/gRPC、Docker/K8s/AWS。\n\n优化时确保：\n1. 明确 API 接口设计和数据模型\n2. 考虑安全性（认证、授权、输入校验）\n3. 包含错误处理、日志、监控\n4. 考虑并发、性能、可扩展性',
    suffix: '请将需求优化为适合 AI 编程助手使用的后端开发提示词。直接输出，Markdown 格式，不要解释。'
  },
  ui: {
    emoji: '🎭', label: 'UI优化', desc: 'UI/UX 设计提示词优化',
    prompt: '你是资深 UI/UX 设计 AI 提示词优化专家。\n精通 Material Design 3、Apple HIG、Glassmorphism/Neumorphism/暗黑模式、Figma/Midjourney/DALL-E、Framer Motion/Lottie/CSS Animation、响应式和移动优先设计。\n\n优化时确保：\n1. 明确设计风格和色彩方案\n2. 描述布局结构和组件层级\n3. 指定交互行为和动画效果\n4. 考虑暗色/亮色主题适配',
    suffix: '请将需求优化为适合 AI 设计工具或前端实现的 UI 设计提示词。直接输出，Markdown 格式，不要解释。'
  },
  api: {
    emoji: '🔄', label: 'API转换', desc: 'API 架构转换与重构',
    prompt: '你是资深 API 架构师和转换专家。\n精通 RESTful/GraphQL/gRPC/WebSocket API 范式，OpenAPI/Swagger 规范。\n\n核心能力：\n1. API 模式互转：REST ↔ GraphQL ↔ gRPC\n2. 代码重构：单体 → 微服务、回调 → async/await\n3. 协议升级：HTTP/1.1 → HTTP/2、WebSocket\n4. SDK 生成：OpenAPI spec → 多语言客户端\n5. 数据格式转换：JSON ↔ Protobuf ↔ XML\n\n输出要求：转换前后对比、标注 breaking changes、提供迁移步骤',
    suffix: '请将 API 转换需求优化为清晰的技术提示词，包含源格式、目标格式、约束条件。直接输出，Markdown 格式，不要解释。'
  },
};

function getAllRoleDefs() {
  const merged = { ...ROLE_DEFS };
  for (const r of loadCustomRoles()) {
    merged[r.id] = { prompt: r.prompt, suffix: r.suffix };
  }
  return merged;
}

async function generateAiCommand(prompt, role) {
  const allDefs = getAllRoleDefs();
  const roleDef = allDefs[role] || ROLE_DEFS.cli;
  const systemPrompt = roleDef.prompt + '\n\n' + roleDef.suffix;

  const roleConfig = config.llm?.roles?.[role] || {};
  const defaultApiKey = process.env.LLM_API_KEY || config.llm?.apiKey;
  const defaultApiUrl = process.env.LLM_API_URL || config.llm?.apiUrl || 'https://api.deerapi.com/v1/chat/completions';
  const defaultModel = process.env.LLM_MODEL || config.llm?.model || 'deepseek-v3.2';

  const apiKey = roleConfig.apiKey || defaultApiKey;
  const apiUrl = roleConfig.apiUrl || defaultApiUrl;
  const model = roleConfig.model || defaultModel;

  console.log('[LLM] Request:', { prompt, role, model, apiUrl: apiUrl.replace(/\/chat.*/, '/...'), hasRoleOverride: !!config.llm?.roles?.[role] });

  if (!apiKey) {
    return {
      command: prompt.trim(),
      explanation: '⚠️ 未配置 LLM API。在 config_private.json 中设置 llm.apiKey 后可启用 AI 生成。',
    };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  if (data.error) {
    return { command: '', explanation: 'API 错误: ' + (data.error.message || JSON.stringify(data.error)) };
  }

  const content = data.choices?.[0]?.message?.content?.trim() || '';
  const codeMatch = content.match(/```(?:\w+)?\n?([\s\S]*?)```/);
  const command = codeMatch ? codeMatch[1].trim() : content;
  return { command, explanation: `[${role}] ${model}` };
}
