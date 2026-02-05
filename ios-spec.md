# iOS Voice Terminal App Specification

**Document Status**: Reverse-engineered from current codebase  
**Platform**: iOS 17+, Swift 5.9, SwiftUI  
**Last Updated**: 2025-02-05

---

## 1. Overview

### 1.1 Product Goals

The iOS Voice Terminal App provides remote terminal access to tmux sessions running on SSH servers, enhanced with speech-to-text input capabilities. The app enables users to:

1. **Connect to SSH servers** with password or private key authentication
2. **Browse and manage tmux sessions/windows/panes** in a hierarchical tree view
3. **Interact with terminal panes** via interactive PTY terminal (iOS 18+) or capture-based fallback
4. **Dictate commands** using Xunfei streaming speech recognition

### 1.2 Target Users

- Developers and sysadmins managing remote servers via tmux
- Users requiring hands-free terminal input via voice

### 1.3 Platform Requirements

| Requirement | Minimum |
|-------------|---------|
| iOS | 17.0 |
| macOS (for dev) | 14.0 |
| Swift | 5.9 |
| Interactive Terminal | iOS 18.0+ |

---

## 2. Scope & Non-Goals

### 2.1 In Scope

| Feature | Description |
|---------|-------------|
| SSH Connection | Single-server connection with password or RSA private key auth |
| Credential Persistence | Secure Keychain storage with optional auto-connect |
| tmux Tree Sync | List sessions, windows, panes; build hierarchical tree |
| tmux CRUD | Create/delete/rename sessions and windows; split/delete panes |
| Capture View | Non-interactive pane output display with send-keys commands |
| Interactive Terminal | Full PTY terminal (iOS 18+ only) with xterm-256color emulation |
| Xunfei STT | Streaming speech-to-text for command dictation |

### 2.2 Non-Goals

The following are explicitly **out of scope**:

- **TTS (Text-to-Speech)**: No voice output
- **LLM/AI Integration**: No AI chat, command suggestions, or intent parsing
- **Voice Commands**: STT produces text only; no command execution logic
- **Multi-Connection**: Single SSH connection at a time only
- **SCP/SFTP/Port Forwarding**: File transfer and tunneling not supported
- **Local Terminal**: SSH-only, no local shell
- **Cross-Platform**: iOS only (no macOS Catalyst, iPadOS-specific features)

---

## 3. Architecture

### 3.1 Module Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  VoiceTmuxApp (SwiftUI Application)                             │
│  - Views: ContentView, ConnectionSettingsView, SSHTerminalView  │
│  - ViewModels: TreeViewModel, XunfeiSpeechService               │
│  - Services: KeychainService                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ imports
┌─────────────────────────▼───────────────────────────────────────┐
│  VoiceTmuxCore (Swift Package)                                  │
│  - SSH: SSHTransport, SSHTerminalSession, SSHCredentials        │
│  - tmux: TmuxSyncService, TmuxCommandBuilder, TmuxListParser    │
│  - Data: TmuxTree, TmuxSession, TmuxWindow, TmuxPane            │
│  - STT: XunfeiAuth, XunfeiFrames                                │
│  - Protocol: ShellTransport                                     │
└─────────────────────────────────────────────────────────────────┘
                          │ dependencies
┌─────────────────────────▼───────────────────────────────────────┐
│  External Dependencies                                          │
│  - Citadel (SSH client)                                         │
│  - XTerminalUI (xterm.js WebView wrapper)                       │
│  - CryptoKit, NIO/NIOSSH                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Models

#### SSH Credentials

```swift
public enum SSHAuthMethod: Sendable {
    case password(String)
    case privateKey(key: String, passphrase: String?)
}

public struct SSHCredentials: Sendable {
    let host: String
    let port: Int
    let username: String
    let authMethod: SSHAuthMethod
}
```

#### tmux Tree Structure

