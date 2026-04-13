# TmuxWeb

全栈 tmux 管理 Web 应用，支持多会话终端、任务追踪和 AI 命令生成。

📖 **[完整部署文档 → DEPLOY.md](./DEPLOY.md)**

## 目录结构

```
TmuxWeb/
├── server/
│   ├── routes/            # API 路由
│   ├── providers/         # CLI 历史记录 Provider（可扩展）
│   │   ├── base.js        #   Provider 接口契约
│   │   └── opencode.js    #   OpenCode SQLite Provider
│   ├── middleware/        # 认证中间件
│   ├── services/          # 终端/语音服务
│   └── db/                # MySQL 连接池
├── web/src/
│   ├── desktop/           # 桌面端 UI
│   ├── shared/components/
│   │   ├── cli-history/   #   CLI 历史浮窗面板
│   │   ├── file-browser/  #   文件管理器浮窗
│   │   └── imperial-study/#   御书房面板
│   └── styles/
├── plugins/               # OpenCode 插件
│   └── my-rules.js        # 任务追踪 + FAST-EDIT 规则插件
└── ecosystem.config.js    # PM2 进程配置
```

## 快速启动

```bash
# 1. 安装依赖
npm run install:all

# 2. 创建私有配置（填写 token 等）
cp server/config.json server/config_private.json

# 3. 构建前端
cd web && npm run build && cd ..

# 4. PM2 启动
pm2 start ecosystem.config.js
```

访问 `http://localhost:5215`

## 端口配置

端口统一在 `server/config_private.json` 中配置，前端 vite 自动读取：

```json
{
  "port": 8215,
  "frontendPort": 5215
}
```

---

## OpenCode 插件：my-rules.js

`plugins/my-rules.js.back` 是提交到 git 的**模板文件**。  
`plugins/my-rules.js` 是你的**本地副本**（已在 `.gitignore` 中），可自由修改。

### 首次安装

```bash
cd TmuxWeb/plugins

# 从模板创建本地副本
cp my-rules.js.back my-rules.js

# 软链接到 OpenCode 插件目录
ln -sf "$(pwd)/my-rules.js" ~/.config/opencode/plugins/my-rules.js
```

软链接建好后，直接编辑 `plugins/my-rules.js` 即实时生效。

### 工作原理

| 事件 | 动作 |
|------|------|
| `chat.message` | 记录任务开始，POST `task_started` |
| `session.idle` | 记录任务完成，POST `task_completed` |

> **注意**：如果 AI 中途被中断，任务保持"进行中"状态，可在 Web 界面手动标记完成。

---

## ZeroTier 配置

ZeroTier 可让你在没有公网 IP 的情况下，通过虚拟内网从手机/外网访问本机的 TmuxWeb。

### 1. 安装 ZeroTier

```bash
# macOS
brew install zerotier-one
sudo brew services start zerotier-one

# Linux
curl -s https://install.zerotier.com | sudo bash
```

### 2. 创建或加入网络

