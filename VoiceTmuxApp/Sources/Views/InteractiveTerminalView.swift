struct InteractiveTerminalView: View {
    @ObservedObject var viewModel: AppViewModel
    
    var transport: SSHTransport { viewModel.transport }
    
    @Environment(\.dismiss) var dismiss
    
    // Panel State
    @State private var activePanelTab: TerminalInputPanel.PanelTab = .keys
    
    // Host Info (Mock or passed down)
    // Ideally we get this from the ViewModel or Transport wrapper
    // For now we'll rely on the parent logic or just generic text
    private let hostAlias: String = "SSH Session" 
    
    var body: some View {
        VStack(spacing: 0) {
            // 1. Control Bar
            TerminalControlBar(
                hostAlias: viewModel.currentHost?.alias ?? "Terminal",
                status: viewModel.connectionState,
                onDisconnect: {
                    Task { await viewModel.disconnect() }
                    dismiss()
                },
                onSettings: {
                   // Show settings sheet logic
                }
            )
            
            // 2. Terminal View (Main Content)
            XTermSSHView(transport: transport)
            
            // 3. Input Panel (Bottom Sheet)
            if activePanelTab != .closed {
                TerminalInputPanel(
                    onInput: send,
                    activeTab: $activePanelTab
                )
                .transition(.move(edge: .bottom))
            } else {
                // Minimized Bar to reopen?
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
        .edgesIgnoringSafeArea(.bottom) // Keyboard handling might need Tweaks
        .navigationBarHidden(true) // We use our own ControlBar
    }
    
    private func send(_ input: String) {
        Task {
            try? await transport.send(input: input)
        }
    }
}
