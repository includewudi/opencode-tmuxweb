# OpenCode iTerm — 部署文档 (for AI Agents / Developers)

> 本文档面向 AI 编程助手（Cursor/Copilot/Gemini/Claude），提供完整的项目结构、配置和部署说明。

## 项目概览

Web 终端客户端：通过浏览器（主要面向 iPhone/iPad）访问 macOS 上的 tmux 会话，集成 AI 命令生成和语音输入。

## 目录结构

```
opencode-tmuxweb/
├── web/                          # ★ 主要工作目录
│   ├── server.js                 # Node.js 后端（HTTP/HTTPS + WebSocket）
│   ├── config.js                 # 配置加载器（合并 public + private config）
│   ├── private_config.json       # 私有配置（gitignored，含 API keys）
│   ├── speech.js                 # 讯飞语音识别 WebSocket 代理
│   ├── pty_helper.py             # Python PTY 分配器
│   ├── ecosystem.config.js       # pm2 进程管理配置
│   ├── snippets.json             # 命令片段存储
│   ├── custom_roles.json         # 自定义 AI 角色存储（自动生成）
│   ├── cert.pem / key.pem        # SSL 证书（gitignored）
│   ├── package.json              # 后端依赖（ws, node-pty）
│   └── app/                      # React 前端
│       ├── src/
│       │   ├── App.jsx           # 主应用（会话选择 + 终端显示）
│       │   ├── components/
│       │   │   ├── TerminalPane.jsx    # 终端面板
│       │   │   ├── AiCommandTab.jsx    # AI 命令生成 Tab
│       │   │   ├── BottomToolbox.jsx   # 底部工具箱（快捷键/片段/AI）
│       │   │   ├── TerminalToolbar.jsx # 顶部工具栏
│       │   │   └── VoiceInput.jsx      # 语音输入组件
│       │   ├── hooks/
│       │   │   ├── useTerminal.js      # xterm.js + WebSocket 管理
│       │   │   ├── useVisualViewport.js
│       │   │   └── useShakeDetect.js
│       │   └── utils/rlog.js     # 远程日志（发送到 /api/log）
│       ├── dist/                 # 构建产物（gitignored）
│       ├── package.json          # 前端依赖（react, xterm, vite）
│       └── vite.config.js        # Vite 配置（proxy → 8215）
├── TmuxWeb/server/config.json    # 公共配置文件（提交到 git）
├── VoiceTmuxApp/                 # iOS 原生 Swift 应用
└── img/                          # 截图
```

## 配置系统

配置通过 `web/config.js` 加载，**深度合并**两个文件：

1. **`TmuxWeb/server/config.json`**（公共，提交 git）— 默认值和文档
2. **`web/private_config.json`**（私有，gitignored）— API keys 和敏感信息

`private_config.json` 的键会覆盖 `config.json` 中的同名键。

### private_config.json 完整模板

```json
{
  "port": 8215,
  "llm": {
    "apiKey": "sk-xxxxxxxxxxxxxxxx",
    "apiUrl": "https://api.deerapi.com/v1/chat/completions",
    "model": "deepseek-v3.2",
    "roles": {
      "cli":      { "model": "deepseek-v3.2" },
      "prompt":   { "apiUrl": "https://api.openai.com/v1/chat/completions", "apiKey": "sk-xxx", "model": "gpt-4o" },
      "frontend": { "model": "claude-3-sonnet" }
    }
  },
  "xfyun": {
    "appId": "xxxxxxxx",
    "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "apiSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

### 配置项说明

| 配置路径 | 说明 | 默认值 |
|----------|------|--------|
| `port` | 服务端口 | `8215` |
| `llm.apiKey` | LLM API Key | 无（不配则 AI 功能返回原文） |
| `llm.apiUrl` | LLM API 地址 | `https://api.deerapi.com/v1/chat/completions` |
| `llm.model` | 默认模型 | `deepseek-v3.2` |
| `llm.roles.<roleId>` | 特定角色覆盖（可覆盖 apiKey/apiUrl/model） | 继承默认 |
| `xfyun.appId/apiKey/apiSecret` | 讯飞语音 API 凭证 | 无（不配则语音不可用） |

