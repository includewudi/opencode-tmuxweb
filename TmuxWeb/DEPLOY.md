# TmuxWeb 部署文档

## 环境要求

- **Node.js** >= 18
- **tmux** 安装在服务器上（`/opt/homebrew/bin/tmux` 或 PATH 中）
- **PM2**（可选，用于进程管理）：`npm install -g pm2`
- **MySQL**（可选，任务追踪功能需要；不配置则任务功能不可用）

---

## 一、安装依赖

```bash
cd TmuxWeb
npm run install:all
```

---

## 二、配置文件

配置分两个文件：

| 文件 | 说明 |
|------|------|
| `server/config.json` | 公共配置（提交到 git） |
| `server/config_private.json` | **私有配置**（不提交 git，优先级更高） |

**首次配置**：复制模板

```bash
cp server/config.json server/config_private.json
```

然后编辑 `server/config_private.json`，只需填写你要覆盖的字段（其余字段从 `config.json` 继承）。

### 必填配置

```json
{
  "token": "你的访问密钥（自定义字符串，用于登录）",
  "sessionSecret": "随机字符串（session 加密用）"
}
```

#### 端口（可选修改）

```json
{
  "port": 8215,
  "frontendPort": 5215
}
```

> `vite.config.ts` 会自动从此处读取，无需在多处修改。

---

## 三、可选功能配置

### 3.1 AI 命令生成（LLM）

> 不配置则 AI 生成命令功能不可用，其他功能不受影响。

支持任何 OpenAI 兼容的 API（DeerAPI / DeepSeek / OpenAI / Moonshot 等）。

```json
{
  "llm": {
    "apiKey": "sk-xxxxxxxx",
    "apiUrl": "https://api.deerapi.com/v1/chat/completions",
    "model": "deepseek-v3.2"
  }
}
```

常用 API 地址：

| 服务 | API 地址 |
|------|----------|
| DeerAPI（推荐，多模型聚合） | `https://api.deerapi.com/v1/chat/completions` |
| DeepSeek 官方 | `https://api.deepseek.com/v1/chat/completions` |
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| Moonshot | `https://api.moonshot.cn/v1/chat/completions` |

### 3.2 讯飞语音识别（STT）

> 不配置则语音输入功能不可用，其他功能不受影响。

在 [讯飞开放平台](https://console.xfyun.cn/services/bmc) 创建应用，获取 `AppID`、`APIKey`、`APISecret`。

```json
{
  "xfyun": {
    "appId": "你的AppID",
    "apiKey": "你的APIKey",
    "apiSecret": "你的APISecret"
  }
}
```

### 3.3 MySQL 数据库（任务追踪）

> 不配置则任务历史功能不可用。

```json
{
  "db": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "tmuxweb"
  }
}
```

初始化数据库：

```bash
mysql -u root -p tmuxweb < server/db/init.sql
```

或用内置脚本（会自动连接 MySQL 并执行 `init.sql`）：

```bash
MYSQL_USER=root MYSQL_PASSWORD=your_password node server/db/bootstrap.js
```

---

## 四、构建前端

```bash
cd web
npm run build
```

构建产物在 `web/dist/`，由 `vite preview` 或 nginx 托管。

---

## 五、PM2 启动

```bash
# 首次启动
pm2 start ecosystem.config.js

# 已在运行时更新代码
cd web && npm run build && cd ..
pm2 reload ecosystem.config.js

# 查看状态
pm2 list

# 查看日志
pm2 logs tmuxweb-backend
pm2 logs tmuxweb-frontend
```

### 开机自启

```bash
pm2 save
pm2 startup
# 按照输出的提示执行对应命令
```

---

## 六、远程访问（可选）

### 方案 A：ZeroTier 内网穿透（推荐，免公网 IP）

见 [README.md → ZeroTier 配置](./README.md#zerotier-配置)

### 方案 B：Nginx 反向代理（有公网 IP 时）

```nginx
server {
    listen 80;
    server_name your.domain.com;

    location / {
        proxy_pass http://127.0.0.1:5215;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8215;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8215;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 七、OpenCode 插件配置

见 [README.md → OpenCode 插件](./README.md#opencode-插件my-rulesjs)

---

## 八、安全配置（重要）

### 8.1 架构说明（无需 SSH）

TmuxWeb 的连接方式：

```
手机/电脑浏览器
    ↓  HTTP / WebSocket
TmuxWeb 前端（:5215）
    ↓  WebSocket proxy
TmuxWeb 后端（:8215）
    ↓  node-pty（直接在本机创建 PTY）
本机 tmux
```

**手机不需要 SSH**，只需用浏览器访问 TmuxWeb 的 Web 界面即可。  
**node-pty 直接在运行 TmuxWeb 的机器上** fork 出终端进程，与 tmux 通信，不经过任何 SSH 连接。

> **前提**：TmuxWeb 服务（后端）必须与 tmux **运行在同一台机器上**。

### 8.2 IP 白名单（只允许信任设备访问）

TmuxWeb 通过 `allowedOrigins` 限制跨域请求来源，**只填写你实际使用的内网 IP**，不要开放所有来源。

在 `server/config_private.json` 中配置：

```json
{
  "allowedOrigins": [
    "http://192.168.1.100:5215",
    "http://10.147.20.20:5215",
    "http://10.147.20.20:8215"
  ]
}
```

> **说明**：
> - 每台客户端设备（手机、电脑）的内网 IP 单独列出
> - ZeroTier 虚拟 IP 通常为 `10.x.x.x` 段，也需要加入白名单
> - 修改后执行 `pm2 reload tmuxweb-backend` 生效

**查看你的内网 IP：**

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# ZeroTier 虚拟 IP
zerotier-cli listnetworks
```

---

### 8.3 防火墙（可选加强）

如果服务器有公网 IP，建议用防火墙只放行内网/ZeroTier 网段：

**macOS（pf）：**

```bash
# /etc/pf.conf 中添加：
# 只允许内网访问 8215/5215
pass in on en0 proto tcp from 192.168.1.0/24 to any port {5215, 8215}
block in proto tcp to any port {5215, 8215}
```

**Linux（ufw）：**

```bash
# 只允许 ZeroTier 网段（10.x.x.x）访问
sudo ufw allow from 10.0.0.0/8 to any port 5215
sudo ufw allow from 10.0.0.0/8 to any port 8215
sudo ufw deny 5215
sudo ufw deny 8215
sudo ufw enable
```

