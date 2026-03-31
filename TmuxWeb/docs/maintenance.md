# TmuxWeb 运维维护手册

## 僵尸任务清理

### 问题描述

OpenCode 插件在每次对话开始时发送 `task_started` 事件，将 `ai_conversation` 记录设为 `in_progress`，同时同步到 `tmux_session_meta.extra.panes` 供侧边栏显示。

但如果 AI 中途被中断（用户取消、网络断开、进程崩溃等），`task_completed` 事件不会触发，导致：

1. `ai_conversation` 表中大量记录停留在 `in_progress` 状态
2. `tmux_session_meta.extra.panes` 中对应 pane 一直显示"进行中"
3. 侧边栏 TmuxTree 持续显示虚假的蓝色旋转图标

### 诊断

```bash
# 查看僵尸任务数量
mysql -u root -p tmuxweb -e "
  SELECT conv_status, COUNT(*) as cnt 
  FROM ai_conversation 
  GROUP BY conv_status"

# 按 pane 分组查看僵尸任务
mysql -u root -p tmuxweb -e "
  SELECT pane_key, COUNT(*) as cnt 
  FROM ai_conversation 
  WHERE conv_status = 'in_progress' 
  GROUP BY pane_key"

# 查看 session_meta 中的非 idle 状态
mysql -u root -p tmuxweb -e "
  SELECT session_name, extra 
  FROM tmux_session_meta 
  WHERE extra LIKE '%in_progress%' 
     OR extra LIKE '%failed%' 
     OR extra LIKE '%waiting%'"
```

### 清理

```bash
# 1. 将所有僵尸 in_progress 标记为 aborted
mysql -u root -p tmuxweb -e "
  UPDATE ai_conversation 
  SET conv_status = 'aborted', mtime = UNIX_TIMESTAMP() 
  WHERE conv_status = 'in_progress'"

# 2. 重置 session_meta 中的 pane 状态（清空 panes 对象）
mysql -u root -p tmuxweb -e "
  UPDATE tmux_session_meta 
  SET extra = JSON_SET(extra, '\$.panes', JSON_OBJECT()), 
      mtime = UNIX_TIMESTAMP() 
  WHERE extra LIKE '%in_progress%' 
     OR extra LIKE '%failed%' 
     OR extra LIKE '%waiting%'"
```

清理后刷新浏览器，侧边栏状态会恢复正常。新的 `task_started` 事件进来时会正常显示。

### 预防机制

`task_started` 事件处理器中已有自动清理逻辑（`server/routes/task-events.js`）：

```js
// 同一 pane 上的旧 in_progress 记录会被自动标记为 aborted
await pool.query(
  `UPDATE ai_conversation SET conv_status = "aborted", mtime = ? 
   WHERE pane_key = ? AND conv_status = "in_progress" AND conversation_id != ?`,
  [now, paneKey, conversation_id]
);
```

但这只在新任务启动时触发。如果某个 pane 长时间没有新任务，僵尸记录会一直存在。

---

## 前端构建与部署

### 问题：界面没有更新

前端使用 `vite preview` 服务 `web/dist/` 静态文件。代码修改后**必须重新构建**才能生效。

### 流程

```bash
cd TmuxWeb/web

# 1. 重新构建
npm run build

# 2. 重启前端服务
pm2 restart tmuxweb-${envName}-frontend  # envName 来自 config，默认 prod
```

### 验证

检查 `dist/` 目录的修改时间：

```bash
ls -la TmuxWeb/web/dist/
```

如果时间早于最近的代码修改，说明需要重新构建。

---

## PM2 服务管理

### 实例命名

PM2 进程名由 `config.json`（或 `config_private.json`）中的 `envName` 字段决定，格式为 `tmuxweb-{envName}-backend` / `tmuxweb-{envName}-frontend`。

| envName | 后端名称 | 前端名称 | 说明 |
|---------|----------|----------|------|
| `prod`（默认） | tmuxweb-prod-backend | tmuxweb-prod-frontend | 生产环境 |
| `dev` | tmuxweb-dev-backend | tmuxweb-dev-frontend | 开发环境 |

端口同样从 config 读取：`port`（后端）、`frontendPort`（前端 vite preview）。

### 常用命令

```bash
# 重启
pm2 restart tmuxweb-prod-backend tmuxweb-prod-frontend  # 按实际 envName 替换

# 查看日志
pm2 logs tmuxweb-prod-backend --lines 30 --nostream
pm2 logs tmuxweb-prod-frontend --lines 30 --nostream

# 查看状态
pm2 status
```

---

## Git 多仓库推送

如需同时推送到多个远程仓库，可为 `origin` 添加多个 push URL：

```bash
# 查看当前 remote
git remote -v

# 添加第二个 push URL
git remote set-url --add --push origin git@github.com:<user>/<repo>.git
git remote set-url --add --push origin git@your-gitlab.com:<user>/<repo>.git
```

配置后 `git push` 会同时推送到所有仓库。

---

## 数据库

### 连接信息

- Host: 127.0.0.1
- User: root
- Password: `<your_password>`
- Database: tmuxweb

### 关键表

| 表 | 用途 |
|----|------|
| `ai_conversation` | AI 对话记录（含任务状态 conv_status） |
| `ai_conversation_chunk` | AI 对话内容分块 |
| `tmux_session_meta` | Session 元数据（含 pane 状态 extra.panes） |

### conv_status 状态机

```
task_started  → in_progress
task_completed → completed
task_failed   → failed
task_waiting  → waiting
中断/超时     → 需手动清理为 aborted
新任务启动    → 旧 in_progress 自动变 aborted（同 pane 内）
```
