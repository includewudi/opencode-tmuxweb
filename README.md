# OpenCode iTerm 🖥️

[中文版](README_CN.md) | English

> A web-based terminal client for managing tmux sessions from your iPhone/iPad, powered by AI command generation.

## ✨ Features

### 📱 Terminal Access via Browser
- Access tmux sessions from any device (iPhone, iPad, desktop browser)
- Full xterm.js terminal with touch-friendly controls
- Auto-reconnect with page reload fallback (8 retries → auto refresh)
- HTTPS/WSS support with self-signed certificates

### 🤖 AI Command Generation
- **7 built-in roles**: CLI Expert, DevOps, Prompt Engineer, Frontend, Backend, UI/UX, API Architect
- **Custom roles**: Create/edit/delete your own AI roles via UI or API
- Per-role LLM model configuration (different models for different roles)
- One-tap send to terminal

### 🎤 Voice Input
- Speech-to-text via Xunfei (iFlytek) STT
- Hold-to-record with waveform visualization
- Supports Chinese and English

### 🔧 Toolbox
- Quick keys (Tab, Ctrl+C, Ctrl+Z, arrows, etc.)
- Command snippets (save/load/delete frequently used commands)
- Keyboard toggle for mobile

## 📐 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│  iPhone/iPad │◄───►│  Node.js     │◄───►│   tmux    │
│  (React SPA) │ WSS │  server.js   │ PTY │  sessions │
└─────────────┘     └──────────────┘     └───────────┘
                          │
                    ┌─────┴─────┐
                    │  LLM API  │
                    │ (DeepSeek │
                    │  /OpenAI) │
                    └───────────┘
```

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite, xterm.js, Lucide Icons |
| Backend | Node.js, WebSocket (ws), Python PTY helper |
| Terminal | tmux, Bash/Zsh |
| AI | DeepSeek / OpenAI compatible APIs |
| Voice | Xunfei WebSocket STT |

## 🚀 Quick Start

### Prerequisites
- macOS with tmux installed
- Node.js ≥ 18
- Python 3 (for PTY helper)

### Setup

```bash
# Clone & install
git clone https://github.com/includewudi/opencode-iterm.git
cd opencode-iterm/web

npm install
cd app && npm install && npx vite build && cd ..

# Configure LLM (optional, for AI features)
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

### SSL Certificate (Required for iPhone)

**Option A: mkcert (recommended, no browser warnings)**

```bash
brew install mkcert
mkcert -install
cd opencode-iterm/web
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 $(ipconfig getifaddr en0)
```

**Install CA on iPhone:**
1. Open `http://<your-ip>:8280` in iPhone Safari (server auto-starts this page)
2. Tap "Download CA Certificate"
3. Settings → Downloaded Profile → Install
4. Settings → General → About → Certificate Trust Settings → Enable

**Option B: Self-signed (browser will show warning)**

```bash
cd opencode-iterm/web
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem -subj "/CN=localhost"
```

> Without cert files, server runs in HTTP mode (no WSS, limited iPhone support).

### Start Server

```bash
cd opencode-iterm/web
node server.js
# Or use pm2 for production:
# pm2 start ecosystem.config.js
```

Open `https://<your-ip>:8215` on your iPhone.

## 📡 API Reference

### Tmux Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List tmux sessions |
| GET | `/api/panes?session=<name>` | List panes in a session |

### AI Command Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/command` | Generate AI command `{prompt, role}` |

### Custom Roles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/roles` | List all roles (built-in + custom) |
| POST | `/api/roles` | Create custom role |
| PUT | `/api/roles/:id` | Edit custom role |
| DELETE | `/api/roles/:id` | Delete custom role |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `/ws?target=session:window.pane` | Terminal PTY connection |
| `/ws/speech` | Xunfei STT proxy |

## ⚙️ Configuration

### `config_private.json` (gitignored)

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

## 📜 License

MIT
