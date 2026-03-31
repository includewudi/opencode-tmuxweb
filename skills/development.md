# 开发指南

> 所属项目: opencode-tmuxweb (TmuxWeb) | 更新: 2026-02-27

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | v18.x ~ v20.x | v22+ 可能有兼容问题 |
| npm | ≥ 8.x | 随 Node.js 安装 |
| MySQL | 5.7+ | 任务追踪功能需要 |
| tmux | ≥ 3.0 | 需开启 `mouse on` |
| Python 3 | — | PTY helper（可选） |

## 项目初始化

```bash
# 1. 克隆项目
git clone https://github.com/includewudi/opencode-tmuxweb.git
cd opencode-tmuxweb/TmuxWeb

# 2. 安装依赖
npm run install:all

# 3. 创建私有配置
cp server/config.json server/config_private.json
# 编辑 config_private.json，填写 token、LLM API 等

# 4. 初始化数据库（如需任务追踪）
mysql -u root -p < server/db/init.sql
```

## 开发命令

### 后端 (`TmuxWeb/`)

```bash
npm start               # 启动生产服务
npm run dev             # 同 start
npm run backend         # 仅启动后端
```

### 前端 (`TmuxWeb/web/`)

```bash
npm run dev             # Vite 开发服务器 (端口 5215)
npm run build           # 生产构建 → web/dist
npm run preview         # 预览生产构建
npm run test            # 运行测试 (vitest)
```

### 组合命令

```bash
# 构建前端 + 启动后端
cd TmuxWeb
./start.sh

# PM2 生产部署
pm2 start ecosystem.config.js
pm2 logs tmuxweb-backend
```

## HTTPS 证书配置

**iPhone 访问必须使用 HTTPS**，否则 WebSocket 无法连接。

### 方式 A: mkcert（推荐）

```bash
# 安装 mkcert
brew install mkcert
mkcert -install

# 生成证书
cd TmuxWeb/server
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
```

**iPhone 安装 CA**:
1. 访问 `http://<your-ip>:8280`（服务自动启动此页面）
2. 下载并安装 CA 证书
3. 设置 → 通用 → 关于本机 → 证书信任设置 → 启用

### 方式 B: 自签名（浏览器警告）

```bash
cd TmuxWeb/server
openssl req -x509 -nodes -days 365 -newkey rsa:2048   -keyout key.pem -out cert.pem -subj "/CN=localhost"
```

## 配置文件

### config_private.json（必须配置）

```json
{
  "token": "your-secret-token",
  "llm": {
    "apiKey": "sk-xxx",
    "apiUrl": "https://api.deepseek.com/v1/chat/completions",
    "model": "deepseek-chat"
  },
  "xfyun": {
    "appId": "xxx",
    "apiKey": "xxx",
    "apiSecret": "xxx"
  },
  "allowedOrigins": [
    "https://localhost:5215",
    "https://192.168.1.100:5215"
  ]
}
```

### 关键配置项

| 字段 | 说明 |
|------|------|
| `port` | 后端端口（默认 8215） |
| `frontendPort` | Vite dev 端口（默认 5215） |
| `token` | API 认证 token |
| `allowedOrigins` | CORS 白名单（必须包含前端地址） |
| `llm.*` | AI 命令生成配置 |
| `xfyun.*` | 讯飞语音识别配置 |

## 代码风格

### 后端 (JavaScript/CommonJS)

- 缩进: 2 空格
- 引号: 单引号
- 分号: 使用
- 变量命名: camelCase
- 路由文件命名: kebab-case.js

```js
// 错误处理模式
router.post('/endpoint', async (req, res) => {
  try {
    const result = await pool.query(...)
    res.json({ data: result })
  } catch (err) {
    console.error('[route POST /endpoint]', err)
    res.status(500).json({ error: 'internal_error', message: err.message })
  }
})
```

### 前端 (TypeScript/React)

- 组件: 函数式组件
- 状态: hooks（无 Redux）
- 样式: CSS 文件（`src/styles/` + 组件级 CSS）
- 命名: 组件 PascalCase，文件 PascalCase.tsx

```tsx
// 导入顺序
import { useState } from 'react'           // 1. React/外部包
import { Menu } from 'lucide-react'
import { Terminal } from './Terminal'      // 2. 本地模块
```

## 调试

### 后端调试

```bash
# 查看实时日志
pm2 logs tmuxweb-backend

# PTY 状态调试
curl -H "Authorization: Bearer <token>" https://localhost:8215/api/debug/pty-status
```

### 前端调试

```bash
# Vite 开发模式（热更新）
cd web && npm run dev
```

### 语音调试

访问 `https://localhost:5215/voice-debug.html` 测试语音识别。

## 常见问题

### WebSocket 连接失败

1. 检查 HTTPS 证书是否正确
2. 检查 `allowedOrigins` 是否包含前端地址
3. iPhone 需要信任 CA 证书

### PTY 连接数超限

```bash
# 检查当前 PTY 状态
curl -H "Authorization: Bearer <token>" https://localhost:8215/api/debug/pty-status

# 最大 20 个并发 PTY，超出需等待清理
```

### Node.js 版本问题

```bash
# 使用 nvm 切换版本
nvm install 20
nvm use 20
```

## 相关文件

- `TmuxWeb/server/config.json` — 公共配置
- `TmuxWeb/server/config_private.json` — 私有配置（gitignored）
- `TmuxWeb/ecosystem.config.js` — PM2 配置
- `TmuxWeb/start.sh` — 快速启动脚本
- `DEPLOY.md` — 详细部署文档
