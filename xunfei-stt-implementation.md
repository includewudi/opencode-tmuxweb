# 讯飞语音对接实现细节

**文档状态**: 实现参考文档  
**适用范围**: VoiceTmuxApp / VoiceTmuxCore  
**最后更新**: 2025-02-05

---

## 1. 概述

本文档详细描述讯飞实时语音转写 (IAT) WebSocket API 的对接实现。

### 1.1 功能范围

| 功能 | 状态 | 说明 |
|------|------|------|
| 流式语音识别 | ✅ 支持 | 实时返回识别结果 |
| 动态纠正 | ✅ 支持 | `wpgs` 模式，支持结果修正 |
| 中间结果 | ✅ 支持 | 边说边显示 |
| TTS | ❌ 不支持 | 不在范围内 |
| 离线识别 | ❌ 不支持 | 仅在线 |

### 1.2 模块分布

| 模块 | 位置 | 职责 |
|------|------|------|
| `XunfeiAuth` | VoiceTmuxCore | 鉴权 URL 生成 |
| `XunfeiFrames` | VoiceTmuxCore | 请求帧结构定义 |
| `XunfeiSpeechService` | VoiceTmuxApp | 录音 + WebSocket 通信 + 结果处理 |
| `KeychainService` | VoiceTmuxApp | 凭据存储 |

---

## 2. 凭据管理

### 2.1 所需凭据

| 凭据 | 获取方式 | 用途 |
|------|----------|------|
| App ID | 讯飞开放平台控制台 | 标识应用 |
| API Key | 讯飞开放平台控制台 | 鉴权签名 |
| API Secret | 讯飞开放平台控制台 | HMAC 密钥 |

### 2.2 存储方式

使用 iOS Keychain 安全存储：

```swift
// KeychainService.swift
static func saveXunfeiCredentials(appId: String, apiKey: String, apiSecret: String)
static func loadXunfeiCredentials() -> XunfeiCredentials?
static func deleteXunfeiCredentials()

struct XunfeiCredentials {
    let appId: String
    let apiKey: String
    let apiSecret: String
}
```

### 2.3 Keychain Key 名称

| Key | 存储内容 |
|-----|----------|
| `xunfeiAppId` | App ID |
| `xunfeiApiKey` | API Key |
| `xunfeiApiSecret` | API Secret |

---

## 3. WebSocket 鉴权

### 3.1 API 端点

```
wss://iat-api.xfyun.cn/v2/iat
```

### 3.2 鉴权流程

讯飞使用 HMAC-SHA256 签名进行 WebSocket 鉴权。

#### 签名生成步骤

```swift
// XunfeiAuth.swift
public func buildAuthURL(date: String) -> String {
    let host = "iat-api.xfyun.cn"
    let path = "/v2/iat"
    
    // 1. 构造签名原文
    let signatureOrigin = "host: \(host)\ndate: \(date)\nGET \(path) HTTP/1.1"
    
    // 2. HMAC-SHA256 签名
    let key = SymmetricKey(data: Data(apiSecret.utf8))
    let signature = HMAC<SHA256>.authenticationCode(for: Data(signatureOrigin.utf8), using: key)
    let signatureBase64 = Data(signature).base64EncodedString()
    
    // 3. 构造 authorization 原文
    let authorizationOrigin = """
        api_key="\(apiKey)", algorithm="hmac-sha256", headers="host date request-line", signature="\(signatureBase64)"
        """
    
    // 4. Base64 编码 authorization
    let authorization = Data(authorizationOrigin.utf8).base64EncodedString()
    
    // 5. 拼接最终 URL
    var components = URLComponents(string: "wss://iat-api.xfyun.cn/v2/iat")!
    components.queryItems = [
        URLQueryItem(name: "authorization", value: authorization),
        URLQueryItem(name: "date", value: date),
        URLQueryItem(name: "host", value: host),
    ]
    return components.url!.absoluteString
}
```

#### date 格式要求

必须是 RFC1123 格式的 GMT 时间：

```swift
let dateFormatter = DateFormatter()
dateFormatter.locale = Locale(identifier: "en_US_POSIX")
dateFormatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss z"
dateFormatter.timeZone = TimeZone(abbreviation: "GMT")
let date = dateFormatter.string(from: Date())
// 输出示例: "Wed, 05 Feb 2025 14:30:00 GMT"
```

### 3.3 依赖

