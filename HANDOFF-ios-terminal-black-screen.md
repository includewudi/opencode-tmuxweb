# VoiceTmuxApp iOS 终端黑屏问题 — 详细交接文档

## 一、问题一句话描述

> **iOS 端通过 SSH 成功轮询获取 `tmux capture-pane` 输出（数据量可达万字符级别，SwiftUI 层也收到了回调），但 WKWebView 中的 xterm.js 终端始终显示黑屏，看不到任何文字。**

---

## 二、项目背景

### 2.1 为什么用 capture-pane 轮询而不是真正的交互式终端？

iOS 无法使用 Citadel 的 `withPTY`/`withTTY` API（这些是 macOS 15+ 专属），而 `tmux attach-session` 需要真正的 PTY。因此 iOS 端采用了**非交互式方案**：

| 功能 | 实现方式 |
|------|----------|
| 获取屏幕内容 | 周期性执行 `tmux capture-pane -p -t <session> -e` |
| 发送输入 | `tmux send-keys -t <session> ...` |
| 调整大小 | `tmux resize-pane -t <session> -x <cols> -y <rows>` |

### 2.2 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     InteractiveTerminalView                      │
│  ┌─────────────────┐    ┌──────────────────────────────────┐    │
│  │  Debug Overlay  │    │         XTermSSHView             │    │
│  │  (左上角日志)    │    │  ┌────────────────────────────┐  │    │
│  └─────────────────┘    │  │     WebViewWrapper         │  │    │
│                         │  │  ┌──────────────────────┐  │  │    │
│                         │  │  │   WKWebView          │  │  │    │
│                         │  │  │   ┌──────────────┐   │  │  │    │
│                         │  │  │   │  xterm.js    │   │  │  │    │
│                         │  │  │   │  (黑屏区域)   │   │  │  │    │
│                         │  │  │   └──────────────┘   │  │  │    │
│                         │  │  └──────────────────────┘  │  │    │
│                         │  └────────────────────────────┘  │    │
│                         └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TerminalOutputBuffer                        │
│                  @Published pendingOutput: String?               │
└─────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ outputHandler?(data)
┌─────────────────────────────────────────────────────────────────┐
│                         SSHTransport (actor)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  pollingTask: 每 200-500ms 执行一次                        │   │
│  │    1. tmux capture-pane -p -t <session> -e               │   │
│  │    2. 与 lastCapturedContent 比较                         │   │
│  │    3. 若有变化 → handleFullScreenUpdate(content)          │   │
│  │       → outputHandler?("\x1B[2J\x1B[H" + content)        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、数据流详解（从 SSH 到屏幕）

### 3.1 数据获取阶段 ✅ 已确认正常

```swift
// SSHTransport.swift (iOS path, line 133-163)
pollingTask = Task {
    while !Task.isCancelled {
        let content = try await self.capturePane(session: session, tmuxPath: tmuxPath)
        // ↑ 执行 "tmux capture-pane -p -t <session> -e"
        
        if content != lastContent {
            await self.handleFullScreenUpdate(content)  // 触发输出
            // ...
        }
    }
}
```

**证据**：Debug Overlay 显示：
- `First capture length: XXX`
- `Capture changed: 17538 chars`
- `Output received`

### 3.2 数据传递阶段 ✅ 已确认正常

```swift
// SSHTransport.swift line 178-181
private func handleFullScreenUpdate(_ content: String) {
    let clearScreen = "\u{1B}[2J\u{1B}[H"  // ANSI 清屏 + 光标归位
    outputHandler?(clearScreen + content)   // 调用注册的 handler
}

// InteractiveTerminalView.swift line 89-94
await transport.registerOutputHandler { [weak terminalOutput] data in
    terminalOutput?.append(data)  // 写入 TerminalOutputBuffer
    // ...
}
```

**证据**：Debug Overlay 显示 `Output received`，说明 `terminalOutput.append()` 被调用了。

### 3.3 数据渲染阶段 ❌ 这里出问题

