import Foundation
import Security

public enum KeychainError: Error {
    case duplicateEntry
    case unknown(OSStatus)
    case itemNotFound
    case invalidData
}

public class KeychainService {
    public static let shared = KeychainService()
    private let service = "com.voiceai.VoiceTmuxApp"
    
    private init() {}
    
    // MARK: - Generic Helpers
    
    private func save(_ data: Data, account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unknown(status)
        }
    }
    
    private func load(account: String) throws -> Data {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess else {
            if status == errSecItemNotFound { throw KeychainError.itemNotFound }
            throw KeychainError.unknown(status)
        }
        
        guard let data = dataTypeRef as? Data else {
            throw KeychainError.invalidData
        }
        
        return data
    }
    
    private func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
    
    // MARK: - SSH Credentials
    
    public func saveCredentials(_ creds: SSHCredentials, usePrivateKey: Bool) throws {
        try save(creds.host.data(using: .utf8)!, account: "host")
        try save(String(creds.port).data(using: .utf8)!, account: "port")
        try save(creds.username.data(using: .utf8)!, account: "username")
        try save(usePrivateKey ? "true".data(using: .utf8)! : "false".data(using: .utf8)!, account: "usePrivateKey")
        
        switch creds.authMethod {
        case .password(let password):
            try save(password.data(using: .utf8)!, account: "password")
        case .privateKey(let key, _):
            // Note: Passphrase not currently saved based on spec, or simplified
            try save(key.data(using: .utf8)!, account: "privateKey")
        }
    }
    
    public func loadCredentials() throws -> SSHCredentials {
        let hostData = try load(account: "host")
        let portData = try load(account: "port")
        let usernameData = try load(account: "username")
        let usePrivateKeyData = try load(account: "usePrivateKey")
        
        guard let host = String(data: hostData, encoding: .utf8),
              let portStr = String(data: portData, encoding: .utf8),
              let port = Int(portStr),
              let username = String(data: usernameData, encoding: .utf8),
              let usePrivateKeyStr = String(data: usePrivateKeyData, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        
        let usePrivateKey = usePrivateKeyStr == "true"
        
        if usePrivateKey {
            let keyData = try load(account: "privateKey")
            guard let key = String(data: keyData, encoding: .utf8) else { throw KeychainError.invalidData }
            return SSHCredentials(host: host, port: port, username: username, authMethod: .privateKey(key: key, passphrase: nil))
        } else {
            let passwordData = try load(account: "password")
            guard let password = String(data: passwordData, encoding: .utf8) else { throw KeychainError.invalidData }
            return SSHCredentials(host: host, port: port, username: username, authMethod: .password(password))
        }
    }
    
    public func deleteCredentials() {
        delete(account: "host")
        delete(account: "port")
        delete(account: "username")
        delete(account: "password")
        delete(account: "privateKey")
        delete(account: "usePrivateKey")
    }
    
    // MARK: - Xunfei Config
    
    public func saveXunfeiConfig(appId: String, apiKey: String, apiSecret: String) throws {
        try save(appId.data(using: .utf8)!, account: "xunfeiAppId")
        try save(apiKey.data(using: .utf8)!, account: "xunfeiApiKey")
        try save(apiSecret.data(using: .utf8)!, account: "xunfeiApiSecret")
    }
    
    public func loadXunfeiConfig() throws -> (appId: String, apiKey: String, apiSecret: String) {
        let appIdData = try load(account: "xunfeiAppId")
        let apiKeyData = try load(account: "xunfeiApiKey")
        let apiSecretData = try load(account: "xunfeiApiSecret")
        
        guard let appId = String(data: appIdData, encoding: .utf8),
              let apiKey = String(data: apiKeyData, encoding: .utf8),
              let apiSecret = String(data: apiSecretData, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        
        return (appId, apiKey, apiSecret)
    }
}