```swift
import CryptoKit  // HMAC-SHA256
```

---

## 4. 音频采集

### 4.1 音频格式要求

| 参数 | 值 | 说明 |
|------|-----|------|
| 采样率 | 16000 Hz | 讯飞要求 |
| 位深 | 16 bit | 有符号整数 |
| 声道 | 单声道 (mono) | 1 channel |
| 编码 | raw (PCM) | 无压缩 |

### 4.2 AVAudioEngine 配置

```swift
// XunfeiSpeechService.swift
func startRecording() {
    // 1. 配置音频会话
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
    try session.setActive(true)
    
    // 2. 创建目标格式
    let recordingFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,  // 16bit PCM
        sampleRate: 16000,               // 16kHz
        channels: 1,                     // mono
        interleaved: true
    )!
    
    // 3. 安装音频 tap
    audioEngine = AVAudioEngine()
    let inputNode = audioEngine.inputNode
    
    inputNode.installTap(onBus: 0, bufferSize: 1280, format: inputNode.outputFormat(forBus: 0)) { buffer, _ in
        // 处理音频缓冲区
    }
    
    try audioEngine.start()
}
```

### 4.3 格式转换

设备麦克风格式可能与目标格式不同，需要转换：

```swift
private func convertBuffer(_ buffer: AVAudioPCMBuffer, to format: AVAudioFormat) -> AVAudioPCMBuffer? {
    guard let converter = AVAudioConverter(from: buffer.format, to: format) else { return nil }
    
    let ratio = format.sampleRate / buffer.format.sampleRate
    let outputFrameCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio)
    
    guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: outputFrameCapacity) else { return nil }
    
    var error: NSError?
    let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
        outStatus.pointee = .haveData
        return buffer
    }
    
    converter.convert(to: outputBuffer, error: &error, withInputFrom: inputBlock)
    return error == nil ? outputBuffer : nil
}
```

### 4.4 缓冲区转 Data

```swift
private func bufferToData(_ buffer: AVAudioPCMBuffer) -> Data {
    let audioBuffer = buffer.audioBufferList.pointee.mBuffers
    return Data(bytes: audioBuffer.mData!, count: Int(audioBuffer.mDataByteSize))
}
```

---

## 5. WebSocket 通信

### 5.1 连接

```swift
let urlSession = URLSession(configuration: .default)
webSocketTask = urlSession.webSocketTask(with: url)
webSocketTask?.resume()
```

### 5.2 消息接收

```swift
private func receiveMessage() {
    webSocketTask?.receive { [weak self] result in
        switch result {
        case .success(let message):
            switch message {
            case .string(let text):
                self?.handleResponse(text)
            default:
                break
            }
            self?.receiveMessage()  // 继续接收
        case .failure:
            break
        }
    }
}
```

---

## 6. 请求帧结构

### 6.1 帧类型

| 帧类型 | status | 说明 |
|--------|--------|------|
| 首帧 | 0 | 包含 common + business + data |
| 中间帧 | 1 | 仅包含 data |
| 尾帧 | 2 | data.audio 为空字符串 |

### 6.2 帧结构定义

```swift
// XunfeiFrames.swift
public struct Frame: Codable {
    public let common: Common?      // 仅首帧
    public let business: Business?  // 仅首帧
    public let data: DataPayload    // 所有帧
}

public struct Common: Codable {
    public let appId: String  // JSON key: "app_id"
}

public struct Business: Codable {
    public let language: String   // "zh_cn"
    public let domain: String     // "iat"
    public let accent: String     // "mandarin"
    public let vadEos: Int        // 2000 (ms)
    public let dwa: String        // "wpgs"
}

public struct DataPayload: Codable {
    public let status: Int        // 0/1/2
    public let format: String     // "audio/L16;rate=16000"
    public let encoding: String   // "raw"
    public let audio: String      // base64 编码的 PCM 数据
}
```

### 6.3 首帧生成

```swift
public static func firstFrame(appId: String, audio: Data) -> Frame {
    let common = Common(appId: appId)
    let business = Business(
        language: "zh_cn",     // 中文
        domain: "iat",         // 日常用语
        accent: "mandarin",    // 普通话
        vadEos: 2000,          // 静音检测 2 秒
        dwa: "wpgs"            // 动态修正
    )
    let payload = DataPayload(
        status: 0,
        format: "audio/L16;rate=16000",
        encoding: "raw",
        audio: audio.base64EncodedString()
    )
    return Frame(common: common, business: business, data: payload)
}
```

