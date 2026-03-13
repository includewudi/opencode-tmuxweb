# TmuxWeb

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文文档

> 基于 Web 的 tmux 客户端，支持桌面和移动端浏览器 —— 从任何设备管理终端会话、AI 生成命令、语音输入。

![TmuxWeb 截图](docs/images/screenshot.png)

## 功能特性

### 终端管理

- **多会话访问** —— 通过浏览器连接任意 tmux session/window/pane
- **多标签终端** —— 在标签页中打开多个 pane，刷新页面后自动恢复
- **xterm.js 渲染** —— 完整的终端仿真，WebSocket PTY 后端
- **两种终端模式**：
  - `pty`（默认）—— 每个 pane 独立 PTY，完全隔离
  - `controlmode` —— 通过 tmux control mode 共享单 PTY，节省资源
- **自动重连** —— 断连后 2 秒重试，失败后按任意键刷新
- **HTTPS/WSS** —— 支持 mkcert 或自签名证书
- **触摸滑动翻页** —— 上下滑动映射 tmux 鼠标滚轮（需开启 `tmux set -g mouse on`）

### 桌面端 UI（`/`）

三栏响应式布局：**侧边栏** | **终端标签** | **工具箱**

**侧边栏 — 资源管理器模式：**
- 配置文件选择器 —— 切换不同的工作空间配置
- 会话分组管理 —— 将 tmux 会话整理为可折叠分组
- TmuxTree —— 会话 → 窗口 → 窗格的树形结构
- 窗格状态指示灯（空闲 / 执行中 / 完成 / 失败 / 等待）
- 新建会话/窗口，支持快捷目录选择
- 右键重命名窗口
- 任务统计徽章 —— 全局任务计数

**侧边栏 — 御书房模式：**
- Worker 区 —— 活跃的 AI 代理工作者及状态徽章
- 收件箱 —— 未读通知及正文预览
- 活动流 —— 最近事件时间线
- 命令输入 —— 向编排后端或窗格分发任务
- 运行管道 —— 实时跟踪编排任务执行
- 助手聊天面板 —— 与 AI 助手流式对话
- 任务详情弹窗 —— 查看意图、思维链、结果和事件时间线
- **浮动模式** —— 分离为可拖拽、可调整大小的弹窗
- **背景透明度调节** —— 从全透明到不透明的滑块控制（文字/图标始终可见）

**终端标签：**
- 打开/关闭/排序标签
- 全屏切换
- 标签状态持久化到 localStorage

**工具箱面板：**
- 快捷键：`Tab`、`Ctrl+C`、`Esc`、方向键、`Enter`、滚动模式
- Tmux 前缀指示器
- **AI 标签** —— 角色选择、提示输入、语音按钮、一键发送到终端
- **命令片段标签** —— 保存/加载/删除常用命令
- **上传标签** —— 文件上传并复制路径到终端
- **配置标签** —— 查看窗格 OpenCode 配置
- 任务历史面板（按窗格）
- 快捷键：`Ctrl/Cmd + Shift + M` 触发语音输入

### 移动端 UI（`/m`）

为触屏优化的单栏布局：

- 汉堡菜单抽屉：TmuxTree 和配置文件选择器
- 全屏终端，支持触摸手势
- 御书房按钮（全屏仪表盘）
- 可折叠底部工具箱：
  - 两行快捷键：`esc`、`tab`、`|`、`/`、`-`、`~`、`^C`、`clr`、`ctrl`、`alt`、方向键、滚动、回车
  - 字体大小滑块
  - 键盘模式（快捷键展开为全宽）
  - AI、命令片段、配置、上传标签
- 摇一摇触发语音录入
- iOS 键盘视口适配

<p align="center">
  <img src="docs/images/mobile-1.jpg" width="30%" alt="移动端终端" />
  <img src="docs/images/mobile-2.jpg" width="30%" alt="移动端工具箱" />
  <img src="docs/images/mobile-3.jpg" width="30%" alt="移动端御书房" />
</p>

### AI 命令生成

