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
    case shellNotSupported
}

public actor SSHTransport {
    private var client: SSHClient?
    public private(set) var isConnected: Bool = false
    
    // Shell stream handling (iOS uses executeCommandStream, macOS uses withTTY)
    private var outputHandler: (@Sendable (String) -> Void)?
    private var shellTask: Task<Void, Error>?
    
    // For macOS TTY support
    #if os(macOS)
    private var stdinWriter: TTYStdinWriter?
    #endif
    
    public func registerOutputHandler(_ handler: @escaping @Sendable (String) -> Void) {
        self.outputHandler = handler
    }

    
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
    
    public func startShell(cols: Int = 80, rows: Int = 24) async throws {
        guard let client = client, isConnected else {
            throw SSHTransportError.notConnected
        }
        
        shellTask?.cancel()
        
        #if os(macOS)
        if #available(macOS 15.0, *) {
            shellTask = Task {
                do {
                    try await client.withTTY(environment: []) { [weak self] inbound, outbound in
                        guard let self = self else { return }
                        await self.setStdinWriter(outbound)
                        try? await outbound.changeSize(cols: cols, rows: rows, pixelWidth: 0, pixelHeight: 0)
                        
                        for try await chunk in inbound {
                            switch chunk {
                            case .stdout(let buffer):
                                await self.handleOutput(String(buffer: buffer))
                            case .stderr(let buffer):
                                await self.handleOutput(String(buffer: buffer))
                            }
                        }
                    }
                } catch {
                    print("Shell error: \(error)")
                }
            }
        } else {
            throw SSHTransportError.shellNotSupported
        }
        #else
        shellTask = Task {
            do {
                let stream = try await client.executeCommandStream("$SHELL -l", inShell: true)
                for try await chunk in stream {
                    switch chunk {
                    case .stdout(let buffer):
                        await self.handleOutput(String(buffer: buffer))
                    case .stderr(let buffer):
                        await self.handleOutput(String(buffer: buffer))
                    }
                }
            } catch {
                print("Shell error: \(error)")
            }
        }
        #endif
    }
    
    public func send(input: String) async throws {
        #if os(macOS)
        if #available(macOS 15.0, *) {
            guard let writer = stdinWriter else { return }
            let buffer = ByteBuffer(string: input)
            try await writer.write(buffer)
        }
        #else
        _ = input
        #endif
    }
    
    public func resize(cols: Int, rows: Int) async {
        #if os(macOS)
        if #available(macOS 15.0, *) {
            try? await stdinWriter?.changeSize(cols: cols, rows: rows, pixelWidth: 0, pixelHeight: 0)
        }
        #else
        _ = (cols, rows)
        #endif
    }
    
    #if os(macOS)
    @available(macOS 15.0, *)
    private func setStdinWriter(_ writer: TTYStdinWriter) {
        self.stdinWriter = writer
    }
    #endif
    
    private func handleOutput(_ output: String) {
        outputHandler?(output)
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
        shellTask?.cancel()
        shellTask = nil
        #if os(macOS)
        stdinWriter = nil
        #endif
        try? await client?.close()
        client = nil
        isConnected = false
    }
}
