import SwiftUI

struct VirtualKeypadView: View {
    var onKeyPress: (String) -> Void
    
    // Layout similar to the screenshot: Grid of keys
    private let keys: [[(label: String, cmd: String)]] = [
        [("Esc", "\u{1B}"), ("Tab", "\t"), ("Ctrl", ""), ("Alt", "")], // Ctrl/Alt might need state
        [("/", "/"), ("|", "|"), ("~", "~"), ("-", "-")],
        [("Home", "\u{1B}[H"), ("PgUp", "\u{1B}[5~"), ("PgDn", "\u{1B}[6~"), ("End", "\u{1B}[F")],
        [("=", "="), (":", ":"), (";", ";"), ("!", "!")],
        [("<", "<"), (">", ">"), ("(", "("), (")", ")")],
        [("{", "{"), ("}", "}"), ("[", "["), ("]", "]")],
        [("*", "*"), ("$", "$"), ("%", "%"), ("^", "^")],
        [("Paste", ""), ("Delete", "\u{7F}"), ("Ins", "\u{1B}[2~"), ("@", "@")]
    ]
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 8) {
                ForEach(0..<keys.count, id: \.self) { rowIndex in
                    HStack(spacing: 8) {
                        ForEach(0..<keys[rowIndex].count, id: \.self) { colIndex in
                            let key = keys[rowIndex][colIndex]
                            KeyButton(label: key.label) {
                                if key.label == "Paste" {
                                    if let string = UIPasteboard.general.string {
                                        onKeyPress(string)
                                    }
                                } else {
                                    onKeyPress(key.cmd)
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .background(Color(UIColor.secondarySystemBackground))
    }
}

struct KeyButton: View {
    var label: String
    var icon: String?
    var action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Group {
                if let icon = icon {
                    Image(systemName: icon)
                } else {
                    Text(label)
                        .font(.system(.caption, design: .monospaced))
                        .fontWeight(.bold)
                }
            }
            .frame(minWidth: 44, maxWidth: .infinity, minHeight: 44)
            .background(Color(UIColor.systemGray5))
            .cornerRadius(8)
            .foregroundStyle(.primary)
        }
    }
}
