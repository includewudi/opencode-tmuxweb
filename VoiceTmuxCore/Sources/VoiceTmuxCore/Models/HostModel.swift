import Foundation

public struct HostModel: Codable, Identifiable, Hashable {
    public var id: UUID
    public var alias: String
    public var hostname: String
    public var port: Int
    public var username: String
    
    public init(id: UUID = UUID(), alias: String, hostname: String, port: Int, username: String) {
        self.id = id
        self.alias = alias
        self.hostname = hostname
        self.port = port
        self.username = username
    }
}