```swift
struct TmuxSession { id: String, name: String }
struct TmuxWindow { id: String, name: String, sessionId: String }
struct TmuxPane { id: String, windowId: String }

struct TmuxTree {
    struct SessionNode { id, name, windows: [WindowNode] }
    struct WindowNode { id, name, panes: [PaneNode] }
    struct PaneNode { id }
    sessions: [SessionNode]
}
```

#### Keychain Keys

| Key | Purpose |
|-----|---------|
| `host` | SSH server hostname |
| `port` | SSH port (default: 22) |
| `username` | SSH username |
| `password` | SSH password (if not using private key) |
| `privateKey` | RSA private key PEM content |
| `usePrivateKey` | Boolean flag for auth method |
| `xunfeiAppId` | Xunfei STT App ID |
| `xunfeiApiKey` | Xunfei STT API Key |
| `xunfeiApiSecret` | Xunfei STT API Secret |

---

## 4. SSH Connection

### 4.1 Connection Flow

```
┌─────────────┐    ┌──────────────────┐    ┌────────────────┐
│ First Launch│───▶│ Check Keychain   │───▶│ Has Saved?     │
└─────────────┘    └──────────────────┘    └────────┬───────┘
                                                    │
                   ┌────────────────────────────────┼────────┐
                   ▼                                ▼        │
          ┌───────────────┐              ┌─────────────────┐ │
          │ Show Connect  │              │ Auto-Connect    │ │
          │ Sheet         │              │ (silent)        │ │
          └───────┬───────┘              └────────┬────────┘ │
                  │                               │          │
                  ▼                               ▼          │
          ┌───────────────────────────────────────────────┐  │
          │ SSHTransport.connect() via Citadel            │◀─┘
          └───────────────────────────────────────────────┘
```

### 4.2 Auto-Connect Behavior

On app launch, `ContentView.autoConnectIfNeeded()`:

1. Check if auto-connect already attempted this session
2. Load credentials from `KeychainService.loadCredentials()`
3. Validate: host non-empty, username non-empty, port valid integer
4. Validate auth: password non-empty OR privateKey non-empty based on `usePrivateKey`
5. If all valid: call `viewModel.connect(credentials:)` silently
6. If connection fails: show connection sheet with error

### 4.3 Credential Persistence

**Save behavior** (on Connect button tap):
- If "Save credentials" toggle enabled: `KeychainService.saveCredentials(...)` 
- If disabled: `KeychainService.deleteAll()` clears stored credentials

**Storage**: iOS Keychain via Security framework with service identifier `com.voiceai.VoiceTmuxApp`

### 4.4 Authentication Methods

| Method | Implementation |
|--------|----------------|
| Password | `Citadel.SSHAuthenticationMethod.passwordBased(username:password:)` |
| Private Key | Parse RSA key via `Insecure.RSA.PrivateKey(sshRsa:)`, use `.rsa(username:privateKey:)` |

**Note**: Only RSA keys supported. Passphrase for private keys accepted but not currently used in auth flow.

### 4.5 Host Key Validation

Currently uses `.acceptAnything()` - accepts all host keys without verification.

---

## 5. tmux Tree Sync & Operations

### 5.1 Tree Synchronization

`TmuxSyncService.sync()` executes three commands in sequence:

```bash
/opt/homebrew/bin/tmux list-sessions -F '#{session_name}: #{session_windows} windows'
/opt/homebrew/bin/tmux list-windows -a -F '#{session_name}:#{window_index}: #{window_name} (session #{session_name})'
/opt/homebrew/bin/tmux list-panes -a -F '#{pane_id} (window #{session_name}:#{window_index})'
```

Output is parsed by `TmuxListParser` and assembled into `TmuxTree.build(sessions:windows:panes:)`.

### 5.2 CRUD Operations

All operations use `TmuxCommandBuilder` for command generation and `SSHTransport.run()` for execution.

#### Sessions