### 6.4 尾帧生成

```swift
public static func endFrame() -> Frame {
    let payload = DataPayload(
        status: 2,
        format: "audio/L16;rate=16000",
        encoding: "raw",
        audio: ""  // 空音频
    )
    return Frame(data: payload)
}
```

### 6.5 Business 参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `language` | `zh_cn` | 语种：中文 |
| `domain` | `iat` | 领域：日常用语 |
| `accent` | `mandarin` | 方言：普通话 |
| `vadEos` | `2000` | 静音检测时长 (ms)，检测到 2 秒静音后自动停止 |
| `dwa` | `wpgs` | 动态修正模式，启用流式结果纠正 |

#### 其他可选方言 (accent)

| 值 | 方言 |
|-----|------|
| `mandarin` | 普通话 |
| `cantonese` | 粤语 |
| `sichuanese` | 四川话 |
| `henanese` | 河南话 |
| ... | ... |

---

## 7. 响应处理

### 7.1 响应结构

```json
{
  "code": 0,
  "message": "success",
  "sid": "xxx",
  "data": {
    "result": {
      "ws": [
        {
          "bg": 0,
          "cw": [
            {"w": "你好", "sc": 0.95}
          ]
        }
      ],
      "pgs": "apd",
      "rg": [0, 1],
      "sn": 1,
      "ls": false
    },
    "status": 1
  }
}
```

### 7.2 响应模型

```swift
struct XunfeiResponse: Codable {
    let code: Int
    let message: String?
    let data: XunfeiData?
}

struct XunfeiData: Codable {
    let result: XunfeiResult?
}

struct XunfeiResult: Codable {
    let ws: [XunfeiWs]?
    let pgs: String?
    let rg: [Int]?
}

struct XunfeiWs: Codable {
    let cw: [XunfeiCw]?
}

struct XunfeiCw: Codable {
    let w: String?
}
```

### 7.3 动态纠正 (pgs/rg)

| pgs | 含义 | 处理方式 |
|-----|------|----------|
| `apd` | append | 追加到已识别文本末尾 |
| `rpl` | replace | 替换 `rg[0]` 到 `rg[1]` 位置的文本 |

```swift
private func handleResponse(_ text: String) {
    guard let data = text.data(using: .utf8),
          let response = try? JSONDecoder().decode(XunfeiResponse.self, from: data) else {
        return
    }
    
    if response.code != 0 {
        self.error = "识别错误: \(response.message ?? "未知错误")"
        return
    }
    
    guard let result = response.data?.result else { return }
    
    // 提取文本
    var text = ""
    for ws in result.ws ?? [] {
        for cw in ws.cw ?? [] {
            text += cw.w ?? ""
        }
    }
    
    Task { @MainActor in
        if result.pgs == "rpl", let rg = result.rg, rg.count >= 2 {
            // 替换模式
            let startIndex = self.recognizedText.index(
                self.recognizedText.startIndex, 
                offsetBy: min(rg[0], self.recognizedText.count)
            )
            let endIndex = self.recognizedText.index(
                self.recognizedText.startIndex, 
                offsetBy: min(rg[1], self.recognizedText.count)
            )
            self.recognizedText.replaceSubrange(startIndex..<endIndex, with: text)
        } else {
            // 追加模式
            self.recognizedText += text
        }
    }
}
```

---

## 8. 录音停止与资源释放

### 8.1 停止录音

```swift
func stopRecording() {
    guard isRecording else { return }
    
    // 1. 移除音频 tap
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine?.stop()
    audioEngine = nil
    isRecording = false
    
    // 2. 发送尾帧
    let endFrame = XunfeiFrames.endFrame()
    if let jsonData = try? JSONEncoder().encode(endFrame),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        webSocketTask?.send(.string(jsonString)) { [weak self] _ in
            // 3. 延迟关闭 WebSocket
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                self?.webSocketTask?.cancel(with: .goingAway, reason: nil)
                self?.webSocketTask = nil
            }
        }
    }
}
```

### 8.2 关闭时机

发送尾帧后等待 1 秒再关闭 WebSocket，确保服务端返回最终识别结果。

---

## 9. 错误处理

