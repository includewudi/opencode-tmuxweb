---
name: opencode-tmuxweb
description: Web-based tmux 终端客户端，支持 iPhone/iPad/桌面，带 AI 命令生成和语音输入
---

# opencode-tmuxweb (TmuxWeb)

**TmuxWeb** 是一个 Web 端的 tmux 终端客户端，核心场景是从 iPhone/iPad 远程管理 macOS 上的 tmux 会话。支持 AI 命令生成（DeepSeek/OpenAI）和讯飞语音输入。

## 技术栈

- **后端**: Node.js 18-20, Express 4, WebSocket (ws), node-pty
- **前端**: React 18, Vite 5, TypeScript, xterm.js
- **数据库**: MySQL 5.7+ (mysql2/promise)
- **外部服务**: LLM API (DeepSeek/OpenAI), 讯飞语音 STT
- **部署**: PM2

## 目录结构

```
opencode-tmuxweb/
├── TmuxWeb/                 # 主项目（Node.js + React）
│   ├── server/              # Express 后端
│   │   ├── index.js         # 入口：HTTP/S + WebSocket
│   │   ├── routes/          # API 路由（18个文件）
│   │   ├── services/        # 核心服务
│   │   │   ├── terminal.js  # PTY 连接管理
│   │   │   └── speech.js    # 讯飞 STT 代理
│   │   └── db/              # MySQL 连接池 + schema
│   ├── web/                 # React 前端
│   │   └── src/
│   │       ├── desktop/     # 桌面版 UI
│   │       ├── mobile/      # 移动版 UI（/m 路由）
│   │       └── components/  # 共享组件
│   └── ecosystem.config.js  # PM2 配置
└── skills/                  # 项目技能文档（API、架构、数据模型）
```

## 核心能力

| 能力 | 说明 | 详见 |
|------|------|------|
| 终端连接 | WebSocket + node-pty 连接 tmux pane | [architecture.md](architecture.md) |
| AI 命令生成 | 7 种内置角色 + 自定义角色 | [api.md](api.md) |
| 语音输入 | 讯飞 STT WebSocket 代理 | [architecture.md](architecture.md) |
| 任务追踪 | AI 会话 → MySQL 任务记录 | [api.md](api.md) |
| 双端 UI | 桌面 `/` + 移动 `/m` | [development.md](development.md) |

| 文件 | 内容 |
|------|------|
| [architecture.md](architecture.md) | 核心架构、WebSocket 数据流、PTY 管理 |
| [api.md](api.md) | REST API 端点、WebSocket 协议 |
| [development.md](development.md) | 开发环境、构建、部署 |
| [data-model.md](data-model.md) | 数据库 Schema、ER 关系、常用查询 |
| [troubleshooting.md](troubleshooting.md) | 故障排查、已知问题解决方案 |


## 快速开始

```bash
cd TmuxWeb
npm run install:all          # 安装前后端依赖
npm run build               # 构建前端
cp server/config.json server/config_private.json  # 创建私有配置
node server/index.js        # 启动服务
```

访问 `https://<ip>:8215`（HTTPS 需要 mkcert 证书）。

## 注意事项

1. **Node.js 版本**: 推荐 v20.x，v22+ 可能有兼容问题
2. **证书**: iPhone 访问需要 HTTPS，用 mkcert 生成证书并安装 CA
3. **token 认证**: 所有 API 需要配置 `config_private.json` 中的 token
4. **MySQL**: 任务追踪功能依赖 MySQL，需先执行 `server/db/init.sql`