- **8 个内置角色**：命令行大神、运维专家、提示词优化、前端优化、后端优化、UI 优化、API 转换等
- **自定义角色** —— 通过 UI 或 API 创建/编辑/删除，存储在 `custom_roles.json`
- **按角色配置模型** —— 不同角色可使用不同的 LLM 模型
- **OpenAI 兼容 API** —— 支持 DeepSeek、OpenAI、Moonshot、DeerAPI 等任何兼容服务
- 一键将生成的命令发送到当前终端

### 语音输入

- 基于**科大讯飞** WebSocket STT 的语音识别
- 长按录音，波形可视化
- 支持中英文
- 自定义热词和替换规则，适配专业术语

### 任务追踪

- 自动任务生命周期跟踪（started → in_progress → completed/failed）
- 按窗格的任务历史详情
- MySQL 持久化存储
- SSE（Server-Sent Events）实时状态推送
- 侧边栏任务统计徽章
- 摘要服务集成（可选）

### 工作空间管理

- **配置文件** —— 多工作空间配置，快速切换项目
- **会话分组** —— 将 tmux 会话整理为可折叠分类
- **快捷目录** —— 新建窗口时的常用目录快捷选择

### 编排服务集成（御书房）

TmuxWeb 提供**通用编排对接标准** —— 通过简单的代理配置，接入任意外部任务编排后端。

- **代理层** —— 反向代理任意 REST API（在 `config_private.json` 中配置 host/port）
- **Worker 面板** —— 查看编排后端中活跃的 AI 代理工作者
- **收件箱** —— 接收并展示来自编排服务的通知
- **活动流** —— 跟踪已连接服务的最近事件
- **运行管道** —— 实时监控编排任务执行
- **助手聊天** —— 通过编排后端与 AI 进行流式对话

> 要集成你自己的编排服务，在 `butler` 配置中设置 `{ "host": "...", "port": ... }`，并实现预期的 REST 端点。详见 `server/routes/` 中的代理路由定义。

### OpenCode 集成

TmuxWeb 与 [OpenCode](https://github.com/nicepkg/opencode)（AI 编程代理）深度集成：

- **插件化任务追踪** —— OpenCode 插件（`plugins/my-rules.js`）自动上报任务生命周期事件（`task_started` → `in_progress` → `completed` / `failed` / `waiting`）到 TmuxWeb API
- **实时窗格状态** —— 侧边栏窗格指示灯随 OpenCode 代理工作状态自动变化（空闲 🔘 → 执行中 🟡 → 完成 🟢 → 失败 🔴）
- **按窗格任务历史** —— 每次 OpenCode 对话都记录用户消息、助手回复、时间戳和状态
- **SSE 实时推送** —— 任务状态变更通过 Server-Sent Events 实时推送到浏览器
- **OpenCode 配置查看器** —— 在工具箱中直接查看任意窗格项目目录的 `opencode.json` 和 `oh-my-opencode.json`
- **对话与命令日志** —— 按任务段记录用户/助手消息和已执行命令
- **AI 任务摘要** —— 生成已完成任务的摘要（可选外部服务）
- **能力清单** —— 自描述 API（`/api/capabilities`）供编排工具服务发现
- **自定义规则注入** —— 插件向 OpenCode 会话注入自定义系统提示规则（如 fast-edit）

#### 插件部署

插件提供两个功能：**任务追踪**（将 AI 对话生命周期上报到 TmuxWeb）和 **自定义规则注入**（向每个 AI 会话的 system prompt 添加你的规则）。

**第 1 步 —— 创建本地插件：**

```bash
cd opencode-tmuxweb/TmuxWeb/plugins
cp my-rules.js.back my-rules.js        # 创建本地副本（已 gitignore）
```

**第 2 步 —— 软链接到 OpenCode 插件目录：**

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf "$(pwd)/my-rules.js" ~/.config/opencode/plugins/my-rules.js
```

**第 3 步 —— 配置端口：**

编辑 `my-rules.js`，将 `PORT` 常量设为你的 TmuxWeb 后端端口：

```javascript
const PORT = 8215;            // 必须与 server/config_private.json 中的 port 一致
```

**第 4 步 ——（可选）启用任务持久化：**

任务追踪需要 MySQL。在 `server/config_private.json` 中添加 `db` 配置：

```json
{
  "db": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "your-password",
    "database": "tmuxweb"
  }
}
```

没有 MySQL 时，插件仍然正常运行 —— 任务事件会返回 503 并被静默忽略，OpenCode 不受影响。

**第 5 步 —— 添加自定义规则：**

编辑 `my-rules.js` 中的 `MY_RULES` 部分，向每个 OpenCode 会话注入自定义规则。模板中已包含 `[FAST-EDIT]` 示例 —— 在其下方添加你自己的规则块：

```javascript
const MY_RULES = `<MY_RULES>
// ... 已有规则 ...

// ── 在下方添加你的规则 ──
// [MY-CUSTOM-RULE]
// 当用户要求做 X 时，先加载 skill("your-skill")，然后 ...
</MY_RULES>`;
```

**验证是否生效：**

1. 启动 TmuxWeb 服务
2. 打开一个 tmux 窗格并启动 OpenCode
3. 发送任意消息 —— 侧边栏窗格指示灯应变为 🟡（执行中）
4. AI 回复完成后应变为 🟢（完成）

如果没有反应，检查：
- `curl -sk https://localhost:8215/healthz` → 应返回 `{"status":"ok","db":"ok"}`
- 软链接存在：`ls -la ~/.config/opencode/plugins/my-rules.js`
- 端口是否匹配：`my-rules.js` 中的 PORT 与服务器配置一致