### 9.1 错误码

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| 0 | 成功 | - |
| 10006 | 无效参数 | 检查 business 参数 |
| 10013 | 无权访问 | 检查 API Key 权限 |
| 10014 | 并发超限 | 等待后重试 |
| 10015 | 余额不足 | 充值 |
| 10105 | 无效 App ID | 检查 App ID |
| 10106 | 无效 API Key | 检查 API Key |
| 10107 | 无效 API Secret | 检查 API Secret |
| 10109 | 签名过期 | 检查 date 时间 |
| 10110 | 签名错误 | 检查签名算法 |

### 9.2 客户端错误

```swift
// 配置错误
if !isConfigured {
    error = "请先配置讯飞语音 API"
    return
}

// 音频会话错误
do {
    try session.setCategory(.playAndRecord, ...)
} catch {
    self.error = "无法配置音频会话: \(error.localizedDescription)"
    return
}

// WebSocket URL 错误
guard let url = URL(string: urlString) else {
    self.error = "无法创建 WebSocket URL"
    return
}

// 音频引擎错误
do {
    try audioEngine.start()
} catch {
    self.error = "无法启动音频引擎: \(error.localizedDescription)"
}
```

---

## 10. 完整流程图

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户点击麦克风按钮                           │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  1. 检查凭据是否已配置                                              │
│     - 未配置 → 弹出设置页面                                         │
│     - 已配置 → 继续                                                │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. 配置 AVAudioSession                                           │
│     - category: .playAndRecord                                    │
│     - mode: .measurement                                          │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. 生成鉴权 URL                                                   │
│     - 获取 GMT 时间                                                │
│     - HMAC-SHA256 签名                                            │
│     - 拼接 WebSocket URL                                          │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. 建立 WebSocket 连接                                            │
│     - URLSession.webSocketTask(with: url)                         │
│     - 启动消息接收循环                                              │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. 启动 AVAudioEngine                                            │
│     - installTap(onBus: 0, bufferSize: 1280)                      │
│     - 设置 isRecording = true                                     │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. 音频处理循环                                                              │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │  每次收到音频缓冲区:                                                   │ │
│     │    a. 格式转换 → 16kHz/16bit/mono                                    │ │
│     │    b. 转为 Data                                                      │ │
│     │    c. Base64 编码                                                    │ │
│     │    d. 构造帧 (首帧/中间帧)                                             │ │
│     │    e. JSON 编码并发送                                                 │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ (并行)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. 响应处理循环                                                              │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │  每次收到 WebSocket 消息:                                             │ │
│     │    a. JSON 解码                                                      │ │
│     │    b. 检查 code == 0                                                 │ │
│     │    c. 提取识别文本                                                    │ │
│     │    d. 根据 pgs 追加或替换                                              │ │
│     │    e. 更新 @Published recognizedText                                 │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  8. 用户再次点击麦克风按钮 (停止)                                     │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  9. 停止录音                                                       │
│     - removeTap(onBus: 0)                                         │
│     - audioEngine.stop()                                          │
│     - 发送尾帧 (status: 2)                                         │
│     - 延迟 1 秒关闭 WebSocket                                       │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  10. 注入识别结果                                                   │
│     - sessionHolder.sendKeys(recognizedText)                      │
│     - 清空 recognizedText                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. 测试验证清单

### 11.1 凭据管理

- [ ] 保存凭据后可正确加载
- [ ] 删除凭据后 `isConfigured` 返回 false
- [ ] 凭据安全存储在 Keychain

### 11.2 鉴权

- [ ] 生成的 URL 包含正确的 authorization
- [ ] date 格式符合 RFC1123
- [ ] 签名验证通过 (code == 0)

### 11.3 音频采集

- [ ] 麦克风权限正确请求
- [ ] 音频格式正确转换为 16kHz/16bit/mono
- [ ] 连续音频流正确发送

### 11.4 识别结果

- [ ] 中文识别正确
- [ ] 动态纠正 (pgs=rpl) 工作正常
- [ ] 最终结果正确注入终端

### 11.5 错误处理

- [ ] 未配置凭据时提示设置
- [ ] 网络错误正确提示
- [ ] 余额不足等服务端错误正确提示

---

## 12. 安全注意事项

1. **凭据存储**: 必须使用 Keychain，不能存储在 UserDefaults
2. **签名计算**: 必须在客户端计算，不能将 API Secret 发送到任何服务器
3. **HTTPS**: 讯飞 API 强制使用 WSS (WebSocket Secure)
4. **权限**: 必须在 Info.plist 声明 `NSMicrophoneUsageDescription`
