# TmuxWeb 功能清单

> Web-based tmux client (Desktop + Mobile)
> **端口**: 8215 | **技术栈**: Node.js + Express 4 + WebSocket (ws) + node-pty | React 18 + Vite 5 + TypeScript + xterm.js | MySQL

---

## 一、后端 API（18 路由）

### 认证与安全
| 端点 | 说明 |
|------|------|
| `POST /api/auth/login` | HMAC HttpOnly cookie 认证 |
| `POST /api/auth/logout` | 退出登录 |
| 全局 middleware | Token 校验（cookie / query param / header） |

### Tmux 核心操作
| 端点 | 说明 |
|------|------|
| `GET /api/tmux/tree` | 完整 session → window → pane 树（含 cwd、active 状态等） |
| `GET /api/tmux/config` | tmux 配置读取 |
| `PUT /api/tmux/windows/:s/:w/rename` | 重命名窗口 |
| `GET /api/tmux/pane-mode` | 获取 pane 模式 |
| `GET /api/tmux/quick-dirs` | 快捷目录列表 |
| `POST /api/tmux/new-session` | 创建新 session |
| `POST /api/tmux/new-window` | 创建新 window |
| `POST /api/tmux/sessions/:name/rebuild` | 重建 session |

### Session/Pane 管理
| 端点 | 说明 |
|------|------|
| `PUT /api/sessions/:name/group` | 分配 session 到分组 |
| `GET /api/panes/status` | 获取 pane 工作状态 |
| `PUT /api/panes/status` | 更新 pane 状态（idle/in_progress/done/failed/waiting） |

### 任务系统
| 端点 | 说明 |
|------|------|
| `GET /api/tasks` | 任务列表 |
| `PUT /api/tasks/:id` | 更新任务 |
| `POST /api/tasks/:id/complete` | 完成任务 |
| `GET /api/tasks/:id/detail` | 任务详情 |
| `PATCH /api/tasks/conv/:id/complete` | 完成会话 |
| `POST /api/panes/:paneKey/tasks` | 为 pane 创建任务 |
| `GET /api/panes/:paneKey/tasks` | 获取 pane 的任务列表 |

### 任务事件（实时）
| 端点 | 说明 |
|------|------|
| `POST /api/tasks/events` | 上报事件（task_started/assistant_chunk/task_completed/task_failed/task_waiting） |
| `GET /api/tasks/events/:pane_key` | 获取 pane 事件历史 |
| `GET /api/tasks/events/stream/:pane_key` | **SSE 实时推送** pane 事件流 |

### 任务摘要
| 端点 | 说明 |
|------|------|
| `POST /api/tasks/:id/summarize` | AI 生成任务摘要 |
| `POST /api/tasks/:id/load-summary` | 加载已有摘要 |
| `GET /api/panes/:paneKey/summary-candidates` | 获取可摘要的候选任务 |

### 分组与配置
| 端点 | 说明 |
|------|------|
| `/api/groups` | Session 分组 CRUD |
| `/api/profiles` | Profile CRUD + 拖拽排序（事务性） |
| `/api/segments` | 聊天记录 + 命令日志（conversation/commands/logs） |

### AI 与角色
| 端点 | 说明 |
|------|------|
| `POST /api/ai/command` | LLM 命令生成（支持 per-role model 配置） |
| `/api/roles` | 8 内置 + 自定义角色 CRUD（持久化到 custom_roles.json） |
| `/api/snippets` | 命令片段 CRUD（file-based 持久化） |

### 语音与配置
| 端点 | 说明 |
|------|------|
| `/api/hotwords` | 语音识别热词注入（增删改查 + 替换规则） |
| `GET /api/opencode-config` | 读取 opencode.json + oh-my-opencode.json（project → global fallback） |

