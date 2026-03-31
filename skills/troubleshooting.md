# 故障排查指南

> 所属项目: opencode-tmuxweb (TmuxWeb) | 更新: 2026-03-14

---

## PTY 资源耗尽（macOS 硬限制 511）

### 症状

- iTerm2 无法启动 / 闪退
- `node-pty` 报错 `spawn ENOENT` 或 `Could not allocate pty`
- `tmux new-session` 失败
- 终端应用（Terminal.app、VS Code Terminal）全部无法打开新窗口

### 原因

macOS 内核限制 PTY 最大数量为 **511 个**（`/dev/pty*`）。以下场景会快速耗尽：

- **OpenCode 频繁重启** — 每次重启 OpenCode session 会创建新 PTY，旧 PTY 未必及时释放
- **PM2 无限重启** — 服务崩溃后 PM2 自动重启，每次创建新 PTY，累积泄漏
- **TmuxWeb `pty` 模式** — 每个 pane 连接独占一个 PTY，大量 pane 开着不用也占资源
- **node-pty 未正确清理** — 进程退出时没有调用 `pty.kill()` + `pty.destroy()`

### 诊断

```bash
# 查看当前 PTY 使用量
ls /dev/pty* 2>/dev/null | wc -l
# 或者
sysctl kern.tty.ptmx_max        # 系统上限（通常 127 或 511）

# 查看谁在占 PTY
lsof /dev/pty* 2>/dev/null | head -30
ps aux | grep -E 'node|opencode|tmux' | grep -v grep

# 查看 TmuxWeb PTY 使用情况
curl -sk https://localhost:8215/api/debug/pty-status \
  -H "Authorization: Bearer <token>"
```

### 解决

```bash
# 紧急释放 — 杀掉所有 node-pty 子进程
pkill -f node-pty-helper
# 或者更激进地杀 node 进程
pm2 kill
pkill -f "node server/index.js"

# 检查残留
lsof /dev/pty* 2>/dev/null | wc -l
```

### 预防

1. **PM2 设置重启上限** — `ecosystem.config.js` 中设置 `max_restarts: 10`
2. **使用 `controlmode`** — 只用一个 PTY 通过 tmux control mode 管理所有 pane
   ```json
   // config_private.json
   { "terminalMode": "controlmode" }
   ```
3. **定期检查** — 写个 cron 监控 PTY 数量
   ```bash
   # 加入 crontab -e
   */5 * * * * [ $(ls /dev/pty* 2>/dev/null | wc -l) -gt 400 ] && echo "PTY alert: $(date)" >> /tmp/pty-alert.log
   ```
4. **重启 opencode 前** — 确认旧进程已退出：`ps aux | grep opencode`

---

## 端口占用

### 症状

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:8215
```

### 诊断

```bash
lsof -i :8215
# 或
lsof -i :5215
```

### 解决

```bash
# 杀掉占用进程
kill $(lsof -ti :8215)

# 如果是 PM2 管理的
pm2 stop tmuxweb-backend
pm2 delete tmuxweb-backend
```

---

## OpenCode 集成配置

### fast-edit 插件配置

fast-edit 是一个高性能文件编辑工具，替代 OpenCode 内置的 Edit/Write 工具。

**安装步骤：**

1. 确保你有 fast-edit 技能文件（通常在 `~/.config/opencode/skills/` 下）
2. 在 `my-rules.js` 中启用 FAST-EDIT 规则：

```bash
cd TmuxWeb/plugins
cp my-rules.js.back my-rules.js         # 从模板创建本地副本
ln -sf "$(pwd)/my-rules.js" ~/.config/opencode/plugins/my-rules.js
```

3. `my-rules.js.back` 中已包含 `[FAST-EDIT]` 规则模板，会让 AI 优先使用 fast-edit：
   - 文件编辑用 `replace` / `batch`（行号定位，跳过 LSP 等待）
   - 用户粘贴内容用 `save-pasted`（零 token 消耗）
   - 大文件生成用分段 heredoc 或 `fast-generate`

4. 你可以在 `my-rules.js` 的 `MY_RULES` 字符串中添加更多自定义规则

**常见问题：**

| 问题 | 原因 | 解决 |
|------|------|------|
| AI 不使用 fast-edit | 规则未注入 | 检查 symlink：`ls -la ~/.config/opencode/plugins/my-rules.js` |
| `fe: command not found` | 未定义 shell 函数 | AI 会自动定义 `fe()` 函数，无需手动配置 |
| `save-pasted` 失败 | OpenCode 本地存储无匹配消息 | 降级用 `paste --stdin` |

### Task 事件上报配置

TmuxWeb 通过 OpenCode 插件自动追踪 AI 任务生命周期。

**工作原理：**

```
OpenCode 会话开始
  → my-rules.js 的 chat.message 钩子触发
  → 发送 task_started 事件到 TmuxWeb API
  → 侧栏 pane 状态变为 🟡 in_progress

