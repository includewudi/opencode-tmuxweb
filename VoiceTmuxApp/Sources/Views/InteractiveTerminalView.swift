import SwiftUI
import VoiceTmuxCore

struct InteractiveTerminalView: View {
    let transport: SSHTransport
    
    var body: some View {
        VStack(spacing: 0) {
            XTermSSHView(transport: transport)
            
            // Virtual Keyboard Toolbar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    KeyButton(label: "ESC", action: { send("\u{1B}") })
                    KeyButton(label: "TAB", action: { send("\t") })
                    KeyButton(label: "CTRL+C", action: { send("\u{03}") }) // ETX
                    
                    Divider()
                    
                    KeyButton(icon: "arrow.up", action: { send("\u{1B}[A") })
                    KeyButton(icon: "arrow.down", action: { send("\u{1B}[B") })
                    KeyButton(icon: "arrow.left", action: { send("\u{1B}[D") })
                    KeyButton(icon: "arrow.right", action: { send("\u{1B}[C") })
                    
                    Divider()
                    
                    KeyButton(label: "SPACE", action: { send(" ") })
                    KeyButton(label: "ENTER", action: { send("\r") })
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .background(Color(UIColor.systemGray6))
        }
    }
    
    private func send(_ input: String) {
        Task {
            try? await transport.send(input: input)
        }
    }
}

struct KeyButton: View {
    var label: String?
    var icon: String?
    var action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Group {
                if let icon = icon {
                    Image(systemName: icon)
                } else {
                    Text(label ?? "")
                        .font(.system(.caption, design: .monospaced))
                        .fontWeight(.bold)
                }
            }
            .frame(minWidth: 44, minHeight: 44)
            .background(Color(UIColor.systemGray5))
            .cornerRadius(8)
            .foregroundStyle(.primary)
        }
    }
}
