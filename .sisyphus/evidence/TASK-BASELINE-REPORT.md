# TmuxWeb Mobile Terminal - Baseline & Infrastructure Inventory

**Report Date:** 2026-02-09  
**Investigation Directory:** `/Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm`

---

## ✅ FINDINGS SUMMARY

### 1. **Start Script Location**

**Path:** `TmuxWeb/start.sh`  
**Status:** ✅ Found and verified  
**Type:** Bash executable script (1,452 bytes)

**Functionality:**
- Backend startup: `node server/index.js` on port 8215
- Frontend startup: `npm run build && npm run preview -- --host` on port 5215
- Includes dependency installation checks
- Graceful shutdown on SIGINT/SIGTERM

**Critical Line:**
```bash
cd web && npm run build && npm run preview -- --host &
```

---

### 2. **PM2 Ecosystem Configuration**

**Path:** `TmuxWeb/ecosystem.config.js`  
**Status:** ✅ Found and verified  
**Type:** CommonJS module

**Backend Configuration:**
```javascript
{
  name: 'tmuxweb-backend',
  script: 'server/index.js',
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  env: { NODE_ENV: 'production' }
}
```

**Frontend Configuration:**
```javascript
{
  name: 'tmuxweb-frontend',
  script: 'node_modules/.bin/vite',
  args: 'preview --port 5215 --host',
  cwd: __dirname + '/web',
  instances: 1,
  autorestart: true,
  watch: false,
  env: { NODE_ENV: 'production' }
}
```

---

### 3. **Current Frontend Runtime Mode**

**Status:** ✅ PREVIEW MODE (Production)

**Evidence:**
- PM2 process: `npx vite preview --port 5215 --host`
- Environment: `NODE_ENV: production`
- Serving from: `TmuxWeb/web/dist/` (pre-built assets)
- Hot reload: Disabled
- Development server: NOT running

**Not running in dev mode** - assets are pre-built and served statically.

---

### 4. **Test Infrastructure**

**Status:** ❌ ABSENT - No test framework configured

**Test Framework Status:**
- ❌ Jest - Not found
- ❌ Vitest - Not found  
- ❌ Playwright - Not found

**Package Dependencies:**
- No test runners in `package.json` files
- No test scripts in scripts section
- No test config files detected

**Available Scripts:**
```json
{
  "dev": "vite --port 5215",
  "build": "vite build",
  "preview": "vite preview"
}
```

---

### 5. **Frontend Tech Stack**

**Framework:** Vite 5.0.0 (bundler)  
**UI:** React 18.2.0  
**Terminal Emulator:** xterm 5.3.0  
**Language:** TypeScript 5.3.0  
**Drag & Drop:** @dnd-kit 6.3.1

---

### 6. **Current PM2 Process Status**

**Backend (ID: 0)**
- Name: `tmuxweb-backend`
- Status: Online
- Uptime: 83 minutes
- Restarts: 32
- Mode: cluster_mode
- Node: 18.20.8
- PID: 82183

**Frontend (ID: 4)**
- Name: `tmuxweb-frontend`
- Status: Online
- Uptime: 17 minutes
- Restarts: 12
- Mode: fork_mode
- Memory: 992.0 KB
- PID: 61673

---

## 📁 Project Structure

```
TmuxWeb/
├── start.sh                 (bootstrap script)
├── ecosystem.config.js      (PM2 configuration)
├── package.json            (root - backend)
├── package-lock.json
├── node_modules/           (backend dependencies)
├── server/
│   └── index.js           (Express backend)
└── web/                    (frontend)
    ├── package.json       (frontend dependencies)
    ├── node_modules/
    ├── dist/              (built assets - EXISTS)
    ├── src/               (source code)
    ├── index.html
    ├── favicon.svg
    ├── manifest.json
    └── assets/
```

---

## 🔍 Key Findings for Mobile Terminal Fixes

| Aspect | Status | Details |
|--------|--------|---------|
| **Startup Script** | ✅ Found | `TmuxWeb/start.sh` - builds and previews frontend |
| **PM2 Config** | ✅ Found | `TmuxWeb/ecosystem.config.js` - both services configured |
| **Frontend Mode** | ⚠️ Preview | Serving pre-built assets, not development mode |
| **Test Infra** | ❌ None | No test framework, no test config files |
| **Build System** | ✅ Vite | Modern bundler, production builds available |
| **Built Assets** | ✅ Exists | `TmuxWeb/web/dist/` directory with production assets |

---

## 📝 Evidence Files Created

✅ `.sisyphus/evidence/task-1-pm2-list.txt`  
✅ `.sisyphus/evidence/task-1-web-package-json-scripts.txt`  
✅ `.sisyphus/evidence/BASELINE-INVENTORY-SUMMARY.txt`  
✅ `.sisyphus/evidence/TASK-BASELINE-REPORT.md`

---

## 🎯 Recommendations for Mobile Terminal Fixes

1. **Start Process:** Use `TmuxWeb/start.sh` for reproducible startup
2. **PM2 Management:** Leverage ecosystem.config.js for orchestration
3. **Testing:** Consider adding Jest/Vitest for unit tests before making terminal fixes
4. **Frontend Changes:** Rebuild with `npm run build` in `web/` after modifications
5. **Deployment:** Serve from built `dist/` directory in production

---

**Report Status:** Complete ✅