#### 工作原理

```
OpenCode 会话开始
  → my-rules.js 的 chat.message 钩子触发
  → POST /api/tasks/events {event: "task_started", pane_key, conversation_id}
  → TmuxWeb 写入 ai_conversation 表 + 广播 SSE
  → 侧边栏窗格指示灯变为 🟡

OpenCode 会话结束（session.idle 事件）
  → my-rules.js 的 event 钩子触发
  → POST /api/tasks/events {event: "task_completed", conversation_id}
  → TmuxWeb 更新记录 + 广播 SSE
  → 侧边栏窗格指示灯变为 🟢
```

插件通过 `tmux display-message -p '#{session_name}/#{window_index}/#{pane_id}'` 识别当前窗格，并为每次对话生成 UUID。

## 架构

```
┌──────────────┐      ┌───────────────┐      ┌───────────┐
│  浏览器       │◄────►│  Node.js      │◄────►│   tmux    │
│  (React SPA) │ WSS  │  Express + WS │ PTY  │   会话     │
└──────────────┘      └───────────────┘      └───────────┘
                            │    │
                    ┌───────┘    └────────┐
                    │                     │
              ┌─────┴─────┐        ┌─────┴─────┐
              │  LLM API  │        │   MySQL   │
              │ (OpenAI   │        │  （任务、  │
              │  兼容接口) │        │   日志）   │
              └───────────┘        └───────────┘
```

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, Vite 5, xterm.js |
| 后端 | Node.js, Express 4, WebSocket (ws), node-pty |
| 数据库 | MySQL (mysql2/promise) |
| AI | OpenAI 兼容 API（DeepSeek、GPT 等） |
| 语音 | 科大讯飞 WebSocket STT |
| 部署 | PM2, HTTPS (mkcert) |

## 快速开始

### 环境要求

- macOS 或 Linux，已安装 tmux
- Node.js 18.x – 20.x（测试版本 v20.20.0）
- npm ≥ 8.x
- MySQL 5.7+（可选 —— 用于任务追踪持久化）
- tmux ≥ 3.0

> ⚠️ Node.js v22+ 可能与 node-pty 存在兼容性问题，遇到错误请使用 v20.x。

### 安装

```bash
git clone https://github.com/includewudi/opencode-tmuxweb.git
cd opencode-tmuxweb/TmuxWeb

# 安装后端依赖
npm install

# 安装并构建前端
cd web && npm install && npm run build && cd ..
```

### 配置

复制默认配置并填写你的值：

```bash
cp server/config.json server/config_private.json
```

