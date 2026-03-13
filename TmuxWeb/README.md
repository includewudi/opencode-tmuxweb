# TmuxWeb

全栈 tmux 管理 Web 应用，支持多会话终端、任务追踪和 AI 命令生成。

📖 **[完整部署文档 → DEPLOY.md](./DEPLOY.md)**

## 目录结构

```
TmuxWeb/
├── server/              # Node.js 后端（Express + node-pty + MySQL）
├── web/                 # React 前端（Vite + TypeScript）
├── plugins/             # OpenCode 插件
│   └── my-rules.js      # 任务追踪 + FAST-EDIT 规则插件
└── ecosystem.config.js  # PM2 进程配置
```

## 快速启动

```bash
# 1. 安装依赖
npm run install:all

# 2. 创建私有配置（填写 token 等）
cp server/config.json server/config_private.json

# 3. 构建前端
cd web && npm run build && cd ..

# 4. PM2 启动
pm2 start ecosystem.config.js
```

访问 `http://localhost:5215`

## 端口配置

端口统一在 `server/config_private.json` 中配置，前端 vite 自动读取：

```json
{
  "port": 8215,
  "frontendPort": 5215
}
```

---

## OpenCode 插件：my-rules.js

`plugins/my-rules.js.back` 是提交到 git 的**模板文件**。  
`plugins/my-rules.js` 是你的**本地副本**（已在 `.gitignore` 中），可自由修改。

### 首次安装

```bash
cd TmuxWeb/plugins

# 从模板创建本地副本
cp my-rules.js.back my-rules.js

# 软链接到 OpenCode 插件目录
ln -sf "$(pwd)/my-rules.js" ~/.config/opencode/plugins/my-rules.js
```

软链接建好后，直接编辑 `plugins/my-rules.js` 即实时生效。

### 工作原理

| 事件 | 动作 |
|------|------|
| `chat.message` | 记录任务开始，POST `task_started` |
| `session.idle` | 记录任务完成，POST `task_completed` |

> **注意**：如果 AI 中途被中断，任务保持"进行中"状态，可在 Web 界面手动标记完成。

---

## ZeroTier 配置

ZeroTier 可让你在没有公网 IP 的情况下，通过虚拟内网从手机/外网访问本机的 TmuxWeb。

### 1. 安装 ZeroTier

```bash
# macOS
brew install zerotier-one
sudo brew services start zerotier-one

# Linux
curl -s https://install.zerotier.com | sudo bash
```

### 2. 创建或加入网络

1. 注册 [ZeroTier Central](https://my.zerotier.com)，创建一个网络，记录 **Network ID**
2. 服务器和手机都加入同一网络：
   ```bash
   sudo zerotier-cli join <NetworkID>
   ```
3. 在 ZeroTier Central 页面勾选授权（Auth）对应设备

### 3. 配置 allowedOrigins

获取服务器的 ZeroTier IP（形如 `10.x.x.x`），加入 `server/config_private.json`：

```json
{
  "allowedOrigins": [
    "http://10.x.x.x:5215",
    "http://10.x.x.x:8215"
  ]
}
```

然后重启后端：

```bash
pm2 reload tmuxweb-backend
```

### 4. 手机访问

手机安装 ZeroTier app，加入同一网络后，浏览器访问：

```
http://10.x.x.x:5215
```

---

## 可选功能

| 功能 | 配置项 | 说明 |
|------|--------|------|
| AI 命令生成 | `llm.apiKey` / `llm.apiUrl` | 支持 OpenAI 兼容 API |
| 语音识别 | `xfyun.appId/apiKey/apiSecret` | [讯飞开放平台](https://console.xfyun.cn/services/bmc) |
| 任务追踪 | `db.*` | MySQL 数据库 |

详见 **[DEPLOY.md](./DEPLOY.md)**。