### 代理与调试
| 端点 | 说明 |
|------|------|
| `/api/butler/*` | 全路径代理 → localhost:9999/api/*（Butler 后端） |
| `/api/telemetry` | Debug 遥测（NDJSON 滚动日志，debug=1 限定） |

---

## 二、WebSocket

| 路径 | 说明 |
|------|------|
| `/ws/terminal` | PTY 终端连接（paneId + clientId，auth via token query param） |
| `/ws/speech` | 讯飞语音识别 WebSocket 代理 |

---

## 三、前端功能

### Desktop（App.tsx — 3 列布局）
- **左侧栏**: TmuxTree（session/window/pane 树）、GroupManager、ProfileSelector
- **中间**: xterm.js 终端（全功能 PTY）
- **右侧工具箱**: 御书房面板、AI 命令、Snippets、任务历史

### Mobile（MobileApp.tsx — 50/50 分屏）
- 上半: 终端
- 下半: 功能面板（御书房/AI/任务 等 tab 切换）

### 御书房（ImperialStudyPanel — 15 个文件）
- **CommandInput**: 语音/文字输入 → 意图判断 → Butler orchestrate 派工
- **WorkerSection**: 显示当前工作中的 pane + 实时状态
- **ActivitySection**: 最近活动流
- **InboxSection + InboxDetailModal**: 收件箱
- **WorkerContextMenu**: 右键菜单操作

### 共享组件
- TmuxTree、ConfigViewer、TaskStatBadges、VoiceInput
- SnippetsTab、ProfileSelector、TaskCard、TaskHistoryPanel
- RoleManagerModal、StatusBadge、NewTmuxButton、PaneDetails
- NewWindowButton、GlobalTaskOverview、LogAccordion
- LoginModal、GroupManager、AiCommandTab

### Hooks
- `useVisualViewport` — 移动端视口适配
- `useKeyboardAvoider` — 键盘避让
- `useAIConversations` — AI 对话管理
- `useNewWindow` — 新建窗口逻辑
- `useShakeDetect` — 摇一摇检测
- `useTmuxPrefix` — tmux 前缀键

---

## 四、数据库（MySQL）

| 表 | 说明 |
|-----|------|
| `tmux_session_meta` | Session 元信息 |
| `tmux_session_group` | Session 分组 |
| `tmux_profile` | 配置文件 |
| `ai_conversation` | AI 对话 |
| `ai_conversation_chunk` | 对话分块 |
| `tmux_task_segment` | 任务片段 |
| `tmux_task_summary` | 任务摘要 |
| `tmux_chat_message` | 聊天消息 |
| `tmux_command_record` | 命令记录 |

---

## 五、Services

| 服务 | 说明 |
|------|------|
| `terminal.js` | handleTerminalConnection（PTY 管理、多 client 共享）、getStats |
| `speech.js` | handleSpeechConnection（讯飞 WebSocket 代理、热词注入、音频转发） |

---

## 六、部署

- PM2 管理（ecosystem.config.js）
- 前端 Vite 5 构建，开发模式 port 5216
- 后端 Express port 8215

---

## 🔗 Butler 生态整合

### 自我认知（Project Capabilities Contract v1）

**已实现**: `GET /api/capabilities` — 返回标准化 JSON manifest

- 8 domain capabilities: terminal.manage, task.track, pane.status, ai.command, voice.input, snippet.manage, profile.manage, butler.proxy
- 25 endpoint index entries
- Runtime `base_url` resolution（协议 + host 自动适配）
- 无需 token（公开接口，与 `/health` 同级）

Butler 通过 `GET :8215/api/capabilities` 动态发现 TmuxWeb 所有可用能力。

### 在 Butler 生态中的角色

| 角色 | 说明 |
|------|------|
| **执行器** | Butler 派工 → TmuxWeb 通过 PTY 向目标 pane send-keys |
| **上下文提供者** | `/api/tmux/tree` 提供当前 tmux 拓扑，Butler 用于感知工作环境 |
| **任务追踪** | `/api/tasks/events` + SSE stream，OpenCode worker 完成后回调 |
| **Butler 代理** | `/api/butler/*` 已实现，前端直接调用 Butler API |

### 关键接口（Butler 编排调用）

1. **`GET /api/capabilities`** — 能力自报（Butler 服务发现） ✅ 已实现
2. **`GET /api/tmux/tree`** — 完整 tmux 拓扑（Butler 上下文感知）
3. **`/ws/terminal`** — PTY 终端直连（Butler 派工核心 = send-keys）
4. **`POST /api/tasks/events`** — 任务事件上报（worker 完成回调）
5. **`GET /api/tasks/events/stream/:pane_key`** — SSE 实时监听（Butler 进度追踪）
6. **`/api/butler/*`** — Butler 代理入口（手机端 ImperialStudyPanel 使用）

### 手机端特殊说明

手机端仍通过 TmuxWeb 内嵌的 ImperialStudyPanel 发送任务，走 `/api/butler/*` 代理到 Butler(:9999)。桌面端由桌宠直连 Butler。
