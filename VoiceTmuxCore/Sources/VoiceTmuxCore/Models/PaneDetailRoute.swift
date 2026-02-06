import Foundation

public enum PaneDetailRoute: Equatable, Hashable {
    case terminal(sessionName: String, paneId: String)
    
    public var sessionName: String? {
        switch self {
        case .terminal(let sessionName, _):
            return sessionName
        }
    }
    
    public var paneId: String? {
        switch self {
        case .terminal(_, let paneId):
            return paneId
        }
    }
}