编辑 `server/config_private.json`：

```jsonc
{
  "token": "your-secret-token",        // 必填 — 用于认证
  "sessionSecret": "your-session-key", // 必填 — cookie 签名

  // LLM（可选 — 用于 AI 命令生成）
  "llm": {
    "apiKey": "sk-xxx",
    "apiUrl": "https://api.deepseek.com/v1/chat/completions",
    "model": "deepseek-chat",
    "roles": {
      "cli": { "model": "gpt-4o" }     // 按角色覆盖模型
    }
  },

  // 语音识别（可选 — 用于语音转文字）
  "xfyun": {
    "appId": "xxx",
    "apiKey": "xxx",
    "apiSecret": "xxx"
  },

  // 数据库（可选 — 用于任务追踪）
  "db": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "your-password",
    "database": "tmuxweb"
  },

  // 网络
  "allowedOrigins": [
    "https://192.168.1.100:5215"        // 你的局域网 IP
  ]
}
```

> `config_private.json` 已加入 gitignore。公共的 `config.json` 包含默认值和说明文档。

### 数据库设置（可选）

仅在需要任务追踪持久化时配置：

```bash
mysql -u root -p
```

```sql
CREATE DATABASE tmuxweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

服务端首次启动时会通过 `server/db/bootstrap.js` 自动创建表结构。

### SSL 证书

HTTPS 访问必需（尤其是从 iOS 设备访问时）。

**方案 A：mkcert（推荐）**

```bash
brew install mkcert
mkcert -install
cd opencode-tmuxweb/TmuxWeb
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
```

在 iPhone 上安装 CA 证书：
1. 启动服务后，用 Safari 打开 `http://<你的IP>:8280`
2. 点击"下载 CA 证书"
3. 设置 → 已下载描述文件 → 安装
4. 设置 → 通用 → 关于本机 → 证书信任设置 → 启用完全信任

**方案 B：自签名证书**

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem -subj "/CN=localhost"
```

> 没有证书文件时，服务端自动降级为 HTTP 模式（无 WSS，移动端支持有限）。

### 启动

```bash
# 开发模式
node server/index.js                    # 后端（端口 8215）
cd web && npm run dev                   # 前端（端口 5215）

# 生产模式（PM2）
pm2 start ecosystem.config.js
```

在浏览器中打开 `https://<你的IP>:5215`。

### 通过 ZeroTier 远程访问

无公网 IP 时的访问方案：

1. 在服务器和手机上安装 ZeroTier
2. 加入同一个网络
3. 将 ZeroTier IP 添加到 `config_private.json` 的 `allowedOrigins`
4. 通过 `http://<zerotier-ip>:5215` 访问

## API 参考

所有 API 路由需要认证（通过登录获取的 token 或 session cookie）。

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 使用 token 登录 → HttpOnly session cookie |
| POST | `/api/auth/logout` | 清除会话 |

### Tmux 管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取 tmux 会话列表 |
| POST | `/api/sessions` | 创建新会话 |
| GET | `/api/panes` | 获取窗格列表（`?session=name`） |
| POST | `/api/windows` | 创建新窗口 |
| PUT | `/api/windows/:target/name` | 重命名窗口 |

### AI 与角色
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/command` | AI 生成命令 `{prompt, role}` |
| GET | `/api/roles` | 获取所有角色（内置 + 自定义） |
| POST | `/api/roles` | 创建自定义角色 |
| PUT | `/api/roles/:id` | 更新自定义角色 |
| DELETE | `/api/roles/:id` | 删除自定义角色 |

### 命令片段
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/snippets` | 获取已保存的命令片段 |
| POST | `/api/snippets` | 保存命令片段 |
| DELETE | `/api/snippets/:id` | 删除命令片段 |

### 配置文件与分组
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/profiles` | 获取工作空间配置文件列表 |
| POST | `/api/profiles` | 创建配置文件 |
| GET | `/api/groups` | 获取会话分组 |
| POST | `/api/groups` | 创建/更新分组 |

### 任务
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks/events` | SSE 流 —— 实时任务更新 |
| POST | `/api/tasks/events` | 上报任务事件 |
| GET | `/api/tasks/stats` | 任务统计 |
| GET | `/api/tasks/pane/:paneKey` | 窗格的任务历史 |

