# Plan: tmux AI Chat → Auto Task Tracking

## Goal

当用户在 tmux pane 里通过 AI CLI（opencode/claude/gemini）发送问题时，自动创建任务；AI 回复结束时，自动完成任务。通过 CLI 主动 HTTP 回调实现，而非 tmux 屏幕抓取。

## Requirements (Confirmed)

- **Event Model**: B) `task_started` + `assistant_chunk`(可选流式) + `task_completed`
- **Transport**: CLI → HTTP POST → localhost:8215
- **Pane 关联**: 回调直接传 `pane_key`（格式：`session/window/pane`）
- **Conversation 关联**: CLI 提供 `conversation_id`（UUID），同一轮对话的所有事件共享同一 id
- **Profile 处理**: 不带 `profile_key`，任务全局共享（跨 profile 可见）
- **数据存储**: 待定（A: 存 full chunks / B: 只存 summary / C: 存最近 N 条）

## Architecture

```
┌─────────────────┐       HTTP POST        ┌─────────────────┐
│  AI CLI         │ ───────────────────▶   │  TmuxWeb        │
│  (opencode/     │   /api/tasks/events    │  Backend        │
│   claude/gemini)│                        │  (port 8215)    │
└─────────────────┘                        └────────┬────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │  MySQL          │
                                           │  (task tables)  │
                                           └─────────────────┘
```

## Implementation Tasks

### Phase 1: Backend API (TmuxWeb)

1. **新增 API 路由** `POST /api/tasks/events`
   - 接收 `task_started`, `assistant_chunk`, `task_completed` 事件
   - 根据 `conversation_id` 关联同一轮对话

2. **数据库 schema 变更**
   - 新表或扩展现有表来存储：
     - `conversation_id` (主键/外键)
     - `pane_key`
     - `user_message`
     - `assistant_message` (完整或增量)
     - `status` (in_progress / completed)
     - `started_at`, `completed_at`

3. **状态机逻辑**
   - `task_started`: 创建新任务，状态=in_progress
   - `assistant_chunk`: 追加到对话记录（可选）
   - `task_completed`: 更新任务状态=completed，存最终回复

### Phase 2: CLI Skill (Already Done ✅)

- Skill 已创建: `/Users/wudi/.config/opencode/skills/tmuxweb-task-callback/SKILL.md`
- 定义了 API 接口格式、事件 payload、throttling 策略

### Phase 3: Frontend Integration (Optional)

1. **Pane Details 实时更新**
   - 当有新任务事件时，刷新任务列表
   - 可选: WebSocket 推送实时更新

2. **Conversation 展示**
   - 在 Pane Details 的 Conversation 区域显示自动追踪的对话

## API Specification

### POST /api/tasks/events

#### Request Body

```json
// task_started
{
  "event": "task_started",
  "pane_key": "session/window/pane",
  "conversation_id": "uuid",
  "user_message": "用户输入",
  "timestamp": 1739034478
}

// assistant_chunk (optional)
{
  "event": "assistant_chunk",
  "conversation_id": "uuid",
  "content": "增量文本",
  "timestamp": 1739034480
}

// task_completed
{
  "event": "task_completed",
  "conversation_id": "uuid",
  "assistant_message": "完整回复",
  "timestamp": 1739034485
}
```

#### Response

```json
{ "success": true }
```

## Database Schema (Draft)

```sql
CREATE TABLE ai_conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL UNIQUE,
  pane_key VARCHAR(128) NOT NULL,
  user_message TEXT,
  assistant_message TEXT,
  status ENUM('in_progress', 'completed', 'aborted') DEFAULT 'in_progress',
  started_at INT,
  completed_at INT,
  ctime INT,
  mtime INT,
  INDEX idx_pane_key (pane_key),
  INDEX idx_status (status)
);

-- Optional: for storing chunks
CREATE TABLE ai_conversation_chunk (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  content TEXT,
  seq INT,
  timestamp INT,
  INDEX idx_conversation (conversation_id)
);
```

## Open Decisions

- [ ] 是否存储 chunks？（A: 全存 / B: 只存 summary / C: 存最近 N 条）
- [ ] 前端是否需要实时推送？（WebSocket vs 轮询）
- [ ] 是否需要鉴权？（当前假设 localhost 可信）

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `TmuxWeb/server/routes/task-events.js` | CREATE | 新增 /api/tasks/events 路由 |
| `TmuxWeb/server/app.js` | MODIFY | 注册新路由 |
| `TmuxWeb/server/schema.sql` (或迁移) | MODIFY | 添加 ai_conversation 表 |
| `~/.config/opencode/skills/tmuxweb-task-callback/SKILL.md` | DONE ✅ | CLI skill 已创建 |

## Verification

1. 用 curl 模拟发送三个事件
2. 查询数据库确认数据落库
3. 在 Pane Details 确认任务显示
