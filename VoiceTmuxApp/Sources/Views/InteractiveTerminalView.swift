import SwiftUI
import VoiceTmuxCore

struct InteractiveTerminalView: View {
    @ObservedObject var viewModel: AppViewModel
    let sessionName: String

    var transport: SSHTransport { viewModel.transport }

    @Environment(\.dismiss) var dismiss
    @State private var activePanelTab: TerminalInputPanel.PanelTab = .keys
    @State private var shellStarted = false
    @StateObject private var terminalOutput = TerminalOutputBuffer()
    @State private var debugMessages: [String] = []

    var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: 0) {
                TerminalControlBar(
                    hostAlias: viewModel.currentHost?.alias ?? "Terminal",
                    status: viewModel.connectionState,
                    onDisconnect: {
                        Task { await viewModel.disconnect() }
                        dismiss()
                    },
                    onSettings: {
                        viewModel.showXunfeiSettings = true
                    }
                )
                
                XTermSSHView(outputBuffer: terminalOutput, onInput: send, onResize: resize, onReady: handleTerminalReady, onJSError: handleTerminalError)
                
                if activePanelTab != .closed {
                    TerminalInputPanel(
                        onInput: send,
                        activeTab: $activePanelTab
                    )
                    .transition(.move(edge: .bottom))
                } else {
                    HStack {
                        Spacer()
                        Button(action: { activePanelTab = .keys }) {
                            Image(systemName: "keyboard.badge.ellipsis")
                                .padding()
                                .background(Color(UIColor.systemGray6))
                                .clipShape(Circle())
                        }
                        .padding()
                    }
                }
            }
            debugOverlay
        }
        .edgesIgnoringSafeArea(.bottom)
        .navigationBarHidden(true)
        .sheet(isPresented: $viewModel.showXunfeiSettings) {
            XunfeiSettingsView()
        }
        .onAppear {
            appendDebug("View appeared")
        }
        .task {
            await startShellIfNeeded()
        }
    }

    @ViewBuilder
    private var debugOverlay: some View {
        if !debugMessages.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(debugMessages.suffix(6), id: \.self) { message in
                    Text(message)
                        .font(.caption2)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
            }
            .padding(8)
            .background(Color.black.opacity(0.6))
            .cornerRadius(6)
            .padding([.top, .leading], 8)
        }
    }
    
    private func startShellIfNeeded() async {
        guard !shellStarted else { return }
        shellStarted = true
        
        await transport.registerOutputHandler { [weak terminalOutput] data in
            terminalOutput?.append(data)
            Task { @MainActor in
                appendDebug("Output received")
            }
        }
        
        await transport.registerDebugHandler { message in
            Task { @MainActor in
                appendDebug("SSH: \(message)")
            }
        }
        
        do {
            appendDebug("Starting shell: \(sessionName)")
            print("[Terminal] Starting shell for session: \(sessionName)")
            try await transport.startShell(sessionName: sessionName)
            appendDebug("Shell started")
            print("[Terminal] Shell started successfully")
        } catch {
            appendDebug("Shell start failed: \(error)")
            print("[Terminal] Failed to start shell: \(error)")
        }
    }
    
    private func send(_ input: String) {
        Task {
            try? await transport.send(input: input, sessionName: sessionName)
        }
    }
    
    private func resize(_ cols: Int, _ rows: Int) {
        Task {
            print("[Terminal] Resize requested: \(cols)x\(rows)")
            try? await transport.resize(cols: cols, rows: rows, sessionName: sessionName)
        }
    }

    private func handleTerminalReady() {
        appendDebug("WebView ready")
        print("[Terminal] WebView terminal ready")
    }

    private func handleTerminalError(_ message: String) {
        appendDebug("JS error: \(message)")
        print("[Terminal] JS error: \(message)")
    }

    private func appendDebug(_ message: String) {
        let timestamp = Date().formatted(date: .omitted, time: .standard)
        debugMessages.append("\(timestamp) \(message)")
        if debugMessages.count > 20 {
            debugMessages.removeFirst(debugMessages.count - 20)
        }
    }
}
