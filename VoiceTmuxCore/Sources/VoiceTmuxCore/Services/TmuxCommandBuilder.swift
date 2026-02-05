import Foundation

public struct TmuxCommandBuilder {
    private static let tmuxBin = "/opt/homebrew/bin/tmux"
    
    // MARK: - Sessions
    public static func listSessions() -> String {
        "\(tmuxBin) list-sessions -F '#{session_name}: #{session_windows} windows'"
    }
    
    public static func newSession(name: String) -> String {
        "\(tmuxBin) new-session -d -s '\(escape(name))'"
    }
    
    public static func killSession(target: String) -> String {
        "\(tmuxBin) kill-session -t '\(escape(target))'"
    }
    
    public static func renameSession(old: String, new: String) -> String {
        "\(tmuxBin) rename-session -t '\(escape(old))' '\(escape(new))'"
    }
    
    // MARK: - Windows
    public static func listWindows() -> String {
         "\(tmuxBin) list-windows -a -F '#{session_name}:#{window_index}: #{window_name} (session #{session_name})'"
    }
    
    public static func newWindow(targetSession: String, name: String?) -> String {
        var cmd = "\(tmuxBin) new-window -t '\(escape(targetSession))'"
        if let name = name, !name.isEmpty {
            cmd += " -n '\(escape(name))'"
        }
        return cmd
    }
    
    public static func killWindow(target: String) -> String {
        // target should be session:index
        "\(tmuxBin) kill-window -t '\(escape(target))'"
    }
    
    public static func renameWindow(target: String, newName: String) -> String {
        "\(tmuxBin) rename-window -t '\(escape(target))' '\(escape(newName))'"
    }
    
    // MARK: - Panes
    public static func listPanes() -> String {
        "\(tmuxBin) list-panes -a -F '#{pane_id} (window #{session_name}:#{window_index})'"
    }
    
    public static func splitWindow(target: String, vertical: Bool) -> String {
        // -h for horizontal split (side by side), -v for vertical (top/bottom)
        // Spec says: Split Horizontal -> -h, Split Vertical -> -v
        let flag = vertical ? "-v" : "-h"
        return "\(tmuxBin) split-window \(flag) -t '\(escape(target))'"
    }
    
    public static func killPane(target: String) -> String {
        "\(tmuxBin) kill-pane -t '\(escape(target))'"
    }
    
    public static func capturePane(target: String) -> String {
        "\(tmuxBin) capture-pane -t '\(escape(target))' -p"
    }
    
    public static func sendKeys(target: String, keys: String) -> String {
        // keys need escaping?
        // simple escaping for ' mainly
        // If keys contains special char, better rely on separated arguments if possible, or careful escaping.
        // For send-keys, we often send literal keys.
        // Spec 5.3 mentions escaping `\`, `"`, `$`, `` ` ``
        let escaped = keys
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "$", with: "\\$")
            .replacingOccurrences(of: "`", with: "\\`")
        
        return "\(tmuxBin) send-keys -t '\(escape(target))' \"\(escaped)\""
    }
    
    // MARK: - Utils
    private static func escape(_ input: String) -> String {
        // Basic escaping for single-quoted string in sh
        // replace ' with '\''
        return input.replacingOccurrences(of: "'", with: "'\\''")
    }
}
