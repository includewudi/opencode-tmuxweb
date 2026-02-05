import Citadel
import Foundation
import NIOCore
import NIOSSH
import Crypto
import _CryptoExtras

public enum SSHTransportError: Error {
    case notConnected
    case connectionFailed(String)
    case commandFailed(Int, String) // exit code, stderr
    case inactive
}

public actor SSHTransport {
    private var client: SSHClient?
    public private(set) var isConnected: Bool = false
    
    public init() {}
    
    public func connect(credentials: SSHCredentials) async throws {
        if isConnected {
            await disconnect()
        }
        
        let authMethod: SSHAuthenticationMethod
        switch credentials.authMethod {
        case .password(let password):
            authMethod = .passwordBased(username: credentials.username, password: password)
        case .privateKey(let key, _):
            do {
                // Parse PEM using _CryptoExtras
                let tempKey = try _RSA.Signing.PrivateKey(pemRepresentation: key)
                
                // Workaround for Citadel 0.12.0 requiring Insecure.RSA.PrivateKey from Crypto, 
                // but appropriate initializers being missing or mismatched with _CryptoExtras _RSA type.
                // Assuming struct layout is compatible (backing pointer to BoringSSL key).
                let connectionKey = unsafeBitCast(tempKey, to: Insecure.RSA.PrivateKey.self)
                
                authMethod = .rsa(username: credentials.username, privateKey: connectionKey)
            } catch {
                throw SSHTransportError.connectionFailed("Invalid Private Key: \(error.localizedDescription)")
            }
        }
        
        do {
            self.client = try await SSHClient.connect(
                host: credentials.host,
                port: credentials.port,
                authenticationMethod: authMethod,
                hostKeyValidator: .acceptAnything(),
                reconnect: .never
            )
            self.isConnected = true
        } catch {
            throw SSHTransportError.connectionFailed(error.localizedDescription)
        }
    }
    
    public func execute(command: String) async throws -> String {
        guard let client = client, isConnected else {
            throw SSHTransportError.notConnected
        }
        
        do {
            // Citadel 0.12.0 executeCommand returns ByteBuffer directly
            let buffer = try await client.executeCommand(command)
            return String(buffer: buffer)
        } catch {
            throw SSHTransportError.commandFailed(-1, error.localizedDescription)
        }
    }
    
    public func disconnect() async {
        try? await client?.close()
        client = nil
        isConnected = false
    }
}
