import Foundation
import Security
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
    
    // MARK: - SSH Credentials
    
    public func saveCredentials(for hostId: UUID, _ creds: SSHCredentials, usePrivateKey: Bool) throws {
        let prefix = hostId.uuidString
        // We don't save host/port/username in keychain anymore (HostStore handles that)
        // We only save the secrets (password or private key)
        
        try save(usePrivateKey ? "true".data(using: .utf8)! : "false".data(using: .utf8)!, account: "\(prefix).usePrivateKey")
        
        switch creds.authMethod {
        case .password(let password):
            try save(password.data(using: .utf8)!, account: "\(prefix).password")
        case .privateKey(let key, _):
            try save(key.data(using: .utf8)!, account: "\(prefix).privateKey")
        }
    }
    
    public func loadCredentials(for host: HostModel) throws -> SSHCredentials {
        let prefix = host.id.uuidString
        let usePrivateKeyData = try load(account: "\(prefix).usePrivateKey")
        
        guard let usePrivateKeyStr = String(data: usePrivateKeyData, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        
        let usePrivateKey = usePrivateKeyStr == "true"
        
        if usePrivateKey {
            let keyData = try load(account: "\(prefix).privateKey")
            guard let key = String(data: keyData, encoding: .utf8) else { throw KeychainError.invalidData }
            return SSHCredentials(host: host.hostname, port: host.port, username: host.username, authMethod: .privateKey(key: key, passphrase: nil))
        } else {
            let passwordData = try load(account: "\(prefix).password")
            guard let password = String(data: passwordData, encoding: .utf8) else { throw KeychainError.invalidData }
            return SSHCredentials(host: host.hostname, port: host.port, username: host.username, authMethod: .password(password))
        }
    }
    
    public func deleteCredentials(for hostId: UUID) {
        let prefix = hostId.uuidString
        delete(account: "\(prefix).password")
        delete(account: "\(prefix).privateKey")
        delete(account: "\(prefix).usePrivateKey")
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