### 环境变量（可选，优先级低于 private_config.json）

```bash
LLM_API_KEY=sk-xxx
LLM_API_URL=https://api.deepseek.com/v1/chat/completions
LLM_MODEL=deepseek-chat
XFYUN_APP_ID=xxx
XFYUN_API_KEY=xxx
XFYUN_API_SECRET=xxx
PORT=8215
```

## SSL 证书配置

### 方案 A：mkcert（推荐，iPhone 免警告）

```bash
# 安装 mkcert
brew install mkcert
mkcert -install

# 生成证书
cd opencode-tmuxweb/web
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
```

**iPhone 安装 CA 证书**：
1. server 会自动在 `http://<IP>:8280` 启动证书下载页面
2. iPhone Safari 打开 `http://<IP>:8280`
3. 点击"下载 CA 证书"
4. 设置 → 已下载描述文件 → 安装
5. 设置 → 通用 → 关于本机 → 证书信任设置 → 启用完全信任

CA 文件位置：`~/Library/Application Support/mkcert/rootCA.pem`

### 方案 B：自签名证书（iPhone 会有提示）

```bash
cd opencode-tmuxweb/web
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem -subj "/CN=localhost"
```

### 无证书

如果 `web/` 下没有 `cert.pem` 和 `key.pem`，server 自动降级为 HTTP（端口不变）。

## 部署步骤

### 1. 安装依赖

```bash
cd opencode-tmuxweb/web
npm install            # 后端依赖
cd app && npm install  # 前端依赖
```

### 2. 构建前端

```bash
cd opencode-tmuxweb/web/app
npx vite build         # 输出到 dist/
```

> **重要**：每次修改前端代码后必须重新 `npx vite build`，server.js 直接 serve `dist/` 目录。

### 3. 启动服务

#### 开发模式

```bash
cd opencode-tmuxweb/web
node server.js
```

#### 生产模式（pm2）

```bash
cd opencode-tmuxweb/web
pm2 start ecosystem.config.js
```

pm2 配置说明 (`ecosystem.config.js`)：

| 进程 | 说明 | watch |
|------|------|-------|
| `iterm-api` | Node.js 后端 (server.js) | `server.js`, `speech.js`, `pty_helper.py` |
| `iterm-app` | Vite dev server（开发用，生产不需要） | — |

常用 pm2 命令：

```bash
pm2 restart iterm-api     # 重启后端
pm2 logs iterm-api        # 查看日志
pm2 stop iterm-api        # 停止
pm2 delete all            # 清除所有进程
```

### 4. 访问

| URL | 说明 |
|-----|------|
| `https://<IP>:8215` | 主页面（iPhone 访问） |
| `http://<IP>:8280` | CA 证书下载页（仅 mkcert 模式） |
| `http://<IP>:8215/api/logs` | 客户端远程日志查看 |

## 完整 API 清单

### HTTP API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | `/api/sessions` | 获取 tmux 会话列表 | — |
| GET | `/api/panes?session=NAME` | 获取会话的窗格列表 | — |
| GET | `/api/roles` | 获取所有 AI 角色（内置+自定义） | — |
| POST | `/api/roles` | 创建自定义 AI 角色 | `{id,emoji,label,desc,prompt,suffix}` |
| PUT | `/api/roles/:id` | 编辑自定义角色（不可编辑内置） | `{emoji,label,desc,prompt,suffix}` |
| DELETE | `/api/roles/:id` | 删除自定义角色（不可删除内置） | — |
| POST | `/api/ai/command` | AI 生成命令/提示词 | `{prompt, role}` |
| GET | `/api/snippets` | 获取命令片段列表 | — |
| POST | `/api/snippets` | 添加命令片段 | `{name, command}` |
| DELETE | `/api/snippets?index=N` | 删除命令片段 | — |
| POST | `/api/log` | 客户端远程日志 | `{level, message, ...data}` |
| GET | `/api/logs` | 查看客户端日志（HTML 页面） | — |

### WebSocket

| 路径 | 协议 | 说明 |
|------|------|------|
| `/ws?target=session:window.pane` | JSON `{type:"input"/"resize", data/cols/rows}` | 终端 PTY |
| `/ws/speech` | Binary + JSON `{type:"start"/"audio"/"stop"}` | 讯飞 STT 代理 |

