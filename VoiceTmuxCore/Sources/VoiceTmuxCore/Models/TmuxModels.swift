import Foundation

public struct TmuxSession: Sendable, Identifiable, Hashable {
    public let id: String
    public let name: String
    public let windowCount: Int
    
    public init(id: String, name: String, windowCount: Int) {
        self.id = id
        self.name = name
        self.windowCount = windowCount
    }
}

public struct TmuxWindow: Sendable, Identifiable, Hashable {
    public let id: String // e.g. "@1", but practically often "${session}:${index}" or global ID
    public let index: Int
    public let name: String
    public let sessionId: String
    
    public init(id: String, index: Int, name: String, sessionId: String) {
        self.id = id
        self.index = index
        self.name = name
        self.sessionId = sessionId
    }
}

public struct TmuxPane: Sendable, Identifiable, Hashable {
    public let id: String // %0
    public let windowId: String
    public let sessionId: String? // Helper for easier tree building if needed
    
    public init(id: String, windowId: String, sessionId: String? = nil) {
        self.id = id
        self.windowId = windowId
        self.sessionId = sessionId
    }
}

public struct TmuxTree: Sendable {
    public struct SessionNode: Identifiable, Sendable {
        public let session: TmuxSession
        public var windows: [WindowNode]
        public var id: String { session.id }
    }
    
    public struct WindowNode: Identifiable, Sendable {
        public let window: TmuxWindow
        public var panes: [PaneNode]
        public var id: String { window.id }
    }
    
    public struct PaneNode: Identifiable, Sendable {
        public let pane: TmuxPane
        public var id: String { pane.id }
    }
    
    public var sessions: [SessionNode]
    
    public init(sessions: [SessionNode] = []) {
        self.sessions = sessions
    }
}
