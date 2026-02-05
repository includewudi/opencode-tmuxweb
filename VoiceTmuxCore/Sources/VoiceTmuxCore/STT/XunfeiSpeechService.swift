import Foundation
import AVFoundation

public enum STTError: Error {
    case configMissing
    case audioSetupFailed(Error)
    case connectionFailed(Error)
    case recognitionFailed(Int, String)
}

public protocol STTDelegate: AnyObject {
    func onPartialResult(text: String)
    func onFinalResult(text: String)
    func onError(_ error: Error)
}

public class XunfeiSpeechService: NSObject {
    private var webSocketTask: URLSessionWebSocketTask?
    private let audioEngine = AVAudioEngine()
    private weak var delegate: STTDelegate?
    
    private var appId: String?
    private var apiKey: String?
    private var apiSecret: String?
    
    private var isRecording = false
    private var audioSeq = 0
    private var accumulatedText = ""
    
    public init(delegate: STTDelegate) {
        self.delegate = delegate
        super.init()
    }
    
    public func updateConfig(appId: String, apiKey: String, apiSecret: String) {
        self.appId = appId
        self.apiKey = apiKey
        self.apiSecret = apiSecret
    }
    
    public func startRecording() throws {
        guard let appId = appId, let apiKey = apiKey, let apiSecret = apiSecret else {
            throw STTError.configMissing
        }
        
        guard !isRecording else { return }
        
        audioSeq = 0
        accumulatedText = ""
        
        guard let url = XunfeiAuth.buildAuthURL(apiKey: apiKey, apiSecret: apiSecret) else {
            throw STTError.connectionFailed(NSError(domain: "URL", code: -1))
        }
        
        let session = URLSession(configuration: .default, delegate: nil, delegateQueue: OperationQueue())
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        listen()
        
        let inputNode = audioEngine.inputNode
        let hardwareFormat = inputNode.outputFormat(forBus: 0)
        
        guard let recordingFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true) else {
            throw STTError.audioSetupFailed(NSError(domain: "Format", code: -1))
        }
        
        inputNode.removeTap(onBus: 0)
        
        let converter = AVAudioConverter(from: hardwareFormat, to: recordingFormat)
        var isFirstFrame = true
        let capturedAppId = appId
        
        inputNode.installTap(onBus: 0, bufferSize: 1280, format: hardwareFormat) { [weak self] (buffer, _) in
            guard let self = self, self.isRecording else { return }
            
            let frameCapacity = AVAudioFrameCount(recordingFormat.sampleRate * 0.08)
            guard let pcmBuffer = AVAudioPCMBuffer(pcmFormat: recordingFormat, frameCapacity: frameCapacity) else { return }
            
            var error: NSError?
            let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            
            converter?.convert(to: pcmBuffer, error: &error, withInputFrom: inputBlock)
            
            guard let audioData = self.bufferToData(pcmBuffer) else { return }
            
            if isFirstFrame {
                self.sendFirstFrame(appId: capturedAppId, audioData: audioData)
                isFirstFrame = false
            } else {
                self.sendContinueFrame(audioData: audioData)
            }
        }
        
        do {
            try audioEngine.start()
            isRecording = true
        } catch {
            throw STTError.audioSetupFailed(error)
        }
    }
    
    public func stopRecording() {
        guard isRecording else { return }
        isRecording = false
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        
        sendLastFrame()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            self?.webSocketTask?.cancel(with: .normalClosure, reason: nil)
            self?.webSocketTask = nil
        }
    }
    
    // MARK: - WebSocket
    
    private func listen() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .failure(let error):
                self.delegate?.onError(error)
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default: break
                }
                self.listen()
            }
        }
    }
    
    private func handleMessage(_ json: String) {
        guard let data = json.data(using: .utf8),
              let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let header = response["header"] as? [String: Any],
              let code = header["code"] as? Int else { return }
        
        if code != 0 {
            let msg = header["message"] as? String ?? "Unknown error"
            delegate?.onError(STTError.recognitionFailed(code, msg))
            return
        }
        
        guard let payload = response["payload"] as? [String: Any],
              let result = payload["result"] as? [String: Any],
              let textBase64 = result["text"] as? String,
              let textData = Data(base64Encoded: textBase64),
              let textJson = try? JSONSerialization.jsonObject(with: textData) as? [String: Any],
              let ws = textJson["ws"] as? [[String: Any]] else { return }
        
        var segmentText = ""
        for item in ws {
            if let cw = item["cw"] as? [[String: Any]] {
                for w in cw {
                    if let word = w["w"] as? String {
                        segmentText += word
                    }
                }
            }
        }
        
        if !segmentText.isEmpty {
            accumulatedText += segmentText
            delegate?.onPartialResult(text: accumulatedText)
        }
        
        let headerStatus = header["status"] as? Int ?? 0
        if headerStatus == 2 {
            delegate?.onFinalResult(text: accumulatedText)
        }
    }
    
    // MARK: - Send Frames
    
    private func sendFirstFrame(appId: String, audioData: Data) {
        audioSeq = 1
        let frame: [String: Any] = [
            "header": [
                "app_id": appId,
                "status": 0
            ],
            "parameter": [
                "iat": [
                    "domain": "slm",
                    "language": "mul_cn",
                    "accent": "mandarin",
                    "eos": 6000,
                    "vinfo": 1,
                    "result": [
                        "encoding": "utf8",
                        "compress": "raw",
                        "format": "json"
                    ]
                ]
            ],
            "payload": [
                "audio": [
                    "encoding": "raw",
                    "sample_rate": 16000,
                    "channels": 1,
                    "bit_depth": 16,
                    "seq": audioSeq,
                    "status": 0,
                    "audio": audioData.base64EncodedString()
                ]
            ]
        ]
        sendJson(frame)
    }
    
    private func sendContinueFrame(audioData: Data) {
        audioSeq += 1
        let frame: [String: Any] = [
            "header": [
                "app_id": appId ?? "",
                "status": 1
            ],
            "payload": [
                "audio": [
                    "encoding": "raw",
                    "sample_rate": 16000,
                    "status": 1,
                    "audio": audioData.base64EncodedString()
                ]
            ]
        ]
        sendJson(frame)
    }
    
    private func sendLastFrame() {
        audioSeq += 1
        let frame: [String: Any] = [
            "header": [
                "app_id": appId ?? "",
                "status": 2
            ],
            "payload": [
                "audio": [
                    "encoding": "raw",
                    "sample_rate": 16000,
                    "status": 2,
                    "audio": ""
                ]
            ]
        ]
        sendJson(frame)
    }
    
    private func sendJson(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str = String(data: data, encoding: .utf8) else { return }
        
        webSocketTask?.send(.string(str)) { error in
            if let error = error {
                print("Send error: \(error)")
            }
        }
    }
    
    private func bufferToData(_ buffer: AVAudioPCMBuffer) -> Data? {
        guard let channelData = buffer.int16ChannelData else { return nil }
        return Data(bytes: channelData.pointee, count: Int(buffer.frameLength) * 2)
    }
}
