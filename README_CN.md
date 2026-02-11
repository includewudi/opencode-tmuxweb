# OpenCode iTerm 🖥️

English | [中文版](README_CN.md)

> 通过浏览器管理 tmux 终端会话，支持 AI 命令生成和语音输入，专为 iPhone/iPad 优化。

## ✨ 功能特性

### 📱 浏览器终端
- 从 iPhone/iPad/桌面浏览器访问 tmux 会话
- 完整的 xterm.js 终端，触屏友好
- 自动重连机制（8 次重试 → 自动刷新页面）
- HTTPS/WSS 加密通信

### 🤖 AI 命令生成
- **7 个内置角色**：命令行大神、运维专家、提示词优化、前端优化、后端优化、UI 优化、API 转换
- **自定义角色**：通过 UI 或 API 创建/编辑/删除
- 每个角色可配置不同的 LLM 模型
- 一键发送到终端执行

### 🎤 语音输入
- 科大讯飞语音识别（STT）
- 长按录音，波形可视化
- 支持中英文

### 🔧 工具箱
- 快捷键（Tab、Ctrl+C、Ctrl+Z、方向键等）
- 命令片段（保存/加载/删除常用命令）
- 键盘切换

## 📐 架构

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│  iPhone/iPad │◄───►│  Node.js     │◄───►│   tmux    │
│  (React SPA) │ WSS │  server.js   │ PTY │   会话     │
└─────────────┘     └──────────────┘     └───────────┘
                          │
                    ┌─────┴─────┐
                    │  LLM API  │
                    │ (DeepSeek │
                    │  /OpenAI) │
                    └───────────┘
```

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite, xterm.js, Lucide Icons |
| 后端 | Node.js, WebSocket (ws), Python PTY |
| 终端 | tmux, Bash/Zsh |
| AI | DeepSeek / OpenAI 兼容 API |
| 语音 | 科大讯飞 WebSocket STT |

## 🚀 快速开始

### 环境要求
- macOS + tmux
- Node.js ≥ 18
- Python 3

### 安装部署

```bash
# 克隆 & 安装
git clone https://github.com/includewudi/opencode-iterm.git
cd opencode-iterm/web

npm install
cd app && npm install && npx vite build && cd ..

# 配置 LLM（可选，用于 AI 功能）
cat > config_private.json << 'EOF'
{
  "llm": {
    "apiKey": "your-api-key",
    "apiUrl": "https://api.deerapi.com/v1/chat/completions",
    "model": "deepseek-v3.2"
  }
}
EOF
```

### SSL 证书配置（iPhone 访问必需）

**方案 A：mkcert（推荐，浏览器无警告）**

```bash
brew install mkcert
mkcert -install
cd opencode-iterm/web
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
```

**iPhone 安装 CA 证书：**
1. 启动 server 后，用 iPhone Safari 打开 `http://<你的IP>:8280`（自动提供下载页）
2. 点击"下载 CA 证书"
3. 设置 → 已下载描述文件 → 安装
4. 设置 → 通用 → 关于本机 → 证书信任设置 → 启用完全信任

**方案 B：自签名证书（浏览器会有安全提示）**

```bash
cd opencode-iterm/web
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem -subj "/CN=localhost"
```

> 如果没有证书文件，server 自动降级为 HTTP 模式（无 WSS，iPhone 支持有限）。

### 启动服务

```bash
cd opencode-iterm/web
node server.js
# 或使用 pm2 守护进程：
# pm2 start ecosystem.config.js
```

在 iPhone 打开 `https://<你的IP>:8215` 即可使用。

## 📡 API 接口

### tmux 会话
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取 tmux 会话列表 |
| GET | `/api/panes?session=<name>` | 获取会话中的窗格 |

### AI 命令生成
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/command` | AI 生成命令 `{prompt, role}` |

### 自定义角色
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/roles` | 获取所有角色（内置+自定义） |
| POST | `/api/roles` | 创建自定义角色 |
| PUT | `/api/roles/:id` | 编辑自定义角色 |
| DELETE | `/api/roles/:id` | 删除自定义角色 |

### WebSocket
| 路径 | 说明 |
|------|------|
| `/ws?target=session:window.pane` | 终端 PTY 连接 |
| `/ws/speech` | 讯飞语音代理 |

## ⚙️ 配置说明

### `config_private.json`（已 gitignore）

```json
{
  "llm": {
    "apiKey": "sk-xxx",
    "apiUrl": "https://api.deepseek.com/v1/chat/completions",
    "model": "deepseek-chat",
    "roles": {
      "cli": { "model": "gpt-4o" },
      "prompt": { "model": "claude-3-sonnet" }
    }
  },
  "xunfei": {
    "appId": "xxx",
    "apiKey": "xxx",
    "apiSecret": "xxx"
  }
}
```

### 自定义角色数据

自定义角色存储在 `custom_roles.json`（自动生成，已 gitignore）：

```json
[
  {
    "id": "k8s",
    "emoji": "☸️",
    "label": "K8s专家",
    "desc": "Kubernetes 部署运维",
    "prompt": "你是 Kubernetes 专家...",
    "suffix": "请输出 K8s 配置方案..."
  }
]
```

## 📜 许可证

MIT
