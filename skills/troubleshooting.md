# 故障排查指南

> 所属项目: opencode-iterm (TmuxWeb) | 更新: 2026-02-27

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
  
  if (pathname === '/ws') {
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

**参考**: `TmuxWeb/docs/errors/ws-multiple-websocketserver-rsv1-error.md`

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
    // 过滤 xterm.js 终端协议响应（非用户输入）
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

**参考**: `TmuxWeb/docs/errors/xterm-control-sequences-causing-phantom-input.md`

---

## HTTPS / 证书问题

### iPhone 无法连接 WebSocket

**症状**: iPhone Safari 显示"无法连接"或 WebSocket 连接失败

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
   {
     "allowedOrigins": [
       "https://<你的iPhone可访问的IP>:5215"
     ]
   }
   ```

4. 使用 mkcert 重新生成证书（推荐）
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
   curl -H "Authorization: Bearer <token>" https://localhost:8215/api/debug/pty-status
   ```

2. 查看后端日志
   ```bash
   pm2 logs tmuxweb-backend --lines 100
   ```

3. 确认 tmux session 存在
   ```bash
   tmux list-sessions
   tmux list-panes -a
   ```

4. 检查是否达到 PTY 上限（默认 20）
   - 如果 `totalPTYs >= maxPTYs`，需要等待其他连接释放

### 连接频繁断开

**可能原因**:
- 心跳超时（30s ping，10s pong 超时）
- 网络不稳定
- 浏览器后台挂起（移动端常见）

**解决方案**: 移动端监听 `visibilitychange` 事件，页面恢复时自动重连

---

## 数据库问题

### 任务追踪功能不可用

**症状**: 任务列表为空，无法保存任务

**排查步骤**:

1. 确认 MySQL 运行中
   ```bash
   mysql -u root -p -e "SELECT 1"
   ```

2. 检查数据库连接
   ```bash
   curl https://localhost:8215/healthz
   # 返回 {"status":"ok","db":"ok"} 表示正常
   ```

3. 初始化数据库表
   ```bash
   mysql -u root -p < TmuxWeb/server/db/init.sql
   ```

4. 检查数据库配置
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

**排查步骤**:

1. 确认浏览器已授权麦克风权限
2. 检查讯飞配置
   ```json
   {
     "xfyun": {
       "appId": "xxx",
       "apiKey": "xxx",
       "apiSecret": "xxx"
     }
   }
   ```
3. 使用调试页面测试
   - 访问 `https://localhost:5215/voice-debug.html`
4. 查看后端日志
   ```bash
   pm2 logs tmuxweb-backend | grep -i speech
   ```

---

## 构建问题

### 前端构建失败

**常见原因**:
- Node.js 版本不兼容（推荐 v20.x）
- 依赖安装不完整

```bash
# 清理并重新安装
cd TmuxWeb/web
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 后端启动失败

**检查端口占用**:
```bash
lsof -i :8215
```

**检查配置文件**:
```bash
# 确保私有配置存在
ls -la TmuxWeb/server/config_private.json
```

---

## 相关文件

- `TmuxWeb/docs/errors/` — 错误文档目录
- `TmuxWeb/server/services/terminal.js` — PTY 管理
- `TmuxWeb/web/src/components/Terminal.tsx` — 终端组件