## AI 角色系统

### 内置角色（7 个，不可修改）

| ID | 名称 | 类型 | 说明 |
|----|------|------|------|
| `cli` | 🖥️ 命令行大神 | 命令生成 | 生成可直接执行的终端命令 |
| `ops` | 🔧 运维专家 | 提示词优化 | DevOps/SRE 提示词优化 |
| `prompt` | ✨ 提示词优化 | 提示词优化 | 通用 AI 提示词工程 |
| `frontend` | 🎨 前端优化 | 提示词优化 | 前端开发提示词 |
| `backend` | ⚙️ 后端优化 | 提示词优化 | 后端开发提示词 |
| `ui` | 🎭 UI优化 | 提示词优化 | UI/UX 设计提示词 |
| `api` | 🔄 API转换 | 提示词优化 | API 架构转换 |

### 自定义角色

存储在 `web/custom_roles.json`（自动创建，gitignored）。

每个角色需要 6 个字段：

```json
{
  "id": "k8s",
  "emoji": "☸️",
  "label": "K8s专家",
  "desc": "Kubernetes 部署运维",
  "prompt": "你是 Kubernetes 专家...",
  "suffix": "请输出 K8s 配置方案，Markdown 格式..."
}
```

- `prompt`：系统提示词（角色定义 + 能力 + 规则）
- `suffix`：输出格式要求（追加在 prompt 后面）
- `generateAiCommand()` 最终 system prompt = `prompt + \n\n + suffix`

### 每角色模型配置

在 `private_config.json` 中：

```json
{
  "llm": {
    "apiKey": "default-key",
    "model": "deepseek-v3.2",
    "roles": {
      "cli": { "model": "gpt-4o" },
      "prompt": {
        "apiUrl": "https://api.anthropic.com/v1/chat/completions",
        "apiKey": "sk-ant-xxx",
        "model": "claude-3-sonnet"
      }
    }
  }
}
```

查找优先级：`config.llm.roles[roleId] > config.llm > 环境变量 > 硬编码默认值`

## WebSocket 重连机制

前端 `useTerminal.js` 实现：

1. 断连后自动重试，延迟循环：2s → 3s → 4s → 5s → 2s...
2. 最多重试 **8 次**，显示进度 `(3/8)`
3. 8 次全失败 → 3 秒倒计时自动 `location.reload()` 刷新页面
4. 用户可按任意键立即刷新
5. 成功重连后显示 `[已重连 ✓]` 并重置计数器

## 关键依赖

### 后端 (web/package.json)

| 包 | 用途 |
|----|------|
| `ws` | WebSocket 服务端 |
| `node-pty` | 伪终端分配（备用，当前用 pty_helper.py） |

### 前端 (web/app/package.json)

| 包 | 用途 |
|----|------|
| `react` / `react-dom` | UI 框架（v19） |
| `@xterm/xterm` + `@xterm/addon-fit` | 终端模拟器 |
| `lucide-react` | 图标库 |
| `vite` | 构建工具 |

### 系统依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| `tmux` | 终端多路复用 | `brew install tmux` |
| `python3` | PTY helper | 系统自带 |
| `node` ≥ 18 | 后端运行时 | `brew install node` |
| `pm2`（可选） | 进程管理 | `npm i -g pm2` |
| `mkcert`（可选） | SSL 证书 | `brew install mkcert` |

## 常见问题

### 修改前端代码后不生效

前端是构建后静态文件，修改 `.jsx` 后需要：

```bash
cd web/app && npx vite build
pm2 restart iterm-api  # 或 Ctrl+C 重启 node server.js
```

### pm2 watch 导致频繁重启

`ecosystem.config.js` 只 watch `server.js`, `speech.js`, `pty_helper.py`，不 watch `dist/`。如果仍然频繁重启，检查是否有其他 pm2 实例用了 `watch: true` 全目录监听。

### iPhone 连不上 WSS

1. 确认 CA 证书已安装并在"证书信任设置"中启用
2. 确认 iPhone 和 Mac 在同一局域网
3. 确认 macOS 防火墙允许 8215 端口
