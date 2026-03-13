#!/bin/bash
# ============================================================================
# TmuxWeb — One-Click Setup Script
# ============================================================================
# PURPOSE: Clone, configure, and start TmuxWeb from scratch.
# TARGET:  AI agents (OpenCode, Cursor, etc.) and human developers.
# IDEMPOTENT: Safe to run multiple times. Skips completed steps.
#
# PREREQUISITES:
#   - macOS or Linux
#   - Node.js 18.x–20.x (v22+ may break node-pty)
#   - npm >= 8.x
#   - tmux >= 3.0
#   - MySQL 5.7+ (optional, for task tracking)
#
# USAGE:
#   chmod +x setup.sh && ./setup.sh
#
# WHAT THIS SCRIPT DOES (in order):
#   1. Verify prerequisites (node, npm, tmux)
#   2. Install backend dependencies (npm install)
#   3. Install frontend dependencies (npm install)
#   4. Create config_private.json if missing (with a random token)
#   5. Generate SSL certificates if missing (self-signed or mkcert)
#   6. Build frontend for production
#   7. Optionally set up MySQL database
#   8. Set up OpenCode plugin (if OpenCode is installed)
#   9. Start the server
#
# PORTS (configurable in server/config_private.json):
#   - Backend API:  8215 (HTTPS)
#   - Frontend:     5215 (via Vite dev or built-in static serve)
#   - CA download:  8280 (HTTP, for iOS cert install)
#
# AFTER RUNNING:
#   Open https://localhost:5215 in your browser.
#   Login with the token printed at the end.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMUXWEB_DIR="$SCRIPT_DIR/TmuxWeb"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; }
step()  { echo -e "\n${BLUE}${BOLD}=== $* ===${NC}"; }

# ── Step 1: Prerequisites ──────────────────────────────────────────────────

step "Step 1/9: Checking prerequisites"

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        err "$1 is required but not installed."
        echo "  Install: $2"
        return 1
    fi
}

FAIL=0
check_cmd node  "https://nodejs.org (use v20.x)" || FAIL=1
check_cmd npm   "comes with Node.js"             || FAIL=1
check_cmd tmux  "brew install tmux / apt install tmux" || FAIL=1

if [ $FAIL -eq 1 ]; then
    err "Missing prerequisites. Install them and re-run."
    exit 1
fi

# Check Node.js version
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -ge 22 ]; then
    warn "Node.js v${NODE_MAJOR} detected. v22+ may have node-pty issues. Recommend v20.x."
elif [ "$NODE_MAJOR" -lt 18 ]; then
    err "Node.js v${NODE_MAJOR} is too old. Minimum: v18.x"
    exit 1
else
    log "Node.js $(node -v) ✓"
fi

log "npm $(npm -v) ✓"
log "tmux $(tmux -V) ✓"

# ── Step 2: Backend dependencies ───────────────────────────────────────────

step "Step 2/9: Installing backend dependencies"

cd "$TMUXWEB_DIR"

if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
    log "Backend node_modules already exists, skipping."
else
    npm install
    log "Backend dependencies installed."
fi

# ── Step 3: Frontend dependencies ──────────────────────────────────────────

step "Step 3/9: Installing frontend dependencies"

cd "$TMUXWEB_DIR/web"

if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
    log "Frontend node_modules already exists, skipping."
else
    npm install
    log "Frontend dependencies installed."
fi

cd "$TMUXWEB_DIR"

# ── Step 4: Configuration ─────────────────────────────────────────────────

step "Step 4/9: Configuration"

CONFIG_PRIVATE="$TMUXWEB_DIR/server/config_private.json"

if [ -f "$CONFIG_PRIVATE" ]; then
    log "config_private.json already exists, skipping."
