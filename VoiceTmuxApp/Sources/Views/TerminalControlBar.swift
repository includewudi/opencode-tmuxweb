import SwiftUI
import VoiceTmuxCore

struct TerminalControlBar: View {
    let hostAlias: String
    let status: ConnectionState
    var onDisconnect: () -> Void
    var onSettings: () -> Void
    
    var body: some View {
        HStack {
            Button(action: onDisconnect) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 32, height: 32)
                    .background(Color(UIColor.systemGray6).opacity(0.3))
                    .cornerRadius(8)
            }
            .foregroundStyle(.white)
            
            Spacer()
            
            HStack(spacing: 8) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                
                Text(hostAlias)
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(Color(UIColor.systemGray6).opacity(0.3))
            )
            
            Spacer()
            
            Button(action: onSettings) {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 32, height: 32)
                    .background(Color(UIColor.systemGray6).opacity(0.3))
                    .cornerRadius(8)
            }
            .foregroundStyle(.white)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.black)
    }
    
    private var statusColor: Color {
        switch status {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .red
        case .failed: return .red
        }
    }
}
