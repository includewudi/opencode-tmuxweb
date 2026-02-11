# VoiceTmux & Mobile Terminal Suite

## Project Overview

This monorepo contains a suite of applications designed to provide remote terminal access, specifically optimized for **tmux** management and **voice input** on mobile devices. It includes a React Native mobile app, a native iOS app, and web-based terminal interfaces.

## Directory Structure

*   **`TmuxMobile/`**: A React Native (Expo) application for mobile terminal access.
*   **`VoiceTmuxApp/`**: A native iOS application (SwiftUI) featuring SSH connectivity, tmux tree visualization, and Xunfei speech-to-text integration.
*   **`VoiceTmuxCore/`**: A Swift Package containing shared core logic (SSH transport, tmux parsing, STT) for the iOS app.
*   **`TmuxWeb/`**: A full-stack web application with a Node.js backend (Express, node-pty) and a web frontend, supporting persistent sessions.
*   **`web/`**: `iterm-preview`. A lightweight, standalone web server for terminal previewing using `node-pty` and WebSockets.
*   **`.sisyphus/`**: Project management folder containing task tracking, evidence screenshots, and drafts.
*   **`docs/`**: Documentation and plans.

## Key Technologies

### Mobile (Cross-Platform)
*   **Framework:** React Native (Expo SDK 54)
*   **Styling:** NativeWind (Tailwind CSS)
*   **SSH:** `@dylankenneally/react-native-ssh-sftp`
*   **Language:** TypeScript

### iOS Native
*   **Language:** Swift 5.9
*   **UI Framework:** SwiftUI
*   **Minimum OS:** iOS 17.0 (Interactive Terminal requires iOS 18.0+)
*   **SSH Library:** Citadel
*   **Voice:** Xunfei (iFlyTek) Streaming Speech-to-Text

### Web & Backend
*   **Runtime:** Node.js
*   **Server:** Express.js, WebSocket (`ws`)
*   **Terminal Emulation:** `node-pty` (backend), `xterm.js` (frontend - assumed)
*   **Database:** MySQL (`mysql2`) - utilized in `TmuxWeb`
*   **Process Management:** PM2 (`ecosystem.config.js`)

## Building and Running

### TmuxMobile (React Native)
```bash
cd TmuxMobile
npm install
npm start       # Start Expo development server
npm run android # Run on Android emulator/device
npm run ios     # Run on iOS simulator/device
```

### VoiceTmuxApp (iOS Native)
1.  Open `VoiceTmuxApp/VoiceTmuxApp.xcodeproj` in Xcode.
2.  Ensure `VoiceTmuxCore` package dependencies are resolved.
3.  Select target simulator (iOS 17+) or device.
4.  Build and Run (`Cmd + R`).

### TmuxWeb (Full Stack)
```bash
cd TmuxWeb
npm run install:all # Install dependencies for server and web client
npm start           # Start the server (node server/index.js)
# Or for development:
npm run dev         # Start server in dev mode
npm run frontend    # Start frontend dev server
```

### iterm-preview (Simple Web)
```bash
cd web
npm install
npm start
```

## Development Conventions

*   **Monorepo:** Each top-level directory acts as an independent module with its own configuration.
*   **Task Tracking:** Check `.sisyphus/` for current active tasks and "boulders" (milestones).
*   **Documentation:** Refer to `ios-spec.md` (root) or `docs/` for specific implementation details, especially for the iOS architecture.
*   **Deployment:** `ecosystem.config.js` files indicate PM2 is used for production deployment of web services.

## Critical Context (iOS)

*   **Authentication:** Supports Password and RSA Private Key (Keychain stored).
*   **Tmux Integration:** relies on `/opt/homebrew/bin/tmux` existing on the host.
*   **STT:** Uses Xunfei WebSocket API for dictation. Requires App ID/Key/Secret.