else
    # Generate a random token
    TOKEN=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -c 32)
    SESSION_SECRET=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -c 32)

    # Detect LAN IP
    LAN_IP=""
    if command -v ipconfig &>/dev/null; then
        # macOS
        LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "")
    fi
    if [ -z "$LAN_IP" ]; then
        LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
    fi

    ORIGINS='"https://localhost:5215", "https://127.0.0.1:5215"'
    if [ -n "$LAN_IP" ]; then
        ORIGINS="$ORIGINS, \"https://${LAN_IP}:5215\", \"https://${LAN_IP}:8215\""
    fi

    cat > "$CONFIG_PRIVATE" << CONF_EOF
{
  "token": "${TOKEN}",
  "sessionSecret": "${SESSION_SECRET}",
  "allowedOrigins": [${ORIGINS}]
}
CONF_EOF

    log "Created config_private.json"
    log "Auth token: ${BOLD}${TOKEN}${NC}"
    warn "Edit $CONFIG_PRIVATE to add LLM keys, database, voice, etc."
fi

# ── Step 5: SSL Certificates ──────────────────────────────────────────────

step "Step 5/9: SSL Certificates"

cd "$TMUXWEB_DIR"

if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
    log "SSL certificates already exist, skipping."
else
    if command -v mkcert &>/dev/null; then
        log "Using mkcert for trusted certificates..."
        CERT_DOMAINS="localhost 127.0.0.1"
        if [ -n "${LAN_IP:-}" ]; then
            CERT_DOMAINS="$CERT_DOMAINS $LAN_IP"
        fi
        mkcert -key-file key.pem -cert-file cert.pem $CERT_DOMAINS
        log "Trusted certificates generated with mkcert."
    else
        warn "mkcert not found, generating self-signed certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout key.pem -out cert.pem \
            -subj "/CN=localhost" 2>/dev/null
        log "Self-signed certificate generated."
        warn "For trusted certs: brew install mkcert && mkcert -install, then delete *.pem and re-run."
    fi
fi

# ── Step 6: Build frontend ────────────────────────────────────────────────

step "Step 6/9: Building frontend"

cd "$TMUXWEB_DIR/web"

if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    log "Frontend already built (dist/ exists). To rebuild: cd TmuxWeb/web && npm run build"
else
    npm run build
    log "Frontend built successfully."
fi

cd "$TMUXWEB_DIR"

# ── Step 7: Database (optional) ────────────────────────────────────────────

step "Step 7/9: Database (optional)"

if command -v mysql &>/dev/null; then
    log "MySQL client found. Database tables auto-create on first backend start."
    warn "To enable: add db config to server/config_private.json:"
    echo '  "db": { "host": "localhost", "port": 3306, "user": "root", "password": "xxx", "database": "tmuxweb" }'
else
    warn "MySQL not found. Task tracking will be disabled (server runs fine without it)."
    warn "Install later: brew install mysql / apt install mysql-server"
fi

# ── Step 8: OpenCode plugin (optional) ──────────────────────────────────────

step "Step 8/9: OpenCode plugin (optional)"

OPENCODE_PLUGINS_DIR="$HOME/.config/opencode/plugins"
PLUGIN_TEMPLATE="$TMUXWEB_DIR/plugins/my-rules.js.back"
PLUGIN_LOCAL="$TMUXWEB_DIR/plugins/my-rules.js"

if [ ! -f "$PLUGIN_TEMPLATE" ]; then
    warn "Plugin template not found at $PLUGIN_TEMPLATE, skipping."
elif [ ! -d "$HOME/.config/opencode" ]; then
    warn "OpenCode not installed (~/.config/opencode not found). Skipping plugin setup."
    warn "Install OpenCode first, then re-run this script to set up the plugin."