| Operation | Command |
|-----------|---------|
| Create | `tmux new-session -d -s '<name>'` |
| Delete | `tmux kill-session -t '<name>'` |
| Rename | `tmux rename-session -t '<old>' '<new>'` |
| Switch | `tmux switch-client -t <target>` |

#### Windows

| Operation | Command |
|-----------|---------|
| Create | `tmux new-window -t <session> [-n <name>]` |
| Delete | `tmux kill-window -t <target>` |
| Rename | `tmux rename-window -t <target> <name>` |
| Select | `tmux select-window -t <target>` |

#### Panes

| Operation | Command |
|-----------|---------|
| Split Horizontal | `tmux split-window -h -t <target>` |
| Split Vertical | `tmux split-window -v -t <target>` |
| Delete | `tmux kill-pane -t <target>` |
| Select | `tmux select-pane -t <target>` |
| Capture | `tmux capture-pane -t <target> -p` |

### 5.3 Send Keys

For capture-view command input, `TreeViewModel` provides:

```swift
sendKeys(_ keys: String)    // tmux send-keys -t <pane> "<escaped>"
sendEnter()                 // tmux send-keys -t <pane> Enter
sendTab()                   // tmux send-keys -t <pane> Tab
sendUp()                    // tmux send-keys -t <pane> Up
sendDown()                  // tmux send-keys -t <pane> Down
sendCtrlC()                 // tmux send-keys -t <pane> C-c
```

Key escaping handles: `\`, `"`, `$`, `` ` ``

---

## 6. Terminal Views

### 6.1 View Selection Logic

```swift
if #available(iOS 18.0, *) {
    InteractiveTerminalWrapper(...)  // → XTermTerminalContainer
} else {
    captureViewFor(paneId:)          // Fallback capture view
}
```

### 6.2 Interactive PTY Terminal (iOS 18+)

**Components**:
- `XTermTerminalContainer`: SwiftUI wrapper with toolbar, theme, voice controls
- `XTermSSHView`: UIViewRepresentable bridging to `XTerminalView` (xterm.js WebView)
- `SSHTerminalSession`: Citadel-based PTY session actor

**Connection Flow**:

1. Create `SSHTerminalSession(credentials:)`
2. Connect with PTY request: `xterm-256color`, initial 80x24
3. Optional tmux attach: `exec /opt/homebrew/bin/tmux -u attach-session -t <session>`
4. Bidirectional streaming:
   - Terminal input → `session.write(data:)`
   - SSH output → `terminalView.write(string)`
5. Terminal resize → `session.resize(cols:rows:)`

**Features**:
- Color themes: Dracula (default), Tokyo Night, GitHub Dark, Pure Black
- Font size adjustment (6-24pt)
- CJK font support: Menlo, PingFang SC, Heiti SC
- IME composition view styling
- Toolbar: Esc, Tab, Enter, Ctrl+C, Up, Down, Mic, Settings

### 6.3 Capture View (Fallback)

Non-interactive view displaying `tmux capture-pane` output:

**UI Elements**:
- Monospaced text display with selection enabled
- Refresh button → `viewModel.refreshPaneContent()`
- Command input field with send button
- Special key buttons: Up, Down, Tab, Ctrl+C

**Interaction Pattern**:
1. Type command in text field
2. Tap send or press Return
3. Command sent via `sendKeys()` + `sendEnter()`
4. Wait 300ms, then `refreshPaneContent()` to show updated output

---

## 7. Speech-to-Text (Xunfei)

### 7.1 Configuration

Xunfei credentials stored in Keychain via `XunfeiSettingsView`:
- App ID
- API Key  
- API Secret

`XunfeiSpeechService.isConfigured` checks if all three are present.

### 7.2 Recording Flow

