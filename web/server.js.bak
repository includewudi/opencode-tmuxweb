const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const WebSocket = require('ws');
const url = require('url');
const { handleSpeechConnection } = require('./speech');
const config = require('./config');

const PORT = process.env.PORT || config.port || 8215;
const UI_DIR = path.join(__dirname, '../VoiceTmuxApp/Sources/XTerminalUI');
const APP_DIST = path.join(__dirname, 'app/dist');
const PTY_HELPER = path.join(__dirname, 'pty_helper.py');
const clientLogs = []; // Remote client logs buffer
const CERT_FILE = path.join(__dirname, 'cert.pem');
const KEY_FILE = path.join(__dirname, 'key.pem');

// Use HTTPS if certs exist, otherwise plain HTTP
const hasCerts = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);
const server = hasCerts
    ? https.createServer({ cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) }, requestHandler)
    : http.createServer(requestHandler);
const PROTOCOL = hasCerts ? 'https' : 'http';

// --- Tmux Session API ---
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
                id: id.trim(),
                name: name.trim(),
                windowCount: parseInt(windowCount) || 0,
                attached: attached === '1',
                windows: [],
            };
        });

        // Get windows for each session
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
                            id: wId.trim(),
                            index: parseInt(wIndex) || 0,
                            name: wName.trim(),
                            paneCount: parseInt(paneCount) || 0,
                            active: wActive === '1',
                            panes: [],
                        };
                    });

                    // Get panes for each window
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
                                        id: pId.trim(),
                                        index: parseInt(pIndex) || 0,
                                        title: pTitle.trim(),
                                        command: pCmd.trim(),
                                        active: pActive === '1',
                                        target: `${session.name}:${win.index}.${pIndex.trim()}`,
                                    };
                                });
                            }
                        } catch (e) {
                            // Pane listing failed
                        }
                    }
                }
            } catch (e) {
                // Window listing failed
            }
        }

        return sessions;
    } catch (e) {
        console.log('[API] tmux not available or no sessions:', e.message);
        return [];
    }
}

// --- AI Command Generation ---

// Role definitions: each has a tailored system prompt + output format suffix
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

// --- Custom Roles Storage ---
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

    // Per-role config: config.llm.roles.{roleId} overrides default config.llm
    const roleConfig = config.llm?.roles?.[role] || {};
    const defaultApiKey = process.env.LLM_API_KEY || config.llm?.apiKey;
    const defaultApiUrl = process.env.LLM_API_URL || config.llm?.apiUrl || 'https://api.deerapi.com/v1/chat/completions';
    const defaultModel = process.env.LLM_MODEL || config.llm?.model || 'deepseek-v3.2';

    const apiKey = roleConfig.apiKey || defaultApiKey;
    const apiUrl = roleConfig.apiUrl || defaultApiUrl;
    const model = roleConfig.model || defaultModel;

    console.log('[LLM] Request:', { prompt, role, model, apiUrl: apiUrl.replace(/\/chat.*/, '/...'), hasRoleOverride: !!config.llm?.roles?.[role] });

    if (!apiKey) {
        console.log('[LLM] No API key configured, returning raw input');
        return {
            command: prompt.trim(),
            explanation: '⚠️ 未配置 LLM API。在 config_private.json 中设置 llm.apiKey 后可启用 AI 生成。',
        };
    }

    // Call LLM API
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
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
    console.log('[LLM] Response status:', response.status);

    if (data.error) {
        console.log('[LLM] API error:', data.error);
        return { command: '', explanation: 'API 错误: ' + (data.error.message || JSON.stringify(data.error)) };
    }

    const content = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('[LLM] Raw content:', content);

    // Try to extract command from markdown code block if present
    const codeMatch = content.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    const command = codeMatch ? codeMatch[1].trim() : content;

    console.log('[LLM] Extracted command:', command);
    return { command, explanation: `[${role}] ${model}` };
}

// --- MIME Types ---
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

