import Foundation

public actor TmuxSyncService {
    private let transport: SSHTransport
    
    public init(transport: SSHTransport) {
        self.transport = transport
    }
    
    public func sync() async throws -> TmuxTree {
        // Execute commands in sequence (or parallel, but sequence is safer for now)
        // Check if connected first? SSHTransport.execute checks connection.
        
        async let sessionOutput = transport.execute(command: TmuxCommandBuilder.listSessions())
        async let windowOutput = transport.execute(command: TmuxCommandBuilder.listWindows())
        async let paneOutput = transport.execute(command: TmuxCommandBuilder.listPanes())
        
        let sessions = TmuxListParser.parseSessions(try await sessionOutput)
        let windows = TmuxListParser.parseWindows(try await windowOutput)
        let panes = TmuxListParser.parsePanes(try await paneOutput)
        
        return buildTree(sessions: sessions, windows: windows, panes: panes)
    }
    
    private func buildTree(sessions: [TmuxSession], windows: [TmuxWindow], panes: [TmuxPane]) -> TmuxTree {
        // Organize panes by windowId
        let panesByWindow = Dictionary(grouping: panes) { $0.windowId }
        
        // Organize windows by sessionId
        let windowsBySession = Dictionary(grouping: windows) { $0.sessionId }
        
        // Build SessionNodes
        let sessionNodes = sessions.map { session -> TmuxTree.SessionNode in
            let sessionWindows = windowsBySession[session.id] ?? []
            
            // Build WindowNodes
            let windowNodes = sessionWindows.sorted(by: { $0.index < $1.index }).map { window -> TmuxTree.WindowNode in
                // Find panes for this window. Window ID might be "sess:idx"
                // Our window parser sets ID to "sess:idx"
                // Panes windowRef is also "sess:idx"
                let windowPanes = panesByWindow[window.id] ?? []
                let paneNodes = windowPanes.map { TmuxTree.PaneNode(pane: $0) }
                
                return TmuxTree.WindowNode(window: window, panes: paneNodes)
            }
            
            return TmuxTree.SessionNode(session: session, windows: windowNodes)
        }
        
        return TmuxTree(sessions: sessionNodes)
    }
}
