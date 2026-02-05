import Foundation

public enum SSHAuthMethod: Sendable {
    case password(String)
    case privateKey(key: String, passphrase: String?)
}

public struct SSHCredentials: Sendable {
    public let host: String
    public let port: Int
    public let username: String
    public let authMethod: SSHAuthMethod
    
    public init(host: String, port: Int, username: String, authMethod: SSHAuthMethod) {
        self.host = host
        self.port = port
        self.username = username
        self.authMethod = authMethod
    }
}
