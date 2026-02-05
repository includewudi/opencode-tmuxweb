import SwiftUI
import VoiceTmuxCore

struct CaptureView: View {
    @ObservedObject var viewModel: AppViewModel
    let pane: TmuxPane
    
    @State private var content: String = "Loading..."
    @State private var commandInput: String = ""
    @State private var isRefreshing: Bool = false
    
    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                Text(content)
                    .font(.monospaced(.body)())
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .textSelection(.enabled)
            }
            .background(Color(UIColor.systemBackground))
            
            Divider()
            
            VStack(spacing: 8) {
                // Quick keys
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        Button("Tab") { sendSpecialKey("Tab") }
                        Button("Up") { sendSpecialKey("Up") }
                        Button("Down") { sendSpecialKey("Down") }
                        Button("Ctrl-C") { sendSpecialKey("C-c") }
                    }
                    .buttonStyle(.bordered)
                    .padding(.horizontal)
                }
                .padding(.top, 8)
                
                HStack {
                    TextField("Command...", text: $commandInput)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit {
                            sendCommand()
                        }
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    Button {
                        sendCommand()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                    .disabled(commandInput.isEmpty)
                }
                .padding()
            }
            .background(Color(UIColor.secondarySystemBackground))
        }
        .navigationTitle("Pane \(pane.id)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await refresh() }
                } label: {
                    if isRefreshing {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
        .task {
            await refresh()
        }
        .overlay(alignment: .bottom) {
            VoiceControlView { text in
                // Inject text as command
                // Just type it, don't auto-enter? Spec says: "Text is sent directly to the PTY terminal as keystrokes."
                // For capture view which is line based command input, maybe we populate the input field or just send it?
                // Spec 7.5: "sessionHolder.sendKeys(recognizedText)".
                // For CaptureView, let's just send it.
                Task {
                    let cmd = TmuxCommandBuilder.sendKeys(target: pane.id, keys: text)
                    try? await viewModel.transport.execute(command: cmd)
                    await refresh()
                }
            }
            .padding()
            .padding(.bottom, 50) // Avoid conflict with keyboard or bottom bar if any
        }
    }
    
    private func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        
        do {
            let cmd = TmuxCommandBuilder.capturePane(target: pane.id)
            let output = try await viewModel.transport.execute(command: cmd)
            self.content = output
        } catch {
            self.content = "Error loading content: \(error.localizedDescription)"
        }
    }
    
    private func sendCommand() {
        guard !commandInput.isEmpty else { return }
        let text = commandInput
        commandInput = ""
        
        Task {
            // Send keys: input + Enter
            let cmd = TmuxCommandBuilder.sendKeys(target: pane.id, keys: text)
            let enter = TmuxCommandBuilder.sendKeys(target: pane.id, keys: "Enter")
            
            try? await viewModel.transport.execute(command: cmd)
            try? await viewModel.transport.execute(command: enter)
            
            // Wait slightly and refresh
            try? await Task.sleep(nanoseconds: 300_000_000)
            await refresh()
        }
    }
    
    private func sendSpecialKey(_ key: String) {
        Task {
            let cmd = TmuxCommandBuilder.sendKeys(target: pane.id, keys: key)
            try? await viewModel.transport.execute(command: cmd)
            try? await Task.sleep(nanoseconds: 300_000_000)
            await refresh()
        }
    }
}
