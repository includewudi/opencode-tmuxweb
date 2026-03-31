# 数据模型

> 所属项目: opencode-tmuxweb (TmuxWeb) | 更新: 2026-02-27

## 概述

TmuxWeb 使用 MySQL 存储用户配置、任务追踪和 AI 对话记录。数据库设计遵循以下规则：

- **时间戳**: 统一使用 `int(11)` Unix 时间戳
- **软删除**: `is_deleted` 字段，不物理删除
- **弱关联**: 不使用外键约束，通过索引关联
- **时序分区**: 历史表使用 `year`/`mon` 字段便于按月查询

## ER 关系图

```
┌─────────────────┐      ┌─────────────────────┐
│  tmux_profile   │      │ tmux_session_group  │
│  (用户 Profile) │      │   (Session 分组)    │
└────────┬────────┘      └──────────┬──────────┘
         │                          │
         │ token + profile_key      │ group_id
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────────┐
│           tmux_session_meta                  │
│    (Session 元数据 + Pane 状态)              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           tmux_task_segment                  │
│         (AI 任务分段记录)                    │
│                   │                          │
│         ┌─────────┴─────────┐                │
│         ▼                   ▼                │
│ ┌───────────────┐   ┌───────────────┐        │
│ │tmux_chat_msg  │   │tmux_cmd_record│        │
│ │ (对话记录)    │   │ (命令记录)    │        │
│ └───────────────┘   └───────────────┘        │
│                   │                          │
│                   ▼                          │
│         ┌─────────────────┐                  │
│         │tmux_task_summary│                  │
│         │  (任务摘要)     │                  │
│         └─────────────────┘                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            ai_conversation                   │
│          (AI 对话主表)                       │
│                   │                          │
│                   ▼                          │
│     ┌───────────────────────┐                │
│     │ai_conversation_chunk  │                │
│     │   (流式输出块)        │                │
│     └───────────────────────┘                │
└─────────────────────────────────────────────┘
```

---

## 表结构详解

### 1. tmux_profile — 用户 Profile 表

存储用户的 Profile 配置（多 profile 支持）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `token` | varchar(128) | 用户 token（弱关联） |
| `profile_key` | varchar(64) | Profile 唯一标识（UUID 或 slug） |
| `name` | varchar(128) | Profile 显示名称 |
| `sort_order` | int(11) | 排序顺序（升序） |
| `ctime` | int(11) | 创建时间戳 |
| `mtime` | int(11) | 修改时间戳 |
| `status` | tinyint(4) | 状态：1=正常 |
| `is_deleted` | tinyint(4) | 软删除标记 |

**唯一索引**: `uk_token_profile` (`token`, `profile_key`)

---

### 2. tmux_session_group — Session 分组表

用户自定义的 Session 分组。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `token` | varchar(128) | 用户 token |
| `profile_key` | varchar(64) | Profile 标识 |
| `group_name` | varchar(128) | 分组名称 |
| `sort_order` | int(11) | 排序顺序 |
| `ctime` / `mtime` | int(11) | 时间戳 |
| `status` / `is_deleted` | tinyint(4) | 状态 |

---

### 3. tmux_session_meta — Session 元数据表

存储 Session 的分组归属和 Pane 状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `token` | varchar(128) | 用户 token |
| `profile_key` | varchar(64) | Profile 标识 |
| `session_name` | varchar(128) | tmux session 名称 |
| `group_id` | int(11) | 所属分组 ID（0=未分组） |
| `sort_order` | int(11) | 组内排序 |
| `pane_status` | varchar(32) | **Pane 状态**: `idle`/`in_progress`/`done` |
| `extra` | text | 扩展信息 JSON |

**唯一索引**: `uk_token_profile_session` (`token`, `profile_key`, `session_name`)

---

### 4. tmux_task_segment — 任务分段表