```
┌──────────────┐   ┌───────────────────┐   ┌─────────────────┐
│ Tap Mic      │──▶│ Configure Audio   │──▶│ Connect WS      │
│ Button       │   │ Session           │   │ to Xunfei       │
└──────────────┘   └───────────────────┘   └────────┬────────┘
                                                    │
                   ┌────────────────────────────────▼────────┐
                   │ AVAudioEngine: capture 16kHz PCM16      │
                   │ Convert buffer → base64 audio frames    │
                   │ Send via WebSocket                      │
                   └────────────────────────────────────────┬┘
                                                            │
                   ┌────────────────────────────────────────▼┐
                   │ Receive partial recognition results     │
                   │ Update recognizedText with pgs/rg logic │
                   └─────────────────────────────────────────┘
```

### 7.3 WebSocket Protocol

**Endpoint**: `wss://iat-api.xfyun.cn/v2/iat`

**Authentication**: HMAC-SHA256 signature via `XunfeiAuth.buildAuthURL(date:)`

**Frame Types** (`XunfeiFrames`):

| Frame | status | Contents |
|-------|--------|----------|
| First | 0 | common (app_id), business (language, domain, accent, vadEos, dwa), data (audio) |
| Continuation | 1 | data (audio) only |
| End | 2 | data (empty audio) to signal end |

**Business Parameters**:
- `language`: "zh_cn"
- `domain`: "iat" (speech recognition)
- `accent`: "mandarin"
- `vadEos`: 2000ms (voice activity detection end-of-speech)
- `dwa`: "wpgs" (dynamic correction)

### 7.4 Recognition Response

Response format:
```json
{
  "code": 0,
  "data": {
    "result": {
      "ws": [{"cw": [{"w": "text"}]}],
      "pgs": "apd|rpl",
      "rg": [start, end]
    }
  }
}
```

- `pgs = "apd"`: Append text to `recognizedText`
- `pgs = "rpl"`: Replace substring from `rg[0]` to `rg[1]`

### 7.5 Text Injection

When recording stops and `recognizedText` is non-empty:
```swift
sessionHolder.sendKeys(recognizedText)
```

Text is sent directly to the PTY terminal as keystrokes.

---

## 8. Error Handling

### 8.1 SSH Errors

| Error Type | Handling |
|------------|----------|
| `SSHTransportError.notConnected` | Display "Not connected to SSH server" |
| `SSHTransportError.connectionFailed(msg)` | Display "Connection failed: {msg}" |
| `SSHTransportError.commandFailed(code, stderr)` | Display stderr or exit code |

### 8.2 tmux Errors

tmux commands may fail if:
- tmux not installed at `/opt/homebrew/bin/tmux`
- No tmux server running
- Target session/window/pane doesn't exist

Errors propagate via `viewModel.error` and display in UI.

### 8.3 STT Errors

| Scenario | Error Message |
|----------|---------------|
| Not configured | "请先配置讯飞语音 API" |
| Audio session fail | "无法配置音频会话: {error}" |
| WebSocket URL fail | "无法创建 WebSocket URL" |
| Audio engine fail | "无法启动音频引擎: {error}" |
| Recognition error | "识别错误: {code} {message}" |

---

## 9. Edge Cases

### 9.1 SSH Connection

| Scenario | Behavior |
|----------|----------|
| Empty host | Connect button disabled |
| Invalid port | Connect fails silently (port parsing returns nil) |
| Wrong password | Citadel throws auth error, displayed in sheet |
| Invalid private key | RSA parsing throws, displayed as connection error |
| Network timeout | Citadel timeout, connection fails |
| Server unreachable | DNS/network error displayed |

### 9.2 tmux Operations

| Scenario | Behavior |
|----------|----------|
| tmux not running | Command fails, error shown |
| tmux not at /opt/homebrew/bin/tmux | Commands fail with exit code |
| Session name with quotes | Escaped via `'\\''` pattern |
| Pane deleted externally | Next refresh removes from tree |
| Concurrent edits | Last writer wins, tree refreshes |

### 9.3 Terminal

