# API 文档

> 所属项目: opencode-tmuxweb (TmuxWeb) | 更新: 2026-02-27

## 认证

大部分 API 需要 token 认证，通过以下方式之一传递：

1. **Cookie**: `token=<your-token>`
2. **Query 参数**: `?token=<your-token>`
3. **Header**: `Authorization: Bearer <your-token>`

无 token 的路由：`/api/auth/*`, `/api/tasks/events`

---

## REST API

### 认证 `/api/auth`

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录验证 token |
| GET | `/api/auth/check` | 检查当前登录状态 |

### Tmux 会话 `/api/sessions`, `/api/tmux`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 列出所有 tmux sessions |
| GET | `/api/panes?session=<name>` | 列出 session 中的 panes |
| POST | `/api/tmux/new-window` | 创建新 window |
| POST | `/api/tmux/kill-pane` | 关闭 pane |

### AI 命令生成 `/api/ai`

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/ai/command` | 生成 AI 命令 |

**请求体**:
```json
{
  "prompt": "列出当前目录下的所有文件",
  "role": "cli"
}
```

**响应**:
```json
{
  "command": "ls -la"
}
```

**内置角色 ID**:
- `cli` — 命令行大神
- `ops` — 运维专家
- `prompt` — 提示词优化
- `frontend` — 前端优化
- `backend` — 后端优化
- `ui` — UI 优化
- `api` — API 架构师

### 自定义角色 `/api/roles`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/roles` | 列出所有角色（内置 + 自定义） |
| POST | `/api/roles` | 创建自定义角色 |
| PUT | `/api/roles/:id` | 编辑自定义角色 |
| DELETE | `/api/roles/:id` | 删除自定义角色 |

**角色结构**:
```json
{
  "id": "custom-1",
  "name": "Git 专家",
  "systemPrompt": "你是 Git 专家...",
  "model": "gpt-4o"
}
```

### 任务追踪 `/api/tasks`, `/api/panes/:paneKey/tasks`

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 列出所有任务 |
| GET | `/api/tasks/:id` | 获取任务详情 |
| PUT | `/api/tasks/:id/complete` | 标记任务完成 |
| GET | `/api/tasks/summaries` | 获取任务摘要列表 |
| GET | `/api/panes/:paneKey/tasks` | 获取 pane 的任务 |
| GET | `/api/panes/:paneKey/summary` | 获取 pane 摘要 |

### Profile & 分组

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/profiles` | 列出所有 profiles |
| POST | `/api/profiles` | 创建 profile |
| GET | `/api/groups` | 列出 session 分组 |
| POST | `/api/groups` | 创建分组 |

### 其他

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/snippets` | 列出命令片段 |
| POST | `/api/snippets` | 保存命令片段 |
| GET | `/api/hotwords` | 列出语音热词 |
| GET | `/api/telemetry` | 遥测数据 |
| GET | `/health` | 健康检查（无需认证） |
| GET | `/healthz` | 健康检查 + DB 连接测试 |

---

## WebSocket

### 终端连接 `/ws`

**连接 URL**: `wss://<host>:8215/ws?target=<session>:<window>.<pane>`

**参数**:
- `target`: tmux pane 标识，格式 `session:window.pane`（如 `main:0.1`）

**消息格式**: 二进制（Raw PTY 数据）

**心跳**: 服务端每 30s 发送 ping，客户端需回复 pong

### 语音代理 `/ws/speech`

**连接 URL**: `wss://<host>:8215/ws/speech`

**消息格式**:
- 客户端 → 服务端: 二进制音频帧（16kHz, 16bit, mono）
- 服务端 → 客户端: JSON 识别结果

**识别结果格式**:
```json
{
  "status": 0,
  "result": {
    "bg": 0,
    "ed": 0,
    "pgs": "apd",
    "rg": [0, 10],
    "sn": 1,
    "ls": false,
    "ws": [
      {
        "bg": 0,
        "cw": [
          {
            "w": "你好",
            "mp": "",
            "nm": 0
          }
        ]
      }
    ]
  }
}
```

### 任务事件 `/api/tasks/events`

**用于 OpenCode 插件推送 AI 会话事件**

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/tasks/events` | 推送任务事件 |

**请求体**:
```json
{
  "event": "task_started",
  "pane_key": "main/0/%1",
  "conversation_id": "uuid",
  "user_message": "修复 bug",
  "timestamp": 1709012345
}
```

**事件类型**:
- `task_started` — AI 会话开始
- `task_completed` — AI 会话完成

---

## 错误响应

所有错误返回统一格式：

```json
{
  "error": "error_code",
  "message": "详细错误信息"
}
```

**常见错误码**:
- `unauthorized` — token 无效或缺失
- `not_found` — 资源不存在
- `internal_error` — 服务器内部错误

## 相关文件

- `TmuxWeb/server/routes/*.js` — 各模块路由实现
- `TmuxWeb/server/middleware/auth.js` — token 认证中间件
- `TmuxWeb/server/services/terminal.js` — WebSocket 终端处理
- `TmuxWeb/server/services/speech.js` — 语音代理实现
