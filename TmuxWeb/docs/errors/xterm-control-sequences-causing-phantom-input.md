# xterm.js 控制序列导致幽灵输入

## 问题现象

iOS Safari PWA 中，终端自动触发回车/空格等输入，用户没有按任何键。

## 根本原因

xterm.js 会在特定事件发生时，通过 `onData` 回调发送终端控制序列。这些序列本应由终端模拟器内部处理，但如果直接转发给后端（如 tmux），会被误解释为用户输入。

### 常见的控制序列

| 序列 | 含义 | 触发条件 |
|------|------|----------|
| `\x1b[I` | Focus In | 终端获得焦点 |
| `\x1b[O` | Focus Out | 终端失去焦点 |
| `\x1b[?1;2c` | DA1 响应 | 终端类型查询 |
| `\x1b[>0;276;0c` | DA2 响应 | 终端版本查询 |
| `\x1b]10;rgb:...` | OSC 10 | 前景色查询响应 |
| `\x1b]11;rgb:...` | OSC 11 | 背景色查询响应 |

### 为什么 iOS 更容易触发

- iOS Safari PWA 的 focus/blur 事件比桌面浏览器更频繁
- 页面可见性变化（切换 app、锁屏）触发 focus 事件
- 虚拟键盘弹出/收起触发 focus 事件

## 解决方案

在 `term.onData()` 中过滤**特定的**控制序列，不发送给后端：

```typescript
term.onData((data) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    // 过滤 xterm.js 终端协议响应（非用户输入）
    // Focus: \x1b[I, \x1b[O | DA1: \x1b[?...c | DA2: \x1b[>...c | OSC: \x1b]...
    if (data === '\x1b[I' || data === '\x1b[O' ||
        (data.startsWith('\x1b[?') && data.endsWith('c')) ||
        (data.startsWith('\x1b[>') && data.endsWith('c')) ||
        data.startsWith('\x1b]')) {
      return
    }
    
    wsRef.current.send(data)
  }
})
```

### ⚠️ 重要：不要过滤所有 `\x1b[` 序列！

错误做法：
```typescript
// ❌ 会阻止方向键等用户输入
if (data.startsWith('\x1b[')) return
```

正确做法：只过滤特定的终端协议序列，因为用户输入也使用 `\x1b[` 前缀：
- `\x1b[A` = 上箭头
- `\x1b[B` = 下箭头
- `\x1b[C` = 右箭头
- `\x1b[D` = 左箭头
- `\x1b[1;5A` = Ctrl+上箭头（修饰键）

## 影响的文件

- `TmuxWeb/web/src/components/Terminal.tsx`

## 调试方法

添加日志查看 `onData` 收到的内容：

```typescript
term.onData((data) => {
  const charCodes = [...data].map(c => c.charCodeAt(0))
  console.log('[Terminal] onData:', { 
    data: JSON.stringify(data), 
    charCodes, 
    len: data.length 
  })
})
```

后端日志：

```bash
pm2 logs tmuxweb-backend --lines 50
```

## 相关问题

- [xterm.js Issue #5499](https://github.com/xtermjs/xterm.js/issues/5499) - Safari 输入问题
- [xterm.js Issue #5374](https://github.com/xtermjs/xterm.js/issues/5374) - Safari IME 问题

## 日期

2026-02-09
