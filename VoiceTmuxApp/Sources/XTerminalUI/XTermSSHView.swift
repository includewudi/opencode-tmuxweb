import SwiftUI
import VoiceTmuxCore

public struct XTermSSHView: View {
    let transport: SSHTransport
    @State private var webViewScript: String?
    private let bridge = TerminalBridge()
    
    public init(transport: SSHTransport) {
        self.transport = transport
    }
    
    public var body: some View {
        WebViewWrapper(script: $webViewScript, bridge: bridge)
            .onAppear {
                setupBridge()
            }
            .task {
                await setupSSHBinding()
            }
    }
    
    // Bind UI Input -> SSH
    private func setupBridge() {
        bridge.onInput = { data in
            Task {
                try? await transport.send(input: data)
            }
        }
    }
    
    // Bind SSH Output -> UI
    private func setupSSHBinding() async {
        await transport.registerOutputHandler { data in
            // Dispatch to MainActor to update UI state
            Task { @MainActor in
                self.writeToTerminal(data)
            }
        }
    }
    
    private func writeToTerminal(_ data: String) {
        // Simple JS escaping
        let escaped = data.replacingOccurrences(of: "\\", with: "\\\\")
                          .replacingOccurrences(of: "'", with: "\\'")
                          .replacingOccurrences(of: "\n", with: "\\n")
                          .replacingOccurrences(of: "\r", with: "\\r")
        
        // We use the 'write' function defined in our HTML template
        self.webViewScript = "write('\(escaped)')"
    }
}