```swift
// XTermSSHView.swift line 41-46
.onChange(of: outputBuffer.pendingOutput) { _, newValue in
    if let data = newValue {
        writeToTerminal(data)        // ← 调用写入函数
        outputBuffer.pendingOutput = nil
    }
}

// XTermSSHView.swift line 49-56
private func writeToTerminal(_ data: String) {
    let escaped = data.replacingOccurrences(of: "\\", with: "\\\\")
                      .replacingOccurrences(of: "'", with: "\\'")
                      .replacingOccurrences(of: "\n", with: "\\n")
                      .replacingOccurrences(of: "\r", with: "\\r")
    
    self.webViewScript = "write('\(escaped)')"  // ← 设置要执行的 JS
}

// WebViewWrapper.swift line 36-47
func updateUIView(_ uiView: WKWebView, context: Context) {
    if let script = script {
        uiView.evaluateJavaScript(script) { _, error in
            if let error = error {
                print("[Terminal] evaluateJavaScript error: \(error)")  // ← 只 print，没有上报到 overlay！
            }
            // ...
        }
    }
}
```

**问题**：`evaluateJavaScript` 的错误只是 `print` 到 Xcode console，**没有传到 in-app overlay**，所以用户看不到是否有 JS 执行错误。

### 3.4 JS 侧渲染

```javascript
// TerminalScript.swift 内嵌的 HTML/JS (line 76-79)
window.write = function(data) {
    statusEl.textContent = 'write len: ' + data.length + ' cols=' + term.cols + ' rows=' + term.rows;
    term.write(data);  // ← 调用 xterm 的 write
};
```

**疑点**：
1. `statusEl` 是否可见？（它是一个小白字标签在左上角）
2. `term.cols` / `term.rows` 是否为 0？（如果是 0，xterm 可能不会渲染）
3. 写入的数据量太大（1~2 万字符），xterm 可能卡死或渲染异常

---

## 四、已排查/已修复的问题

| 问题 | 状态 | 描述 |
|------|------|------|
| tmux 命令找不到 (exitcode 127) | ✅ 已修复 | 添加 `resolveTmuxPath()` 自动探测 tmux 路径 |
| JS 初始化失败无反馈 | ✅ 部分修复 | 添加了 `ready` 和 `jsError` 消息类型，但 `evaluateJavaScript` 错误未上报 |
| xterm 尺寸问题 | ⚠️ 尝试修复 | 添加了 `fitAddon.fit()` 和 `proposeDimensions()`，但未确认是否生效 |
| SSH 连接断开 (creatingChannelAfterClosure) | ⚠️ 临时处理 | 只做了 reset 状态，没有自动重连 |

---

## 五、当前代码关键位置速查

### 5.1 SSHTransport (数据获取)
**文件**: `VoiceTmuxCore/Sources/VoiceTmuxCore/Services/SSHTransport.swift`

| 行号 | 功能 |
|------|------|
| 79-165 | `startShell(sessionName:)` - iOS 轮询逻辑入口 |
| 133-163 | polling loop - 核心轮询循环 |
| 168-176 | `capturePane()` - 执行 tmux capture-pane |
| 178-181 | `handleFullScreenUpdate()` - 输出到 handler |
| 198-208 | `resolveTmuxPath()` - 自动探测 tmux 路径 |

### 5.2 XTermSSHView (SwiftUI → JS 桥接)
**文件**: `VoiceTmuxApp/Sources/XTerminalUI/XTermSSHView.swift`

| 行号 | 功能 |
|------|------|
| 41-46 | `onChange(of: pendingOutput)` - 监听输出变化 |
| 49-56 | `writeToTerminal()` - 转义并生成 JS 调用 |

### 5.3 WebViewWrapper (JS 执行)
**文件**: `VoiceTmuxApp/Sources/XTerminalUI/WebViewWrapper.swift`

| 行号 | 功能 |
|------|------|
| 36-47 | `updateUIView()` - 执行 `evaluateJavaScript` |
| 38-41 | **问题点**：错误只 print 不上报 |

