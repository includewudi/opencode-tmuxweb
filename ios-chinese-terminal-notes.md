# iOS 终端中文支持注意事项

**文档状态**: 实现参考文档  
**适用范围**: VoiceTmuxApp / VoiceTmuxCore  
**最后更新**: 2025-02-05

---

## 1. 概述

iOS 终端应用支持中文需要处理以下几个关键环节：

1. **SSH 连接层**: 服务端环境变量设置
2. **终端模拟器层**: 字体配置、Unicode 宽度计算
3. **输入法层 (IME)**: 组合态输入视图样式
4. **语音输入层**: 中文识别结果注入

---

## 2. SSH 连接层：环境变量

### 2.1 问题

服务端默认 locale 可能不支持 UTF-8，导致中文显示为乱码或 `?`。

### 2.2 解决方案

在 PTY 连接时显式设置 `LANG` 和 `LC_ALL`：

```swift
// SSHTerminalView.swift - startConnection()
var command: String? = nil
if let target = tmuxTarget {
    command = "export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TERM=xterm-256color; exec /opt/homebrew/bin/tmux -u attach-session -t \(target)"
}
```

### 2.3 关键点

| 环境变量 | 值 | 作用 |
|----------|-----|------|
| `LANG` | `en_US.UTF-8` | 设置语言环境为 UTF-8 |
| `LC_ALL` | `en_US.UTF-8` | 覆盖所有 locale 类别 |
| `TERM` | `xterm-256color` | 终端类型，支持 256 色 |

### 2.4 tmux 特殊处理

使用 `tmux -u` 选项启动，强制 tmux 使用 UTF-8 模式：

```bash
tmux -u attach-session -t <session>
#    ^^
#    -u = force UTF-8 mode
```

---

## 3. 终端模拟器层：字体配置

### 3.1 问题

默认等宽字体 (如 Menlo) 不包含中文字符，需要 fallback 到 CJK 字体。

### 3.2 解决方案

使用 CSS 字体栈，优先等宽字体，fallback 到中文字体：

```swift
// SSHTerminalView.swift
extension XTerminalView {
    private static let cjkFontFamily = "Menlo, \"PingFang SC\", \"Heiti SC\", monospace"
    
    func applyTheme(_ theme: TerminalTheme, fontSize: Int, fit: Bool = true) {
        // ...
        let script = """
            if (window.setTheme) {
                window.setTheme({
                    fontFamily: '\(Self.cjkFontFamily)',
                    fontSize: \(fontSize)
                });
            }
            // ...
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}
```

### 3.3 推荐字体栈

| 优先级 | 字体名 | 类型 | 说明 |
|--------|--------|------|------|
| 1 | Menlo | 等宽 | macOS/iOS 内置，ASCII 字符 |
| 2 | PingFang SC | 中文 | iOS 内置，简体中文 |
| 3 | Heiti SC | 中文 | iOS 内置，黑体简体 |
| 4 | monospace | 通用 | 浏览器默认等宽字体 |

### 3.4 Unicode 字符宽度

CJK 字符通常是"全角"(full-width)，占两个字符宽度。xterm.js 会自动处理，但需确保：

- 终端 `TERM` 类型正确 (`xterm-256color`)
- 服务端 `wcwidth()` 函数可用
- tmux 以 UTF-8 模式运行

---

## 4. 输入法层 (IME)：组合态样式

### 4.1 问题

使用中文输入法时，xterm.js 的组合态视图 (composition view) 可能：
- 位置错误
- 字体过小
- 背景不可见

### 4.2 解决方案

注入 CSS 样式覆盖组合态视图：

```swift
// SSHTerminalView.swift
func enableIMESupport() {
    guard let webView = self.subviews.first(where: { $0 is WKWebView }) as? WKWebView else { return }
    let script = """
    (function() {
        var styleId = 'ime-style';
        if (document.getElementById(styleId)) { return; }
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .xterm .composition-view {
                max-width: 70vw;
                max-height: 28vh;
                padding: 2px 6px;
                font-size: 14px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.25);
                background: rgba(0,0,0,0.75);
                box-sizing: border-box;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
        document.head.appendChild(style);
    })();
    """
    webView.evaluateJavaScript(script, completionHandler: nil)
}
```

### 4.3 样式说明

| 属性 | 值 | 作用 |
|------|-----|------|
| `max-width` | `70vw` | 限制最大宽度，防止溢出 |
| `max-height` | `28vh` | 限制最大高度 |
| `padding` | `2px 6px` | 内边距，提升可读性 |
| `font-size` | `14px` | 固定字号，确保可读 |
| `background` | `rgba(0,0,0,0.75)` | 半透明黑色背景 |
| `border` | `1px solid rgba(255,255,255,0.25)` | 可见边框 |

### 4.4 调用时机

在终端视图初始化后调用：

