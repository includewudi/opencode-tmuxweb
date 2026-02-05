import SwiftUI
import VoiceTmuxCore
import Combine

@MainActor
public class VoiceViewModel: ObservableObject, STTDelegate {
    private var sttService: XunfeiSpeechService!
    private let keychainService = KeychainService.shared
    
    @Published public var isRecording = false
    @Published public var partialText: String = ""
    @Published public var error: String?
    
    public var onTextRecognized: ((String) -> Void)?
    
    public init() {
        self.sttService = XunfeiSpeechService(delegate: self)
        
        // Load config
        if let config = try? keychainService.loadXunfeiConfig() {
            sttService.updateConfig(appId: config.appId, apiKey: config.apiKey, apiSecret: config.apiSecret)
        }
    }
    
    public func toggleRecording() {
        if isRecording {
            sttService.stopRecording()
            isRecording = false
        } else {
            // Reload config in case it changed
            if let config = try? keychainService.loadXunfeiConfig() {
                sttService.updateConfig(appId: config.appId, apiKey: config.apiKey, apiSecret: config.apiSecret)
            }
            
            do {
                try sttService.startRecording()
                isRecording = true
                partialText = ""
                error = nil
            } catch {
                self.error = "Start failed: \(error.localizedDescription)"
                isRecording = false
            }
        }
    }
    
    // MARK: - STTDelegate (non-isolated conformance needs care)
    // XunfeiSpeechService calls delegate on arbitrary queue likely.
    // We need to dispatch to MainActor.
    
    nonisolated public func onPartialResult(text: String) {
        Task { @MainActor in
            // Basic accumulation/replacement logic
            // Simple append for now as per spec "apd" simplified
            self.partialText = text // Xunfei pgs 'rpl' vs 'apd' is complex, simplifying to just showing what comes
            // If we assume text is the *current segment*, we might just display it.
        }
    }
    
    nonisolated public func onFinalResult(text: String) {
         Task { @MainActor in
             self.onTextRecognized?(text)
             self.partialText = "" // Clear after commit
         }
    }
    
    nonisolated public func onError(_ error: Error) {
        Task { @MainActor in
            self.error = error.localizedDescription
            self.isRecording = false
        }
    }
}