### 5.4 TerminalScript (xterm.js 初始化)
**文件**: `VoiceTmuxApp/Sources/XTerminalUI/TerminalScript.swift`

| 行号 | 功能 |
|------|------|
| 32-48 | xterm 初始化、fitAddon、初始 resize |
| 50-61 | statusEl 调试标签（左上角白字） |
| 76-79 | `window.write()` 函数 - 核心写入 |
| 96-100 | ResizeObserver + 延迟 resize |

### 5.5 InteractiveTerminalView (入口视图)
**文件**: `VoiceTmuxApp/Sources/Views/InteractiveTerminalView.swift`

| 行号 | 功能 |
|------|------|
| 67-83 | debugOverlay - 左上角调试日志 |
| 85-112 | `startShellIfNeeded()` - 启动 SSH shell |
| 127-135 | `handleTerminalReady/Error` - JS 回调处理 |

---

## 六、最可能的根因假设（按概率排序）

### 假设 1：`evaluateJavaScript` 执行失败但错误被吞掉（概率 40%）

**现象**：JS 代码有语法错误或执行异常，但错误只 print 到 Xcode console，用户在设备上看不到。

**验证方法**：
```swift
// WebViewWrapper.swift 修改
uiView.evaluateJavaScript(script) { result, error in
    if let error = error {
        // 必须把错误传到 overlay！
        bridge.onJSError?("evalJS: \(error.localizedDescription)")
    }
}
```

**检查点**：
- `writeToTerminal()` 的转义逻辑是否正确？特别是处理 ANSI 转义序列时
- 17538 字符的字符串拼接成 `write('...')` 后，JS 是否能正确解析？

### 假设 2：xterm 画布尺寸为 0（概率 30%）

**现象**：xterm 初始化时 `term.cols` / `term.rows` 为 0，或容器 `#terminal` 的 `clientWidth`/`clientHeight` 为 0，导致"写了但看不见"。

**验证方法**：
在 JS 中添加更详细的尺寸日志：
```javascript
window.write = function(data) {
    const container = document.getElementById('terminal');
    statusEl.textContent = 'write len:' + data.length + 
        ' cols=' + term.cols + ' rows=' + term.rows +
        ' w=' + container.clientWidth + ' h=' + container.clientHeight;
    term.write(data);
};
```

**检查点**：
- WebView 的 frame 是否正确设置？
- SwiftUI 布局是否给了 WebViewWrapper 足够空间？
- iOS Safe Area 是否影响布局？

### 假设 3：数据量太大导致 xterm 渲染卡死（概率 20%）

**现象**：每次轮询都发送完整的 capture-pane 输出（可能 1~2 万字符），加上 `\x1B[2J\x1B[H` 清屏，导致 xterm 频繁全量重绘，性能崩溃。

**验证方法**：
1. 限制 capture 范围：
```swift
// SSHTransport.swift capturePane()
let cmd = "\(tmux) capture-pane -p -t \(session) -e -S -50"  // 只取最后 50 行
```
2. 或者限制轮询频率到 1-2 秒

### 假设 4：ANSI 转义序列处理问题（概率 10%）

**现象**：`writeToTerminal()` 的字符串转义不完整，导致生成的 JS 代码有语法错误。

**当前转义逻辑**：
```swift
let escaped = data.replacingOccurrences(of: "\\", with: "\\\\")
                  .replacingOccurrences(of: "'", with: "\\'")
                  .replacingOccurrences(of: "\n", with: "\\n")
                  .replacingOccurrences(of: "\r", with: "\\r")
```

**缺失的转义**：
- `\x1B`（ESC 字符）→ 应该保留，但如果字符串中有其他控制字符可能出问题
- 其他 Unicode 控制字符
- 特别长的字符串可能触发 JS 字符串长度限制

---

## 七、建议的排查步骤

### 第一步：让 evaluateJavaScript 错误可见

