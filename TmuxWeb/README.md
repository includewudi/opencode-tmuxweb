# TmuxWeb

全栈 tmux 管理 Web 应用，支持多会话终端、任务追踪和 AI 命令生成。

## 目录结构

```
TmuxWeb/
├── server/          # Node.js 后端 (Express + node-pty + MySQL)
├── web/             # React 前端 (Vite + TypeScript)
├── plugins/         # OpenCode 插件
│   └── my-rules.js  # 任务追踪 + FAST-EDIT 规则插件
└── ecosystem.config.js  # PM2 进程配置
```

## 快速开始

```bash
# 安装依赖
npm run install:all

# 开发模式
npm run dev        # 后端
npm run frontend   # 前端

# 生产部署 (PM2)
pm2 start ecosystem.config.js
```

## 端口配置

默认端口在 `server/config.json` 中配置（默认 `8215`）。

---

## OpenCode 插件：my-rules.js

`plugins/my-rules.js.back` 是提交到 git 的**模板文件**。  
`plugins/my-rules.js` 是你的**本地副本**（已在 `.gitignore` 中，不会被提交），可以自由修改和扩展。

### 首次安装

```bash
cd TmuxWeb/plugins

# 1. 从模板创建本地副本
cp my-rules.js.back my-rules.js

# 2. 软链接到 OpenCode 插件目录
ln -sf "$(pwd)/my-rules.js" ~/.config/opencode/plugins/my-rules.js
```

软链接建好后，直接编辑 `plugins/my-rules.js` 即实时生效，无需重建链接。

### 修改端口

TmuxWeb 默认端口 `8215`。如果你修改了 `server/config.json` 中的端口，同步更新插件：

```js
// plugins/my-rules.js 第 18 行
const PORT = 8215;  // ← 改为你的实际端口
```

### 更新模板

当 `my-rules.js.back` 有更新时（git pull 后），可选择合并新内容到本地副本：

```bash
# 查看差异
diff plugins/my-rules.js.back plugins/my-rules.js

# 或直接覆盖（会丢失本地修改）
cp plugins/my-rules.js.back plugins/my-rules.js
```

### 工作原理

| 事件 | 动作 |
|------|------|
| `chat.message` | 记录任务开始，向 `/api/tasks/events` POST `task_started` |
| `session.idle` | 记录任务完成，向 `/api/tasks/events` POST `task_completed` |

> **注意**：如果 AI 运行中途被中断（未触发 `session.idle`），任务会保持"进行中"状态。可在 Web 界面右侧任务历史中手动点击 ✓✓ 标记为完成。