```swift
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
    terminalView.applyTheme(theme, fontSize: fontSize)
    terminalView.enableIMESupport()  // 启用 IME 样式
}
```

---

## 5. 终端输出编码

### 5.1 数据流

```
SSH Server (UTF-8 bytes)
    ↓
Citadel SSH Channel
    ↓
Data (bytes)
    ↓
String(data: data, encoding: .utf8)
    ↓
XTerminalView.write(str)
```

### 5.2 关键代码

```swift
// XTermSSHView.Coordinator - startConnection()
try await session.connect(
    // ...
) { [weak self] data in
    guard let self = self else { return }
    if let str = String(data: data, encoding: .utf8) {  // UTF-8 解码
        Task { @MainActor in
            self.terminalView?.write(str)
        }
    }
}
```

### 5.3 注意事项

- **始终使用 UTF-8 解码**: `String(data:encoding:)` 使用 `.utf8`
- **处理解码失败**: 如果服务端输出非 UTF-8 数据，解码会返回 `nil`
- **分片边界问题**: SSH 数据包可能在 UTF-8 多字节序列中间断开

#### 分片边界解决方案

如果遇到中文被截断的问题，需要缓冲不完整的 UTF-8 序列：

```swift
private var pendingData = Data()

func handleData(_ data: Data) {
    pendingData.append(data)
    
    // 尝试解码
    if let str = String(data: pendingData, encoding: .utf8) {
        pendingData = Data()
        terminalView?.write(str)
    } else {
        // 保留最后 3 字节（UTF-8 最大字节数 - 1）
        if pendingData.count > 3 {
            let splitPoint = pendingData.count - 3
            if let str = String(data: pendingData.prefix(splitPoint), encoding: .utf8) {
                terminalView?.write(str)
                pendingData = Data(pendingData.suffix(3))
            }
        }
    }
}
```

---

## 6. 终端输入编码

### 6.1 数据流

```
UIKit Keyboard / IME
    ↓
XTerminalView (JavaScript)
    ↓
setupBufferChain callback (String)
    ↓
data(using: .utf8)
    ↓
SSHTerminalSession.write(Data)
    ↓
SSH Channel → Server
```

### 6.2 关键代码

```swift
// XTermSSHView.Coordinator
func handleTerminalOutput(_ output: String) {
    guard let session = session else { return }
    guard let data = output.data(using: .utf8) else { return }  // UTF-8 编码
    Task {
        try? await session.write(data)
    }
}
```

### 6.3 中文输入流程

1. 用户使用中文输入法输入
2. IME 显示组合态视图（拼音 + 候选词）
3. 用户选择候选词
4. 选中的中文字符通过 `setupBufferChain` 回调发送
5. 转换为 UTF-8 字节后发送到服务器

---

## 7. 语音输入注入

### 7.1 识别结果注入

讯飞语音识别返回的中文文本直接发送到终端：

```swift
// XTermTerminalContainer
.onChange(of: speechService.recognizedText) { _, newValue in
    if !speechService.isRecording && !newValue.isEmpty {
        sessionHolder.sendKeys(newValue)  // 发送识别到的中文
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            speechService.recognizedText = ""
        }
    }
}
```

### 7.2 sendKeys 实现

```swift
// TerminalSessionHolder
func sendKeys(_ keys: String) {
    guard let session = coordinator?.session else { return }
    Task {
        try? await session.write(keys)  // 自动 UTF-8 编码
    }
}
```

---

## 8. 验证清单

### 8.1 SSH 环境

- [ ] 服务端 `locale` 命令输出包含 `UTF-8`
- [ ] `echo $LANG` 返回 `en_US.UTF-8` 或类似 UTF-8 locale
- [ ] tmux 以 `-u` 选项启动

### 8.2 终端显示

- [ ] 中文字符正确显示（不是 `?` 或乱码）
- [ ] 中文字符宽度正确（占两个字符位置）
- [ ] vim/nano 等编辑器中文对齐正确

### 8.3 输入法

- [ ] 拼音组合态正确显示
- [ ] 候选词列表可见
- [ ] 选中候选词后正确输入

### 8.4 语音输入

- [ ] 讯飞识别返回中文正确
- [ ] 识别结果正确注入终端
- [ ] 动态纠正 (`pgs=rpl`) 工作正常

---

## 9. 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 中文显示为 `?` | 服务端 locale 不是 UTF-8 | 检查 `LANG` 环境变量 |
| 中文宽度错误 | `TERM` 类型不正确 | 确保 `TERM=xterm-256color` |
| IME 不显示 | xterm.js 未初始化完成 | 延迟调用 `enableIMESupport()` |
| 中文被截断 | UTF-8 分片边界问题 | 实现字节缓冲机制 |
| 语音识别乱码 | 讯飞返回 GBK 编码 | 不应发生（讯飞使用 JSON/UTF-8） |