// --- Request Handler (shared by HTTP/HTTPS) ---
function requestHandler(req, res) {
    const parsedUrl = url.parse(req.url, true);

    // CORS headers for dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API: GET /api/sessions
    if (parsedUrl.pathname === '/api/sessions') {
        const sessions = getTmuxSessions();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessions }));
        return;
    }

    // API: POST /api/log — remote client logging (for iOS debugging)
    if (parsedUrl.pathname === '/api/log' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const entry = JSON.parse(body);
                const ts = new Date().toISOString().slice(11, 19);
                console.log(`[CLIENT ${ts}] ${entry.level || 'info'}: ${entry.message}`, entry.data || '');
                clientLogs.push({ ts, ...entry });
                if (clientLogs.length > 100) clientLogs.splice(0, clientLogs.length - 100);
            } catch { }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
        });
        return;
    }

    // API: GET /api/logs — view client logs
    if (parsedUrl.pathname === '/api/logs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(clientLogs.slice(-50)));
        return;
    }

    // Static files — serve compiled React app from app/dist/, fallback to XTerminalUI
    const reqPath = parsedUrl.pathname;

    // --- Snippets CRUD API ---
    const SNIPPETS_FILE = path.join(__dirname, 'snippets.json');

    const loadSnippets = () => {
        try {
            if (fs.existsSync(SNIPPETS_FILE)) return JSON.parse(fs.readFileSync(SNIPPETS_FILE, 'utf-8'));
        } catch { }
        return [];
    };
    const saveSnippets = (arr) => fs.writeFileSync(SNIPPETS_FILE, JSON.stringify(arr, null, 2));

    // GET /api/snippets — list all
    if (parsedUrl.pathname === '/api/snippets' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(loadSnippets()));
        return;
    }

    // POST /api/snippets — add { name, command }
    if (parsedUrl.pathname === '/api/snippets' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try {
                const { name, command } = JSON.parse(body);
                if (!command) throw new Error('command required');
                const snippets = loadSnippets();
                snippets.push({ name: name || command.slice(0, 30), command, createdAt: Date.now() });
                saveSnippets(snippets);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // DELETE /api/snippets?index=N — remove by index
    if (parsedUrl.pathname === '/api/snippets' && req.method === 'DELETE') {
        const idx = parseInt(parsedUrl.query.index, 10);
        const snippets = loadSnippets();
        if (idx >= 0 && idx < snippets.length) {
            snippets.splice(idx, 1);
            saveSnippets(snippets);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    // --- Custom Roles CRUD API ---
    if (parsedUrl.pathname === '/api/roles' && req.method === 'GET') {
        const builtinList = Object.keys(ROLE_DEFS).map(id => ({ id, ...ROLE_DEFS[id], builtin: true }));
        const customList = loadCustomRoles().map(r => ({ ...r, builtin: false }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ roles: [...builtinList, ...customList] }));
        return;
    }

    if (parsedUrl.pathname === '/api/roles' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { id, emoji, label, desc, prompt, suffix } = JSON.parse(body);
                if (!id || !prompt || !suffix) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'id, prompt, suffix 必填' }));
                    return;
                }
                if (ROLE_DEFS[id]) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '不能覆盖内置角色' }));
                    return;
                }
                const customs = loadCustomRoles().filter(r => r.id !== id);
                customs.push({ id, emoji: emoji || '🤖', label: label || id, desc: desc || '', prompt, suffix });
                saveCustomRoles(customs);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (parsedUrl.pathname.startsWith('/api/roles/') && req.method === 'PUT') {
        const roleId = parsedUrl.pathname.split('/').pop();
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                if (ROLE_DEFS[roleId]) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '不能编辑内置角色' }));
                    return;
                }
                const updates = JSON.parse(body);
                const customs = loadCustomRoles();
                const idx = customs.findIndex(r => r.id === roleId);
                if (idx === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '角色不存在' }));
                    return;
                }
                customs[idx] = { ...customs[idx], ...updates, id: roleId };
                saveCustomRoles(customs);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (parsedUrl.pathname.startsWith('/api/roles/') && req.method === 'DELETE') {
        const roleId = parsedUrl.pathname.split('/').pop();
        if (ROLE_DEFS[roleId]) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '不能删除内置角色' }));
            return;
        }
        const customs = loadCustomRoles().filter(r => r.id !== roleId);
        saveCustomRoles(customs);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    // POST /api/ai/command — AI command generation
    if (parsedUrl.pathname === '/api/ai/command' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { prompt, role } = JSON.parse(body);
                const result = await generateAiCommand(prompt, role);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ command: '', explanation: '生成失败: ' + e.message }));
            }
        });
        return;
    }

    // Try app/dist first (production React build)
    let filePath = path.join(APP_DIST, reqPath === '/' ? '/index.html' : reqPath);
    let ext = path.extname(filePath);
    let contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (!err) {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
            return;
        }

        // Fallback: try XTerminalUI directory (preview.html, xterm assets, etc.)
        filePath = path.join(UI_DIR, reqPath === '/' ? '/preview.html' : reqPath);
        ext = path.extname(filePath);
        contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err2, data2) => {
            if (!err2) {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data2);
                return;
            }

            // SPA fallback: serve app/dist/index.html for client-side routing
            fs.readFile(path.join(APP_DIST, 'index.html'), (err3, indexData) => {
                if (!err3) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(indexData);
                } else {
                    res.writeHead(404);
                    res.end('Not Found: ' + reqPath);
                }
            });
        });
    });
}