OpenCode 会话结束（session.idle 事件）
  → my-rules.js 的 event 钩子触发
  → 发送 task_completed 事件
  → 侧栏 pane 状态变为 🟢 done
```

**配置步骤：**

1. 安装插件（见上方 fast-edit 部分的 symlink 步骤）
2. 修改 `my-rules.js` 中的端口号：
   ```javascript
   const PORT = 8215;  // 改成你的 TmuxWeb 后端端口
   ```
3. 确保 MySQL 已配置（task 事件需要数据库存储）：
   ```json
   // config_private.json
   {
     "db": {
       "host": "localhost",
       "user": "root",
       "password": "xxx",
       "database": "tmuxweb"
     }
   }
   ```
4. 没有 MySQL 时，task 事件 API 返回 503，但**不影响 OpenCode 正常工作**（插件会 catch 忽略错误）

**验证 task 上报是否正常：**

```bash
# 手动发送测试事件
curl -sk --noproxy '*' -X POST https://localhost:8215/api/tasks/events \
  -H "Content-Type: application/json" \
  -d '{"event":"task_started","pane_key":"test:0:%0","conversation_id":"test-123","user_message":"hello","timestamp":'$(date +%s)'}'

# 查看健康状态
curl -sk https://localhost:8215/healthz
# 返回 {"status":"ok","db":"ok"} 表示数据库正常
# 返回 {"status":"ok","db":"not configured"} 表示无数据库（task 功能不可用）
```

**排查事件丢失：**

| 现象 | 排查 |
|------|------|
| 侧栏无状态变化 | 检查 `healthz` → db 是否 ok |
| 事件返回 503 | MySQL 未配置或连接失败 |
| 事件返回 400 | 缺少必填字段 `event`, `conversation_id` |
| 插件静默失败 | 检查 PORT 是否正确，服务是否运行 |

---

## WebSocket 连接问题

### "RSV1 must be clear" / "Invalid frame header" 错误

**症状**: WebSocket 连接建立成功，但第一个数据包到达时立即报错

**原因**: 多个 `WebSocketServer` 实例共享同一 HTTP server 时，`ws` 库的 `path` 选项会导致冲突

**解决方案**: 使用 `noServer: true` 模式，手动路由 upgrade 事件

```javascript
// ❌ 错误写法
const wss1 = new WebSocketServer({ server, path: '/ws/terminal' });
const wss2 = new WebSocketServer({ server, path: '/ws/speech' });

