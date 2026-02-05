import SwiftUI

struct TerminalInputPanel: View {
    var onInput: (String) -> Void
    
    @Binding var activeTab: PanelTab
    
    enum PanelTab: Int {
        case keys = 0
        case history = 1
        case closed = 2 // or hidden
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab Bar
            HStack(spacing: 0) {
                TabButton(title: "Keys", icon: "keyboard", isSelected: activeTab == .keys) {
                    activeTab = .keys
                }
                TabButton(title: "History", icon: "clock", isSelected: activeTab == .history) {
                    activeTab = .history
                }
                Spacer()
                Button(action: { activeTab = .closed }) {
                    Image(systemName: "keyboard.chevron.compact.down")
                        .padding()
                        .foregroundStyle(.gray)
                }
            }
            .background(Color(UIColor.systemGray6))
            
            // Content
            Group {
                if activeTab == .keys {
                    VirtualKeypadView(onKeyPress: onInput)
                } else if activeTab == .history {
                    CommandHistoryView(onCommandSelect: onInput)
                }
            }
            .frame(height: 250) // Adjust height as needed
            .background(Color(UIColor.systemBackground))
        }
    }
}

struct TabButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                Text(title).font(.caption)
            }
            .foregroundStyle(isSelected ? .green : .gray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
    }
}