// --- WebSocket Backend ---
const wss = new WebSocket.Server({ server });
wss.on('connection', handleWsConnection);

function handleWsConnection(ws, req) {
    const parsedUrl = url.parse(req.url, true);

    // Route: /ws/speech → Xunfei speech proxy
    if (parsedUrl.pathname === '/ws/speech') {
        handleSpeechConnection(ws);
        return;
    }

    // Route: /ws → Terminal PTY
    const target = parsedUrl.query.target; // e.g. "session_name:window.pane"

    console.log('[WS] Client connected, target:', target || 'new shell');

    const shell = process.env.SHELL || '/bin/zsh';
    let spawnArgs;

    if (target) {
        // Attach to specific tmux pane
        // Use: tmux attach -t target  (but inside a PTY)
        // Actually, better to use: tmux send-keys / capture-pane approach
        // Or simply: spawn shell that runs "tmux attach -t target"
        spawnArgs = ['python3', [PTY_HELPER, shell, '80', '24', '-c', `tmux attach-session -t '${target}' 2>/dev/null || tmux new-session -s preview`]];

        // Actually, pty_helper doesn't support -c. Let's modify the approach:
        // We spawn via pty_helper which creates a PTY and runs shell inside.
        // Then we send tmux attach to the shell's stdin.
        spawnArgs = null; // Use default shell, then send tmux command
    }

    // Use Python pty_helper.py to allocate a real PTY
    const proc = spawn('python3', [PTY_HELPER, shell, '80', '24'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.env.HOME,
    });

    console.log('[Shell] Spawned PID:', proc.pid);

    // If target specified, attach to tmux pane after shell starts
    if (target) {
        setTimeout(() => {
            if (!proc.killed && proc.stdin.writable) {
                proc.stdin.write(`tmux attach-session -t '${target}' 2>/dev/null || echo 'Could not attach to ${target}'\n`);
            }
        }, 300);
    }

    // Shell stdout -> WebSocket
    proc.stdout.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString('utf8') }));
        }
    });

    proc.stderr.on('data', (data) => {
        console.error('[Shell stderr]', data.toString());
    });

    proc.on('close', (code) => {
        console.log('[Shell] Exited, code:', code);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: '\r\n[Session ended]\r\n' }));
            ws.close();
        }
    });

    proc.on('error', (err) => {
        console.error('[Shell] Error:', err.message);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: '\r\nShell error: ' + err.message + '\r\n' }));
            ws.close();
        }
    });

    // WebSocket -> Shell stdin
    ws.on('message', (msg) => {
        try {
            const parsed = JSON.parse(msg.toString());
            switch (parsed.type) {
                case 'input':
                    if (!proc.killed && proc.stdin.writable) {
                        proc.stdin.write(parsed.data);
                    }
                    break;
                case 'resize':
                    if (!proc.killed && proc.stdin.writable && parsed.cols && parsed.rows) {
                        proc.stdin.write(`\x1b]resize;${parsed.cols};${parsed.rows}\x07`);
                        console.log('[Shell] Resize:', parsed.cols, 'x', parsed.rows);
                    }
                    break;
            }
        } catch (e) {
            if (!proc.killed && proc.stdin.writable) {
                proc.stdin.write(msg.toString());
            }
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        if (!proc.killed) {
            proc.kill('SIGTERM');
        }
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] ${PROTOCOL.toUpperCase()} at ${PROTOCOL}://localhost:${PORT}`);
    console.log(`[Server] Static files from: ${UI_DIR}`);
    console.log(`[Server] PTY helper: ${PTY_HELPER}`);
});

// --- Tiny HTTP server for CA cert download (iPhone needs HTTP to install CA before trusting HTTPS) ---
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
