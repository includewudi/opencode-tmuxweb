import SwiftUI

struct CommandHistoryView: View {
    var onCommandSelect: (String) -> Void
    
    // Mock data for now
    let history = [
        "ls -la",
        "tmux attach -t 0",
        "cd /var/www",
        "top",
        "docker ps",
        "git status",
        "npm install",
        "python3 app.py"
    ]
    
    var body: some View {
        List {
            ForEach(history, id: \.self) { cmd in
                Button(action: { onCommandSelect(cmd + "\r") }) {
                    HStack {
                        Image(systemName: "terminal")
                            .foregroundStyle(.gray)
                        Text(cmd)
                            .foregroundStyle(.primary)
                            .font(.system(.body, design: .monospaced))
                    }
                }
            }
        }
        .listStyle(.plain)
    }
}