// ✅ 正确写法
const terminalWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const speechWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/speech') {
    speechWss.handleUpgrade(request, socket, head, (ws) => {
      speechWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
```

**相关文件**: `TmuxWeb/server/index.js` (已修复)

---

## 终端输入问题

### iOS 端"幽灵输入"（自动触发回车/空格）

**症状**: iOS Safari PWA 中，终端自动触发用户未按下的键

**原因**: xterm.js 在 focus/blur 等事件时发送终端控制序列，直接转发给 tmux 会被误解释为输入

**需要过滤的控制序列**:

| 序列 | 含义 | 触发条件 |
|------|------|----------|
| `\x1b[I` | Focus In | 终端获得焦点 |
| `\x1b[O` | Focus Out | 终端失去焦点 |
| `\x1b[?...c` | DA1 响应 | 终端类型查询 |
| `\x1b[>...c` | DA2 响应 | 终端版本查询 |
| `\x1b]...` | OSC 序列 | 颜色查询等 |

**解决方案**: 在 `term.onData()` 中过滤特定序列

```typescript
term.onData((data) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    if (data === '\x1b[I' || data === '\x1b[O' ||
        (data.startsWith('\x1b[?') && data.endsWith('c')) ||
        (data.startsWith('\x1b[>') && data.endsWith('c')) ||
        data.startsWith('\x1b]')) {
      return;  // 不发送给后端
    }
    wsRef.current.send(data);
  }
});
```

**⚠️ 重要**: 不要过滤所有 `\x1b[` 序列！用户输入的方向键也使用此前缀

**相关文件**: `TmuxWeb/web/src/components/Terminal.tsx`

---

## HTTPS / 证书问题

### iPhone 无法连接 WebSocket

**排查步骤**:

1. 确认 HTTPS 证书存在
   ```bash
   ls -la TmuxWeb/server/cert.pem TmuxWeb/server/key.pem
   ```

2. 确认 CA 证书已安装并信任
   - 设置 → 通用 → 关于本机 → 证书信任设置
   - 必须启用对 CA 的完全信任

3. 检查 `allowedOrigins` 配置
   ```json
   { "allowedOrigins": ["https://<你的IP>:8215"] }
   ```

4. 使用 mkcert 重新生成证书
   ```bash
   cd TmuxWeb/server
   mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
   ```

---

## PTY 连接问题

### 终端无输出 / 卡死

**排查步骤**:

1. 检查 PTY 状态
   ```bash
   curl -sk -H "Authorization: Bearer <token>" https://localhost:8215/api/debug/pty-status
   ```

2. 确认 tmux session 存在
   ```bash
   tmux list-sessions
   tmux list-panes -a
   ```

3. 检查是否达到 PTY 上限（TmuxWeb 默认 20 个连接）

### 连接频繁断开

**可能原因**: 心跳超时（30s ping，10s pong 超时）、网络不稳定、浏览器后台挂起（移动端常见）

**解决方案**: 移动端监听 `visibilitychange` 事件，页面恢复时自动重连（已内置）

---

## 数据库问题

### MySQL 未配置时的行为

TmuxWeb **无需 MySQL 即可运行**。未配置时：

- 终端管理、AI 命令生成、语音输入、快捷命令 — **正常工作**
- 任务追踪、Profiles、Session 分组 — **不可用**（API 返回 503）
- 启动日志显示：`[DB] No database configured — task tracking, profiles, groups stored in-memory only`
- `healthz` 返回：`{"status":"ok","db":"not configured"}`

### 任务追踪功能不可用

1. 确认 MySQL 运行中
   ```bash
   mysql -u root -p -e "SELECT 1"
   ```

2. 检查数据库连接
   ```bash
   curl -sk https://localhost:8215/healthz
   ```

3. 创建数据库（服务器会自动建表）
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tmuxweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   ```

4. 检查配置
   ```json
   // config_private.json
   {
     "db": {
       "host": "localhost",
       "user": "root",
       "password": "xxx",
       "database": "tmuxweb"
     }
   }
   ```

---

## 语音识别问题

### 语音输入无响应

1. 确认浏览器已授权麦克风权限
2. 检查讯飞配置（`config_private.json` 中的 `xfyun`）
3. 查看后端日志：`pm2 logs tmuxweb-backend | grep -i speech`

---

## 构建问题

### 前端构建失败

```bash
# 清理并重新安装
cd TmuxWeb/web
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Node.js 版本兼容性

- **推荐**: Node.js 20.x（测试通过 v20.20.0）
- **Node.js 22+**: 可能与 node-pty 不兼容，出现编译错误
- **Node.js 18.x**: 可以工作但部分 API 可能缺失

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `TmuxWeb/server/services/terminal.js` | PTY 管理（pty 模式） |
| `TmuxWeb/server/services/terminal-controlmode.js` | PTY 管理（control mode） |
| `TmuxWeb/server/db/pool.js` | 数据库连接池 + dbEnabled 标志 |
| `TmuxWeb/server/db/bootstrap.js` | 自动建表 |
| `TmuxWeb/server/middleware/db.js` | requireDb 中间件（503 守卫） |
| `TmuxWeb/plugins/my-rules.js.back` | OpenCode 插件模板 |
| `TmuxWeb/web/src/components/Terminal.tsx` | 终端组件 |