### WebSocket
| 路径 | 说明 |
|------|------|
| `/ws?target=session:window.pane` | 终端 PTY 连接 |
| `/ws/speech` | 讯飞语音代理 |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 文件上传 |
| GET | `/api/capabilities` | API 能力清单 |
| GET | `/api/hotwords` | 语音热词与替换规则 |
| POST | `/api/segments` | 记录对话/命令片段 |
| GET | `/api/summaries/:paneKey` | 窗格的任务摘要 |

## 配置参考

所有配置项写入 `server/config_private.json`（覆盖 `config.json`）：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `port` | number | `8215` | 后端 API 端口 |
| `bind` | string | `"0.0.0.0"` | 绑定地址 |
| `token` | string | `""` | 认证 token（必填） |
| `sessionSecret` | string | `""` | Cookie 会话密钥 |
| `sessionMaxAgeDays` | number | `30` | Session cookie 有效期（天） |
| `frontendPort` | number | `5215` | 前端开发/预览端口 |
| `envName` | string | `"prod"` | 环境名（用于 PM2 进程名） |
| `terminalMode` | string | `"pty"` | `"pty"` 或 `"controlmode"` |
| `tmuxSocket` | string | `null` | 自定义 tmux socket 路径 |
| `quickDirs` | array | `[...]` | 新建窗口的快捷目录 |
| `allowedOrigins` | array | `[...]` | CORS 允许的来源 |
| `llm` | object | `{}` | LLM 配置（apiKey, apiUrl, model, roles） |
| `xfyun` | object | `{}` | 讯飞 STT 凭据（appId, apiKey, apiSecret） |
| `db` | object | `{}` | MySQL 连接（host, port, user, password, database） |
| `butler` | object | `{}` | 编排服务代理（host, port） |
| `summaryServiceUrl` | string | `""` | 外部摘要服务 URL |

## 项目结构

```
TmuxWeb/
├── server/
│   ├── index.js              # Express + WebSocket 入口
│   ├── config.json           # 默认配置（跟踪提交）
│   ├── config_private.json   # 你的配置（gitignore）
│   ├── routes/               # API 路由处理器
│   ├── middleware/            # 认证中间件
│   ├── services/
│   │   ├── terminal.js       # PTY 终端服务
│   │   ├── terminal-controlmode.js  # Control mode 终端
│   │   └── speech.js         # 讯飞 STT 代理
│   └── db/
│       ├── pool.js           # MySQL 连接池
│       ├── bootstrap.js      # 自动建表
│       └── init.sql          # 表结构定义
├── web/
│   ├── src/
│   │   ├── main.tsx          # 路由（/ → 桌面端，/m → 移动端）
│   │   ├── desktop/          # 桌面端应用和组件
│   │   ├── mobile/           # 移动端应用和组件
│   │   ├── shared/           # 共享组件（TmuxTree、御书房等）
│   │   ├── hooks/            # 自定义 React hooks
│   │   ├── utils/            # 工具函数（认证、平台、API）
│   │   ├── styles/           # CSS 样式表
│   │   └── types.ts          # TypeScript 类型定义
│   ├── vite.config.ts        # Vite 配置
│   └── package.json
├── ecosystem.config.js       # PM2 进程配置
├── LICENSE                   # MIT 许可证
└── CONTRIBUTING.md           # 贡献指南
```

## 常见问题

详见 [skills/troubleshooting.md](skills/troubleshooting.md)，包含以下常见问题的解决方案：

- PTY 资源耗尽（macOS 最大 511 限制）
- 端口冲突与启动错误
- WebSocket 连接问题
- iOS 特有问题
- 数据库配置
- OpenCode 插件配置（fast-edit、任务追踪）

## 参与贡献

欢迎提交 Bug 报告和功能建议！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

> **注意：** 目前暂不接受 Pull Request。

## 许可证

[MIT](LICENSE) © Wu Di