else
    # Create local copy if not exists
    if [ ! -f "$PLUGIN_LOCAL" ]; then
        cp "$PLUGIN_TEMPLATE" "$PLUGIN_LOCAL"
        log "Created local plugin: plugins/my-rules.js"
    else
        log "Local plugin already exists: plugins/my-rules.js"
    fi

    # Update PORT in plugin to match config
    CONFIGURED_PORT=$(python3 -c "import json; c=json.load(open('$CONFIG_PRIVATE')); print(c.get('port', 8215))" 2>/dev/null || echo "8215")
    if [ "$CONFIGURED_PORT" != "8215" ]; then
        sed -i.bak "s/const PORT = [0-9]*/const PORT = ${CONFIGURED_PORT}/" "$PLUGIN_LOCAL" && rm -f "$PLUGIN_LOCAL.bak"
        log "Updated plugin PORT to ${CONFIGURED_PORT}"
    fi

    # Create plugins dir and symlink
    mkdir -p "$OPENCODE_PLUGINS_DIR"
    PLUGIN_ABS="$(cd "$TMUXWEB_DIR/plugins" && pwd)/my-rules.js"

    if [ -L "$OPENCODE_PLUGINS_DIR/my-rules.js" ]; then
        EXISTING_TARGET=$(readlink "$OPENCODE_PLUGINS_DIR/my-rules.js" 2>/dev/null || echo "")
        if [ "$EXISTING_TARGET" = "$PLUGIN_ABS" ]; then
            log "Plugin symlink already correct."
        else
            warn "Existing symlink points to: $EXISTING_TARGET"
            warn "Expected: $PLUGIN_ABS"
            warn "Run manually: ln -sf \"$PLUGIN_ABS\" \"$OPENCODE_PLUGINS_DIR/my-rules.js\""
        fi
    elif [ -f "$OPENCODE_PLUGINS_DIR/my-rules.js" ]; then
        warn "A my-rules.js file already exists (not a symlink). Not overwriting."
        warn "To use TmuxWeb plugin: backup your file, then run:"
        warn "  ln -sf \"$PLUGIN_ABS\" \"$OPENCODE_PLUGINS_DIR/my-rules.js\""
    else
        ln -sf "$PLUGIN_ABS" "$OPENCODE_PLUGINS_DIR/my-rules.js"
        log "Plugin symlinked to OpenCode: $OPENCODE_PLUGINS_DIR/my-rules.js"
    fi

    echo ""
    log "OpenCode plugin provides:"
    echo "    • Task tracking — AI conversations auto-reported to TmuxWeb sidebar"
    echo "    • Custom rules  — edit MY_RULES in plugins/my-rules.js to inject rules"
    echo ""
    warn "Edit plugins/my-rules.js to add your own rules (e.g. memory, butler, custom skills)."
fi

# ── Step 9: Start server ───────────────────────────────────────────────────

step "Step 9/9: Starting TmuxWeb"

# Read config for display
DISPLAY_TOKEN=$(python3 -c "import json;print(json.load(open('$CONFIG_PRIVATE')).get('token','(not set)'))" 2>/dev/null || echo "(check config_private.json)")
DISPLAY_PORT=$(python3 -c "import json;print(json.load(open('$CONFIG_PRIVATE')).get('port', 8215))" 2>/dev/null || echo "8215")

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           TmuxWeb Setup Complete!                ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Auth Token:${NC}  ${YELLOW}${DISPLAY_TOKEN}${NC}"
echo -e "  ${BOLD}Backend:${NC}     https://localhost:${DISPLAY_PORT}"
echo -e "  ${BOLD}Config:${NC}      TmuxWeb/server/config_private.json"
echo -e "  ${BOLD}Docs:${NC}        README.md / README_CN.md"
echo ""

# Check if port is already in use
if lsof -i :"$DISPLAY_PORT" &>/dev/null; then
    warn "Port ${DISPLAY_PORT} is already in use!"
    echo "  To find the process: lsof -i :${DISPLAY_PORT}"
    echo "  To kill it:          kill \$(lsof -t -i :${DISPLAY_PORT})"
    echo ""
    echo -e "  ${BOLD}Start manually after freeing the port:${NC}"
    echo -e "    cd TmuxWeb && node server/index.js"
    echo ""
    exit 0
fi

echo -e "  Starting backend on port ${DISPLAY_PORT}..."
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop."
echo ""

cd "$TMUXWEB_DIR"
exec node server/index.js
