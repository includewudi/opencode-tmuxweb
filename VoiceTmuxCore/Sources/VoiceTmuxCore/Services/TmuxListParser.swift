import Foundation

public struct TmuxListParser {
    
    // tmux list-sessions -F '#{session_name}: #{session_windows} windows'
    // Output: sessName: 3 windows
    public static func parseSessions(_ output: String) -> [TmuxSession] {
        output.split(separator: "\n").compactMap { line in
            let parts = line.split(separator: ":")
            guard parts.count >= 2 else { return nil }
            let name = String(parts[0]).trimmingCharacters(in: .whitespaces)
            // " 3 windows" -> "3"
            let countPart = parts[1].trimmingCharacters(in: .whitespaces).split(separator: " ").first
            let count = Int(String(countPart ?? "0")) ?? 0
            return TmuxSession(id: name, name: name, windowCount: count)
        }
    }
    
    // tmux list-windows -a -F '#{session_name}:#{window_index}: #{window_name} (session #{session_name})'
    // Simplified format usage based on spec:
    // '#{session_name}:#{window_index}: #{window_name}' (ignoring suffix for now to parse easier)
    // Actually spec says: '#{session_name}:#{window_index}: #{window_name} (session #{session_name})'
    // We strictly follow the format we inject.
    // Spec injects: /opt/homebrew/bin/tmux list-windows -a -F '#{session_name}:#{window_index}: #{window_name}'
    // Wait, spec 5.1 says:
    // /opt/homebrew/bin/tmux list-windows -a -F '#{session_name}:#{window_index}: #{window_name} (session #{session_name})'
    // Let's implement parser for that.
    public static func parseWindows(_ output: String) -> [TmuxWindow] {
        output.split(separator: "\n").compactMap { line in
            // format: session:index: name (session x)
            // split by first two colons
            let components = line.split(separator: ":", maxSplits: 2)
            guard components.count == 3 else { return nil }
            
            let sessionName = String(components[0])
            let windowIndex = Int(String(components[1])) ?? 0
            
            // " #{window_name} (session #{session_name})"
            let remaining = String(components[2]).trimmingCharacters(in: .whitespaces)
            // remove " (session ...)" suffix if present? Or just treat as name. 
            // The spec format is a bit redundant but let's just take the whole name part or strip suffix.
            // Let's strip the "(session <sessionName>)" part if it helps cleanliness.
            
            let name: String
            if let range = remaining.range(of: " (session " + sessionName + ")", options: .backwards) {
                 name = String(remaining[..<range.lowerBound])
            } else {
                name = remaining
            }
            
            // ID can be session:index
            let id = "\(sessionName):\(windowIndex)"
            
            return TmuxWindow(id: id, index: windowIndex, name: name, sessionId: sessionName)
        }
    }
    
    // tmux list-panes -a -F '#{pane_id} (window #{session_name}:#{window_index})'
    // Output: %0 (window mySess:1)
    public static func parsePanes(_ output: String) -> [TmuxPane] {
        output.split(separator: "\n").compactMap { line in
            // "%0 (window sess:0)"
            let parts = line.split(separator: " (window ")
            guard parts.count == 2 else { return nil }
            
            let paneId = String(parts[0])
            let windowRef = String(parts[1].dropLast()) // remove closing )
            
            // windowRef = "sess:0"
            // we can split to get session and window index if needed, but here we just need windowId
            // which we defined as "sess:index" in parseWindows
            
            // Also extract session ID for helper
            let sessionParts = windowRef.split(separator: ":", maxSplits: 1)
            let sessionId = sessionParts.count > 0 ? String(sessionParts[0]) : nil
            
            return TmuxPane(id: paneId, windowId: windowRef, sessionId: sessionId)
        }
    }
}