修改 `WebViewWrapper.swift`：
```swift
func updateUIView(_ uiView: WKWebView, context: Context) {
    if let script = script {
        uiView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("[Terminal] evaluateJavaScript error: \(error)")
                // 关键：上报到 overlay
                self.bridge.onJSError?("evalJS failed: \(error.localizedDescription)")
            }
            // 可选：记录成功情况
            // self.bridge.onJSError?("evalJS success, result=\(String(describing: result))")
            DispatchQueue.main.async {
                self.script = nil
            }
        }
    }
}
```

### 第二步：增强 JS 侧日志

修改 `TerminalScript.swift` 中的 `window.write`：
```javascript
window.write = function(data) {
    try {
        const container = document.getElementById('terminal');
        statusEl.textContent = 'write:' + data.length + 
            ' cols=' + term.cols + ' rows=' + term.rows +
            ' cw=' + container.clientWidth + ' ch=' + container.clientHeight;
        term.write(data);
    } catch(e) {
        statusEl.textContent = 'write ERROR: ' + e.message;
        window.webkit.messageHandlers.terminalBridge.postMessage({
            "type": "jsError",
            "message": "write() exception: " + e.message
        });
    }
};
```

### 第三步：限制数据量测试

临时修改 `SSHTransport.swift` 的 `capturePane()`：
```swift
private func capturePane(session: String, tmuxPath: String?) async throws -> String {
    guard let client = client, isConnected else {
        throw SSHTransportError.notConnected
    }
    let tmux = tmuxPath ?? "tmux"
    // 只获取最后 30 行，看是否能显示
    let cmd = "\(tmux) capture-pane -p -t \(session) -e -S -30"
    let buffer = try await client.executeCommand(cmd)
    return String(buffer: buffer)
}
```

### 第四步：确认 WebView 布局正确

在 `InteractiveTerminalView` 中临时给 WebView 加个边框：
```swift
XTermSSHView(...)
    .border(Color.red, width: 2)  // 看是否有红框、框多大
```

---

## 八、构建与安装命令

```bash
# 构建
xcodebuild -project VoiceTmuxApp/VoiceTmuxApp.xcodeproj \
    -scheme VoiceTmuxApp \
    -destination "generic/platform=iOS" \
    -configuration Debug build

# 找到 app 路径
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/VoiceTmuxApp-*/Build/Products/Debug-iphoneos -name "VoiceTmuxApp.app" -type d | head -1)

# 安装到设备 (替换设备 ID)
xcrun devicectl device install app --device 97E3BEB0-31E0-4D45-89BF-5100ABD75CA3 "$APP_PATH"
```

---

## 九、次要问题：SSH 轮询稳定性

### 问题描述
频繁调用 `client.executeCommand()` 创建新 channel，有时会触发 `NIOSSHError.creatingChannelAfterClosure`。

### 当前处理 (不完整)
```swift
// SSHTransport.swift line 155-158
if errorText.contains("creatingChannelAfterClosure") {
    await self.reconnectIfPossible()  // ← 只是断开，没有重连
}

// line 210-215
private func reconnectIfPossible() async {
    try? await client?.close()
    client = nil
    isConnected = false
    // ← 没有重新连接！需要存储 credentials 并重新 connect
}
```

### 后续修复建议
1. 在 `connect()` 时保存 credentials
2. `reconnectIfPossible()` 中用保存的 credentials 重新调用 `connect()`
3. 或者改用持久 shell channel 而非反复 `executeCommand`

---

## 十、总结

| 层级 | 状态 | 说明 |
|------|------|------|
| SSH 轮询获取数据 | ✅ 正常 | 能拿到 capture-pane 输出 |
| 数据传到 SwiftUI | ✅ 正常 | TerminalOutputBuffer 收到数据 |
| SwiftUI → WKWebView | ❓ 可疑 | evaluateJavaScript 错误未上报 |
| JS write() → xterm | ❓ 可疑 | 需确认 cols/rows 非零、canvas 尺寸正确 |
| xterm 渲染 | ❌ 黑屏 | 终端区域无任何文字显示 |

**最高优先级**：让 `evaluateJavaScript` 错误可见 + 确认 xterm 尺寸非零。这两步做完大概率能定位到具体故障点。