1. 注册 [ZeroTier Central](https://my.zerotier.com)，创建一个网络，记录 **Network ID**
2. 服务器和手机都加入同一网络：
   ```bash
   sudo zerotier-cli join <NetworkID>
   ```
3. 在 ZeroTier Central 页面勾选授权（Auth）对应设备

### 3. 配置 allowedOrigins

获取服务器的 ZeroTier IP（形如 `10.x.x.x`），加入 `server/config_private.json`：

```json
{
  "allowedOrigins": [
    "http://10.x.x.x:5215",
    "http://10.x.x.x:8215"
  ]
}
```

然后重启后端：

```bash
pm2 reload tmuxweb-backend
```

### 4. 手机访问

手机安装 ZeroTier app，加入同一网络后，浏览器访问：

```
http://10.x.x.x:5215
```

---

## 可选功能

| 功能 | 配置项 | 说明 |
|------|--------|------|
| 御书房 | `butler.host` / `butler.port` | 任务编排与 Agent 协作面板 |
| 文件管理器 + 快速路径 | 无需配置 | 浮窗文件浏览器 + 快速路径，左侧活动栏 📁🌳 图标 |
| AI 命令生成 | `llm.apiKey` / `llm.apiUrl` | 支持 OpenAI 兼容 API |
| 语音识别 | `xfyun.appId/apiKey/apiSecret` | [讯飞开放平台](https://console.xfyun.cn/services/bmc) |
| 任务追踪 | `db.*` | MySQL 数据库 |
| CLI 历史 | 无需配置 | 自动读取 OpenCode SQLite，左侧活动栏 🧠 图标 |

详见 **[DEPLOY.md](./DEPLOY.md)**。

---

## 终端管理

TmuxWeb 的核心功能，通过浏览器管理所有 tmux 会话。

### 布局

桌面端三栏布局：**侧栏** | **终端标签** | **工具箱**

### 会话浏览

- **TmuxTree**：层级树展示 `session → window → pane`
- 点击 pane 即可打开终端标签
- 右键 pane 状态图标可查看任务历史
- 支持 session group（会话分组折叠）

### 终端标签

- 多 tab 切换，状态持久化到 localStorage
- 全屏模式切换
- 自动重连（断开后 2s 重试）

### 终端模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `pty`（默认） | 每个 pane 独立 PTY | 大多数场景 |
| `controlmode` | 单 PTY 通过 tmux -C | 低资源占用 |

在 `server/config_private.json` 中配置：

```json
{ "terminalMode": "pty" }
```

### API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/tmux/tree` | 获取 tmux 会话树 |
| GET | `/api/sessions` | 列出 tmux sessions |
| POST | `/api/sessions` | 创建新 session |
| GET | `/api/panes` | 列出 panes（`?session=name`） |
| POST | `/api/windows` | 创建新 window |
| PUT | `/api/windows/:target/name` | 重命名 window |
| WS | `/ws/terminal` | 终端 WebSocket（xterm.js PTY） |

---

## 御书房（Imperial Study）

任务编排与 Agent 协作面板，连接外部编排后端（如 Butler）。支持侧栏模式和浮窗模式。

### 使用方式

- **侧栏模式**：点击左侧活动栏的 📜 图标，在侧栏中展示
- **浮窗模式**：右键 📜 图标切换为浮窗（拖拽/缩放/透明度调节）
- 浮窗模式偏好会保存到 localStorage

### 功能模块

| 模块 | 说明 |
|------|------|
| **Workers** | 活跃 AI Agent 状态面板，显示各 worker 运行状态 |
| **Inbox** | 未读通知列表，支持展开查看详情 |
| **Activity** | 最近事件时间线 |
| **Command Input** | 任务指令输入，可分发到编排后端或指定 pane |
| **Run Pipeline** | 实时跟踪编排任务执行进度 |
| **Assistant Chat** | 与 AI 助手流式对话 |
| **Task Detail** | 任务详情弹窗（intent、思考链、结果、事件时间线） |

### 配置

在 `server/config_private.json` 中添加 `butler` 配置：

```json
{
  "butler": {
    "host": "127.0.0.1",
    "port": 8080
  }
}
```

TmuxWeb 会反向代理编排后端的 REST API。具体接口规范见 `server/routes/butler-proxy.js`。

### 组件结构

```
imperial-study/
├── components/
│   ├── ImperialStudyPanel.tsx   # 主面板（组合所有子模块）
│   ├── FloatingImperialStudy.tsx # 浮窗 wrapper
│   ├── WorkerSection.tsx        # Worker 列表
│   ├── InboxSection.tsx         # 通知收件箱
│   ├── InboxDetailModal.tsx     # 通知详情弹窗
│   ├── ActivitySection.tsx      # 事件时间线
│   ├── CommandInput.tsx         # 指令输入框
│   ├── RunPipeline.tsx          # 任务执行跟踪
│   ├── AssistantChatPanel.tsx   # AI 对话面板
│   ├── TaskDetailModal.tsx      # 任务详情弹窗
│   └── WorkerContextMenu.tsx    # Worker 右键菜单
├── hooks/                       # 数据获取 hooks
└── types.ts                     # 类型定义
```

---

## 文件管理器（File Browser）

浮窗文件浏览器，支持文件浏览、媒体预览、Diff 查看、Git 历史。

### 使用方式

点击左侧活动栏的 📁 图标，弹出浮窗面板。默认打开当前终端 pane 的工作目录。

### 功能

| 功能 | 说明 |
|------|------|
| **目录浏览** | 树形文件/目录列表，支持进入子目录 |
| **文件预览** | 点击文件查看内容（支持文本文件） |
| **媒体预览** | 图片缩略图+原图打开、PDF 预览、视频播放 |
| **Diff 查看** | 对比文件的 Git 变更，统一/分块 diff 渲染 |
| **Git 历史** | 查看文件提交历史，展开查看单次 diff |
| **路径发送** | 将选中路径发送到终端 |

### 交互

- 浮窗支持拖拽移动、缩放、透明度调节、最小化/最大化/关闭
- 状态保存到 localStorage，下次打开保持位置和大小

### 组件结构

```
file-browser/
├── WebFileBrowser.tsx    # 主容器（树 + 预览面板）
├── FilePreview.tsx       # Tab 预览面板（Preview/Diff/History）
├── DiffView.tsx          # Diff 渲染器（parse diff → hunks）
├── FileHistory.tsx       # Git 历史列表
├── GitPanel.tsx          # Git 操作面板（状态/提交/比对/拉取/推送）
├── FloatingYazi.tsx      # 浮窗 wrapper
├── FloatingQuickOpen.tsx # 浮窗 wrapper（🌳 快速路径）
├── QuickOpenPanel.tsx    # 快速路径面板
├── QuickOpenSidebar.tsx  # 快速路径侧栏（备用）
├── web-file-browser-helpers.ts # 文件类型判断、路径工具
├── file-browser.css      # 浮窗 + 浏览器样式
├── floating-quick-open.css # 快速路径浮窗样式
└── quick-open-panel.css  # 快速路径面板样式
```

---

## 快速路径（Quick Open）

快速打开指定路径的目录树，支持手输路径和选择下级目录。打开后直接内嵌文件浏览器，可以浏览、预览文件。

### 使用方式

点击左侧活动栏的 🌳 图标，弹出浮窗面板。默认打开当前终端 pane 的工作目录。

### 功能

| 功能 | 说明 |
|------|------|
| **手输路径** | 输入任意路径后按回车或点"打开"，自动加载目录树 |
| **下级目录选择** | 显示当前路径每一级的子目录，点击即可快速跳转 |
| **内嵌文件浏览** | 下方直接显示文件管理器，支持预览、Diff、Git 操作 |
| **发送路径** | 将选中路径发送到终端 |

### 交互

- 浮窗支持拖拽移动、缩放、透明度调节、最小化/最大化/关闭
- 状态保存到 localStorage，下次打开保持位置和大小
- 文件管理器部分复用现有 WebFileBrowser 组件

---

## Git 操作（Git Panel）

在文件管理器内嵌的 Git 操作面板，提供仓库级别的 Git 功能，无需切换到终端。

### 使用方式

在文件管理器的工具栏中点击 Git 按钮（📂 分支图标），展开 Git 面板。仅在 Git 仓库目录下显示。

### 功能

| 功能 | 说明 |
|------|------|
| **Git 状态** | 显示当前分支名、领先/落后数、已暂存/已修改/未跟踪文件列表 |
| **智能提交** | 💡 一键调用 AI 生成中文 commit message，可编辑后提交 |
| **选择性提交** | 文件列表支持勾选排除，未勾选的文件全部提交，勾选的跳过 |
| **提交记录** | 显示最近提交历史，点击某条 commit 可查看与 HEAD 的差异 |
| **拉取/推送** | 一键 `git pull` / `git push`，自动检测当前分支，结果直接显示 |
| **自动刷新** | 任何 Git 操作完成后自动刷新文件树和状态 |

### 提交流程

1. 展开变更文件列表，默认所有文件均会提交
2. 如需跳过某些文件，勾选对应文件（勾选 = 排除）
3. 点击 💡 按钮自动生成 commit message（基于当前 diff），或手动输入
4. 点击"确认提交"

### Commit Range 比对

1. 展开"提交记录"区域
2. 点击某条 commit
3. 自动展示该 commit 到 HEAD 的差异统计 + 详细 diff

### API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/files/git/is-repo?dir=/path` | 检查目录是否为 Git 仓库 |
| GET | `/api/files/git/status?dir=/path` | 获取完整 Git 状态 |
| GET | `/api/files/git/log?dir=/path&from=sha&count=30` | 获取提交日志 |
| GET | `/api/files/git/diff-range?dir=/path&from=sha&to=HEAD` | 两个 commit 之间的差异 |
| POST | `/api/files/git/commit` | 提交（body: `{ dir, message, excludeFiles }`） |
| POST | `/api/files/git/pull` | 拉取（body: `{ dir }`） |
| POST | `/api/files/git/push` | 推送（body: `{ dir }`） |

所有接口需 token 认证。

---

## 任务追踪（Task Tracking）

自动追踪 OpenCode AI 对话的生命周期，从开始到完成。

### 工作原理

通过 OpenCode 插件 (`plugins/my-rules.js`) 自动上报任务事件：

```
OpenCode 开始对话
  → chat.message hook
  → POST /api/tasks/events { event: "task_started", pane_key }
  → 写入 MySQL + SSE 广播
  → 侧栏 pane 指示器变 🟡

OpenCode 进入空闲
  → session.idle hook
  → POST /api/tasks/events { event: "task_completed" }
  → 侧栏 pane 指示器变 🟢
```

### 生命周期状态

| 状态 | 图标 | 说明 |
|------|------|------|
| `idle` | 🔘 灰色 | 空闲 |
| `in_progress` | 🟡 黄色 | AI 正在工作 |
| `completed` | 🟢 绿色 | 任务完成 |
| `failed` | 🔴 红色 | 任务失败 |
| `waiting` | ⚪ 白色 | 等待中 |

### 查看

- **侧栏指示器**：TmuxTree 中每个 pane 旁显示状态点
- **Task Stat Badges**：侧栏顶部显示全局任务统计
- **Task History Panel**：点击 pane 状态图标或工具箱中查看，显示该 pane 的所有对话记录
- **手动标记完成**：对中断的任务，可点击 ✓ 按钮手动标记为已完成

### 实时更新

使用 SSE (Server-Sent Events) 推送状态变更，前端实时更新无需刷新。

### API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/tasks/events/stream/:paneKey` | SSE 实时事件流 |
| POST | `/api/tasks/events` | 上报任务事件 |
| GET | `/api/tasks/events/:paneKey?limit=30` | 获取 pane 任务历史 |
| GET | `/api/tasks/stats` | 全局任务统计 |
| PATCH | `/api/tasks/conv/:id/complete` | 手动标记完成 |

---

## AI 命令生成

在工具箱面板中，通过 AI 生成终端命令并发送到活跃终端。

### 使用方式

1. 在工具箱的 **AI** 标签页中选择角色
2. 输入需求描述
3. 点击生成或按回车
4. 查看生成的命令，一键发送到终端

### 角色

内置 8 个角色，支持自定义角色：

| 角色 | 说明 |
|------|------|
| CLI Expert | 命令行专家 |
| DevOps | 运维工程师 |
| Prompt Engineer | Prompt 工程师 |
| Frontend | 前端开发 |
| Backend | 后端开发 |
| UI/UX | 设计师 |
| API Architect | API 架构师 |
| Database | 数据库专家 |

每个角色可配置独立的 LLM 模型。

### 语音输入

按住 `Ctrl/Cmd + Shift + M` 或点击麦克风按钮，通过讯飞语音输入需求。

### API

| Method | Endpoint | 说明 |
|--------|----------|------|
| POST | `/api/ai/command` | 生成命令 `{ prompt, role }` |
| GET | `/api/roles` | 列出所有角色 |
| POST | `/api/roles` | 创建自定义角色 |
| PUT | `/api/roles/:id` | 更新自定义角色 |
| DELETE | `/api/roles/:id` | 删除自定义角色 |

---

## 语音识别

通过讯飞 WebSocket STT 实现语音转文字输入。

### 配置

在 `server/config_private.json` 中添加讯飞凭证：

```json
{
  "xfyun": {
    "appId": "xxx",
    "apiKey": "xxx",
    "apiSecret": "xxx"
  }
}
```

### 功能

- 按住录音，实时波形可视化
- 支持中文和英文
- 自定义热词替换（`hotwords` 配置）
- 快捷键：`Ctrl/Cmd + Shift + M`

### API

| Method | Endpoint | 说明 |
|--------|----------|------|
| WS | `/ws/speech` | 讯飞 STT 代理 WebSocket |
| GET | `/api/hotwords` | 获取热词和替换规则 |

---

## CLI History（CLI 对话历史）

浏览 OpenCode 的会话记录、工具调用详情。无需额外配置，自动读取本地 SQLite 数据库。

### 使用方式

点击左侧活动栏的 🧠 图标，弹出浮窗面板：

- **左侧**：会话列表（按当前终端工作目录自动过滤），支持搜索
- **右侧**：选中会话后查看消息详情 / 工具调用时间线
- 每条消息显示：模型名称、Agent、Token 用量
- 工具调用可展开查看完整输入/输出

### 数据源

直接读取 OpenCode 的 SQLite 数据库（只读模式）：

```
~/.local/share/opencode/opencode.db
```

表结构：`session` → `message` → `part`，解析 JSON 字段提取模型、工具、Token 等信息。

### Provider 扩展

CLI History 采用 Provider 抽象，支持对接多种 CLI 工具（OpenCode / Cursor / Aider / Claude Code 等）。

新增 Provider 只需两步：

1. 创建 `server/providers/<tool>.js`，导出：
   ```js
   module.exports = {
     id: 'tool',
     name: 'Tool Name',
     enabled: true,
     listSessions(opts)   → { sessions: [...], total },
     getSession(id)       → session detail with messages,
     getToolCalls(id, opts) → { toolCalls: [...], total },
     search(query, opts)  → { results: [...] },
   }
   ```
2. 在 `server/routes/cli-history.js` 的 `providerNames` 数组中加上 `'tool'`

### API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/cli-history/providers` | 列出可用 Provider |
| GET | `/api/cli-history/sessions?provider=opencode&limit=50&directory=/path&search=xxx` | 会话列表 |
| GET | `/api/cli-history/sessions/:id?provider=opencode` | 会话详情（含消息+parts） |
| GET | `/api/cli-history/sessions/:id/tools?provider=opencode&limit=50` | 工具调用记录 |
| GET | `/api/cli-history/search?provider=opencode&q=xxx` | 跨会话搜索 |

所有接口需 token 认证。