每个 AI 会话任务一条记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `year` / `mon` | smallint / tinyint | 时序分区字段 |
| `token` | varchar(128) | 用户 token |
| `session_name` | varchar(128) | tmux session 名称 |
| `window_index` / `pane_index` | int(11) | Window/Pane 索引 |
| `window_name` | varchar(128) | Window 名称 |
| `task_title` | varchar(256) | 任务标题（用户消息摘要） |
| `task_status` | varchar(32) | **状态**: `in_progress`/`completed` |
| `started_at` | int(11) | 开始时间戳 |
| `completed_at` | int(11) | 完成时间戳 |

**索引**: `idx_token_session`, `idx_pane`, `idx_year_mon`

---

### 5. tmux_chat_message — 对话记录表

存储 AI 对话的双向消息（user / assistant）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `year` / `mon` | smallint / tinyint | 时序分区 |
| `segment_id` | int(11) | 关联的 Segment ID |
| `role` | varchar(32) | **角色**: `user`/`assistant` |
| `content` | text | 消息内容 |
| `msg_time` | int(11) | 消息时间戳 |

---

### 6. tmux_command_record — 命令记录表

用户在终端执行的命令。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `year` / `mon` | smallint / tinyint | 时序分区 |
| `segment_id` | int(11) | 关联的 Segment ID |
| `command` | text | 命令内容 |
| `cmd_time` | int(11) | 执行时间戳 |
| `exit_code` | int(11) | 退出码 |

---

### 7. tmux_task_summary — 任务摘要表

异步生成的任务摘要（命令摘要 + 输出摘要）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `segment_id` | int(11) | 关联的 Segment ID |
| `session_name` / `window_index` | — | Session 定位 |
| `command_summary` | text | 命令摘要 |
| `output_summary` | text | 输出摘要 |
| `summary_job_id` | varchar(128) | 摘要服务 Job ID |
| `summary_status` | varchar(32) | **状态**: `pending`/`running`/`done`/`error` |
| `summary_error` | text | 错误信息 |
| `generated_at` | int(11) | 生成时间戳 |

---

### 8. ai_conversation — AI 对话主表

OpenCode CLI 回调驱动的对话记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `year` / `mon` | smallint / tinyint | 时序分区 |
| `conversation_id` | varchar(64) | **CLI 生成的对话 UUID** |
| `pane_key` | varchar(128) | Pane 标识: `session:window:pane` |
| `user_message` | text | 用户输入 |
| `assistant_message` | text | AI 完整回复 |
| `conv_status` | varchar(32) | **状态**: `in_progress`/`completed`/`aborted` |
| `started_at` / `completed_at` | int(11) | 时间戳 |

**唯一索引**: `uk_conversation_id` (`conversation_id`)

---

### 9. ai_conversation_chunk — 流式输出块表

存储 AI 回复的增量内容（流式输出）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int(11) | 主键 |
| `conversation_id` | varchar(64) | 关联的对话 ID |
| `seq` | int(11) | 块序号（按序拼接） |
| `content` | text | 增量内容 |
| `chunk_time` | int(11) | 块时间戳 |

---

## 常用查询

### 获取 Pane 当前状态

```sql
SELECT pane_status 
FROM tmux_session_meta 
WHERE token = ? AND session_name = ?;
```

### 获取用户的所有进行中任务

```sql
SELECT * FROM tmux_task_segment 
WHERE token = ? AND task_status = 'in_progress' AND is_deleted = 0
ORDER BY started_at DESC;
```

### 获取对话完整内容

```sql
SELECT content, role 
FROM tmux_chat_message 
WHERE segment_id = ? AND is_deleted = 0
ORDER BY msg_time ASC;
```

### 按月查询历史任务

```sql
SELECT * FROM tmux_task_segment 
WHERE token = ? AND year = 2026 AND mon = 2 AND is_deleted = 0;
```

---

## 相关文件

- `TmuxWeb/server/db/init.sql` — 完整 schema 初始化脚本
- `TmuxWeb/server/db/pool.js` — MySQL 连接池配置
- `TmuxWeb/server/db/bootstrap.js` — 数据库初始化入口
- `TmuxWeb/server/routes/tasks-db.js` — 任务 CRUD 路由
