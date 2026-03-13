# 核心架构

> 所属项目: opencode-tmuxweb (TmuxWeb) | 更新: 2026-02-27

## 整体架构

```
┌─────────────────┐     WSS      ┌─────────────────┐     PTY      ┌───────────┐
│  iPhone/iPad    │◄────────────►│  Node.js        │◄───────────►│   tmux    │
│  (React SPA)    │              │  server/index.js│              │  sessions │
└─────────────────┘              └─────────────────┘              └───────────┘
     │ /m 路由                           │
     │                                    │
┌─────────────────┐              ┌───────┴───────┐
│  Desktop        │              │   外部服务     │
│  (React SPA)    │              │  ┌─────────┐  │
└─────────────────┘              │  │ LLM API │  │
     │ / 路由                     │  │(DeepSeek│  │
     │                            │  │/OpenAI) │  │
     └────────────────────────────│  └─────────┘  │
                                  │  ┌─────────┐  │
                                  │  │讯飞 STT │  │
                                  │  │ WebSocket│  │
                                  │  └─────────┘  │
                                  └───────────────┘
```

## 后端模块

### 入口文件: `server/index.js`

- HTTP/HTTPS 自动选择（有 cert.pem/key.pem 则启用 HTTPS）
- 两个 WebSocketServer：终端连接 + 语音代理
- 路由挂载：`/api/*` 需 token 认证

```js
// 关键路由挂载
app.use('/api/auth', authRouter);           // 无需认证
app.use('/api/tasks/events', taskEventsRouter); // 任务事件推送
app.use('/api/tmux', tokenMiddleware, tmuxRouter);
app.use('/api/ai', tokenMiddleware, aiRouter);
```

### PTY 服务: `server/services/terminal.js`

**核心职责**：管理 tmux pane 的 node-pty 进程

```js
// PTY 连接池
const activePTYs = new Map();  // paneId → { ptyProcess, clients: Set<ws> }
const MAX_PTYS = 20;           // 最大并发 PTY 数

// 心跳检测僵尸连接
const HEARTBEAT_INTERVAL = 30000;  // 30s ping
const HEARTBEAT_TIMEOUT = 10000;   // 10s pong 超时
```

**连接流程**:
1. 客户端 WebSocket 连接 `/ws?target=session:window.pane`
2. 服务端检查是否已有该 pane 的 PTY 进程
3. 无则创建 `node-pty.spawn('tmux', ['attach', '-t', paneId])`
4. 多客户端共享同一 PTY（广播输出）
5. 心跳失败 → 终止连接 + 清理 PTY

### 语音服务: `server/services/speech.js`

**职责**：WebSocket 代理讯飞 STT

- 前端 `/ws/speech` 连接 → 代理到讯飞 WebSocket
- 支持热词（`hotwords.json`）
- 音频流：16kHz, 16bit, mono

### 数据库: `server/db/`

**Schema 设计**（见 `init.sql`）:

| 表 | 用途 |
|----|------|
| `tmux_profile` | 用户 Profile（token + profile_key） |
| `tmux_session_group` | Session 分组 |
| `tmux_session_meta` | Session 元数据（分组归属 + pane 状态） |
| `tmux_task_segment` | AI 任务分段（in_progress/completed） |
| `tmux_chat_message` | 对话记录 |
| `tmux_pane_summary` | Pane 摘要缓存 |

**时序表分区**: `year`/`mon` 字段用于按月查询

## 前端模块

### 路由结构: `web/src/main.tsx`

```tsx
<Routes>
  <Route path="/" element={<App />} />      // 桌面版
  <Route path="/m" element={<MobileApp />} /> // 移动版
</Routes>
```

### 桌面版: `web/src/desktop/`

- `App.tsx`: 主布局（侧边栏 + 终端 + 工具箱）
- `TerminalTabs.tsx`: 多 Session 切换
- `DesktopToolbox.tsx`: AI 命令生成 + 快捷键

### 移动版: `web/src/mobile/`

- `MobileApp.tsx`: 主布局（50/50 分屏）
- `MobileTerminal.tsx`: xterm.js 终端 + 触摸手势
- `MobileToolbox.tsx`: 工具箱（快捷键 + AI）
- `MobileDrawer.tsx`: Session 选择抽屉

### 共享组件: `web/src/components/`

- `Terminal.tsx`: xterm.js 封装，WebSocket 连接管理
- `SummarySection.tsx`: 任务摘要显示
- `AccessoryBar.tsx`: 移动端辅助工具栏

## WebSocket 协议

### 终端连接 `/ws?target=session:window.pane`

客户端 → 服务端: 发送终端输入（二进制）
服务端 → 客户端: 广播终端输出（二进制）
心跳: ping/pong（服务端发起）

### 语音连接 `/ws/speech`

客户端 → 服务端: 发送音频帧（二进制）
服务端 → 客户端: 返回识别结果（JSON）

## 配置管理

**优先级**: `config_private.json` > `config.json`

```js
// config-loader.js 合并逻辑
const config = {
  ...require('./config.json'),
  ...require('./config_private.json')  // 覆盖
};
```

**关键配置项**:

| 字段 | 说明 |
|------|------|
| `port` | 后端端口（默认 8215） |
| `frontendPort` | 前端端口（默认 5215） |
| `token` | API 认证 token |
| `allowedOrigins` | CORS 白名单 |
| `llm.apiKey/url/model` | AI 命令生成配置 |
| `xfyun.*` | 讯飞语音配置 |

## 相关文件

- `TmuxWeb/server/index.js` — 入口：Express + WebSocket
- `TmuxWeb/server/services/terminal.js` — PTY 连接管理
- `TmuxWeb/server/services/speech.js` — 讯飞 STT 代理
- `TmuxWeb/server/db/init.sql` — MySQL schema
- `TmuxWeb/server/config.json` — 公共配置
- `TmuxWeb/web/src/main.tsx` — 前端路由入口
