# cli-history-sdk

读取 AI 编程工具（OpenCode / Cursor / Aider 等）的本地会话历史。Provider 抽象架构，开箱支持 OpenCode SQLite，可扩展。

## 它能做什么

- 列出所有 AI 对话 session（按项目目录过滤、搜索、分页）
- 查看 session 内的完整消息（含模型名、token 用量、agent 信息）
- 查看工具调用详情（tool name、输入输出、耗时）
- 跨 session 全文搜索
- 一行代码挂载 Express REST API

## 安装

### 方式 1：npm link（推荐，多项目共享）

```bash
# 1. 在 SDK 目录注册全局链接
cd TmuxWeb/packages/cli-history-sdk
npm link

# 2. 在你的项目中链接
cd /path/to/your-project
npm link cli-history-sdk
```

> `npm link` 创建全局符号链接，所有项目共享同一份源码。修改 SDK 立即生效，无需重新安装。

### 方式 2：绝对路径引用

```bash
# 直接 install 绝对路径
npm install /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm-dev/TmuxWeb/packages/cli-history-sdk
```

或手动写进 `package.json`：

```json
{
  "dependencies": {
    "cli-history-sdk": "file:/Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm-dev/TmuxWeb/packages/cli-history-sdk"
  }
}
```

### 方式 3：相对路径（monorepo 内部）

```json
{
  "dependencies": {
    "cli-history-sdk": "file:packages/cli-history-sdk"
  }
}
```

### 依赖说明

- `better-sqlite3` — 已包含在 SDK 的 dependencies 中，自动安装
- `express` >=4 — peerDependency，仅使用 Express 中间件时需要（标记为 optional）

## 使用

### 纯 API（任何 Node.js 项目）

```js
const { createProvider } = require('cli-history-sdk');

// 创建 provider（dbPath 可选，默认 ~/.local/share/opencode/opencode.db）
const provider = createProvider('opencode', {
  dbPath: '/custom/path/opencode.db'   // 可选
});

// 检查是否可用（DB 文件存在且可读）
if (!provider.enabled) {
  console.log('OpenCode DB not found');
  process.exit(1);
}

// 列出 session
const { sessions, total } = provider.listSessions({
  limit: 20,                    // 每页数量（默认 30，最大 200）
  offset: 0,                    // 分页偏移
  search: 'auth',               // 按标题搜索
  directory: '/path/to/project' // 按工作目录过滤
});

// 查看 session 详情（含完整消息）
const session = provider.getSession(sessions[0].id);
session.messages.forEach(msg => {
  console.log(`[${msg.role}] ${msg.modelID || ''}`);
  msg.parts.forEach(part => {
    if (part.type === 'text') console.log(part.text?.substring(0, 100));
    if (part.type === 'tool') console.log(`  🔧 ${part.tool} (${part.duration}ms)`);
  });
});

// 查看工具调用记录
const { toolCalls } = provider.getToolCalls(sessions[0].id, { limit: 50 });

// 跨 session 全文搜索
const results = provider.search('database migration', { limit: 10 });
```

### Express 中间件（一行挂载 REST API）

```js
const express = require('express');
const { createRouter } = require('cli-history-sdk/express');

const app = express();

// 默认配置
app.use('/api/cli-history', createRouter());

// 自定义配置
app.use('/api/cli-history', createRouter({
  providers: ['opencode'],           // 启用的 provider 列表
  providerOpts: {                    // 传给 provider 的选项
    dbPath: '/custom/path/opencode.db'
  }
}));

app.listen(3000);
```

挂载后自动获得以下 API：

| Method | Path | 说明 |
|--------|------|------|
| GET | `/providers` | 列出可用 provider 及状态 |
| GET | `/sessions` | Session 列表（`?provider` `?search` `?limit` `?offset` `?directory`） |
| GET | `/sessions/:id` | Session 详情（含完整消息 + parts） |
| GET | `/sessions/:id/tools` | 工具调用记录（`?limit` `?offset`） |
| GET | `/search` | 跨 session 搜索（`?provider` `?q` `?limit`） |

### 快速验证

```bash
# 检查 SDK 是否正常
node -e "
  const { createProvider } = require('cli-history-sdk');
  const p = createProvider('opencode');
  console.log('enabled:', p.enabled);
  if (p.enabled) {
    const { total } = p.listSessions({ limit: 1 });
    console.log('total sessions:', total);
  }
"
```

## 数据结构

### Session

```js
{
  id: 'ses_abc123',
  title: 'Fix auth middleware',
  directory: '/path/to/project',
  projectName: 'my-project',
  projectPath: '/path/to/project',
  agent: 'claude-sonnet',
  messageCount: 12,
  timeCreated: 1712100000,    // unix seconds
  timeUpdated: 1712103600,
}
```

### Message

```js
{
  id: 'msg_xyz',
  role: 'assistant',           // 'user' | 'assistant'
  agent: 'claude-sonnet',
  modelID: 'claude-sonnet-4-20250514',
  providerID: 'anthropic',
  tokens: { total: 1500, input: 500, output: 1000, reasoning: 0 },
  error: null,                 // 或 { name, message, statusCode, isRetryable }
  timeCreated: 1712100000,
  timeUpdated: 1712100005,
  parts: [
    { id: 'p1', type: 'text', text: 'I will fix the auth...' },
    { id: 'p2', type: 'tool', tool: 'edit', callID: 'call_1',
      status: 'completed', input: {...}, output: '...', duration: 150 }
  ]
}
```

### ToolCall

```js
{
  id: 'part_id',
  tool: 'bash',
  callID: 'call_abc',
  status: 'completed',
  input: { command: 'npm test' },
  output: 'All tests passed',
  duration: 3200,              // ms
  timeCreated: 1712100010,
}
```

### SearchResult

```js
{
  sessionId: 'ses_abc',
  sessionTitle: 'Fix auth middleware',
  matchType: 'content',        // 'title' | 'content'
  context: 'matched text snippet...',
  timeUpdated: 1712103600,
}
```

## 扩展：添加新 Provider

支持对接 Cursor / Aider / Claude Code 等工具的历史数据。3 步完成：

**1. 创建 Provider 文件**

```js
// src/providers/cursor.js
function createCursorProvider(opts = {}) {
  // 读取 Cursor 的本地存储 ...
  return {
    id: 'cursor',
    name: 'Cursor',
    get enabled() { return _enabled; },
    listSessions,
    getSession,
    getToolCalls,
    search,
  };
}
module.exports = { createCursorProvider };
```

**2. 注册到 express-plugin.js**

```js
const BUILTIN_PROVIDERS = {
  opencode: require('./providers/opencode'),
  cursor: require('./providers/cursor'),     // ← 加这行
};
```

**3. 注册到 index.js**

```js
case 'cursor':
  return createCursorProvider(opts);
```

Provider 接口契约详见 `src/providers/base.js`。

## 目录结构

```
cli-history-sdk/
├── src/
│   ├── index.js              # 统一入口：createProvider + createRouter
│   ├── express-plugin.js     # Express Router 工厂
│   └── providers/
│       ├── base.js           # Provider 接口契约（类型文档）
│       └── opencode.js       # OpenCode SQLite Provider
├── package.json
└── README.md
```

## License

MIT