| Scenario | Behavior |
|----------|----------|
| iOS < 18 | Shows "iOS 18 Required" placeholder |
| PTY disconnect | `isConnected` → false, reconnect on next pane select |
| Resize during disconnect | Resize silently ignored |
| Large output | xterm.js scrollback buffer (default limits) |

### 9.4 STT

| Scenario | Behavior |
|----------|----------|
| Microphone denied | Audio session setup fails |
| WebSocket disconnect mid-recording | Recording continues locally, no transcription |
| Very long dictation | Xunfei session timeout (server-side ~60s) |
| Background app | Audio session may be interrupted |

---

## 10. Verification Checklist

### 10.0 Automated Verification (Bash Commands)

```bash
# File exists
test -f docs/spec/ios-spec.md

# Key sections present
grep -q "## 1. Overview" docs/spec/ios-spec.md
grep -q "## 2. Scope & Non-Goals" docs/spec/ios-spec.md
grep -q "## 3. Architecture" docs/spec/ios-spec.md
grep -q "## 4. SSH Connection" docs/spec/ios-spec.md
grep -q "## 5. tmux Tree Sync" docs/spec/ios-spec.md
grep -q "## 6. Terminal Views" docs/spec/ios-spec.md
grep -q "## 7. Speech-to-Text" docs/spec/ios-spec.md
grep -q "## 8. Error Handling" docs/spec/ios-spec.md
grep -q "## 9. Edge Cases" docs/spec/ios-spec.md
grep -q "## 10. Verification Checklist" docs/spec/ios-spec.md

# Key content present
grep -q "Xunfei" docs/spec/ios-spec.md
grep -q "Non-Goals" docs/spec/ios-spec.md
grep -q "SSHCredentials" docs/spec/ios-spec.md
grep -q "TmuxTree" docs/spec/ios-spec.md
grep -q "PTY" docs/spec/ios-spec.md
grep -q "Keychain" docs/spec/ios-spec.md

# iOS build/test smoke (optional)
# cd ios/VoiceTmuxCore && swift test
# cd ios/VoiceTmuxApp && xcodebuild test -scheme VoiceTmuxApp -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max'
```

### 10.1 SSH & Auto-Connect

- [ ] First launch with no saved credentials → shows connect sheet
- [ ] Save credentials → appear on next launch
- [ ] Auto-connect succeeds with valid saved credentials
- [ ] Auto-connect fails gracefully with invalid credentials
- [ ] Password auth works
- [ ] Private key (RSA) auth works
- [ ] Disconnect clears session state

### 10.2 tmux Tree

- [ ] Tree shows sessions, windows, panes hierarchy
- [ ] Pull-to-refresh updates tree
- [ ] Create session appears in tree
- [ ] Delete session removes from tree
- [ ] Rename session updates name
- [ ] Create window in session works
- [ ] Split pane (horizontal/vertical) works
- [ ] Delete pane removes from tree

### 10.3 Capture View

- [ ] Pane content displays on select
- [ ] Refresh button updates content
- [ ] Send command + Enter executes
- [ ] Tab, Up, Down, Ctrl+C send correct keys
- [ ] Content refreshes after command

### 10.4 Interactive Terminal (iOS 18+)

- [ ] Terminal connects and displays prompt
- [ ] Keyboard input appears in terminal
- [ ] Terminal toolbar keys work (Esc, Tab, Enter, Ctrl+C, arrows)
- [ ] Font size +/- adjusts terminal
- [ ] Theme changes apply
- [ ] Resize on rotation works
- [ ] Disconnect on view dismiss

### 10.5 Speech-to-Text

- [ ] Settings saves Xunfei credentials to Keychain
- [ ] Mic button starts recording (red highlight)
- [ ] Partial recognition displays in bar
- [ ] Stop recording injects text to terminal
- [ ] Clear credentials works
- [ ] Missing credentials shows settings prompt

### 10.6 Error States

- [ ] Connection error displays in sheet
- [ ] tmux command error displays in view
- [ ] STT error displays in voice bar
- [ ] Network loss handled gracefully
