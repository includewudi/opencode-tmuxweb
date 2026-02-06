import SwiftUI
import WebKit

public class TerminalOutputBuffer: ObservableObject {
    @Published public var pendingOutput: String?
    
    public init() {}
    
    public func append(_ data: String) {
        Task { @MainActor in
            self.pendingOutput = data
        }
    }
}

public struct XTermSSHView: View {
    @ObservedObject var outputBuffer: TerminalOutputBuffer
    let onInput: ((String) -> Void)?
    let onResize: ((Int, Int) -> Void)?
    let onReady: (() -> Void)?
    let onJSError: ((String) -> Void)?
    @State private var webViewScript: String?
    private let bridge = TerminalBridge()
    
    public init(outputBuffer: TerminalOutputBuffer, onInput: ((String) -> Void)? = nil, onResize: ((Int, Int) -> Void)? = nil, onReady: (() -> Void)? = nil, onJSError: ((String) -> Void)? = nil) {
        self.outputBuffer = outputBuffer
        self.onInput = onInput
        self.onResize = onResize
        self.onReady = onReady
        self.onJSError = onJSError
    }
    
    public var body: some View {
        WebViewWrapper(script: $webViewScript, bridge: bridge)
            .onAppear {
                bridge.onInput = onInput
                bridge.onResize = onResize
                bridge.onReady = onReady
                bridge.onJSError = onJSError
            }
            .onChange(of: outputBuffer.pendingOutput) { _, newValue in
                if let data = newValue {
                    writeToTerminal(data)
                    outputBuffer.pendingOutput = nil
                }
            }
    }
    
    private func writeToTerminal(_ data: String) {
        let escaped = data.replacingOccurrences(of: "\\", with: "\\\\")
                          .replacingOccurrences(of: "'", with: "\\'")
                          .replacingOccurrences(of: "\n", with: "\\n")
                          .replacingOccurrences(of: "\r", with: "\\r")
        
        self.webViewScript = "write('\(escaped)')"
    }
}
