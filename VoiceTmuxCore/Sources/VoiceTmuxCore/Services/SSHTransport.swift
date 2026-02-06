import Citadel
import Foundation
import NIOCore
import NIOSSH
import Crypto
import _CryptoExtras

public enum SSHTransportError: Error {
    case notConnected
    case connectionFailed(String)
    case commandFailed(Int, String)
    case inactive
    case shellNotSupported
}

public actor SSHTransport {
    private var client: SSHClient?
    public private(set) var isConnected: Bool = false
    
    private var outputHandler: (@Sendable (String) -> Void)?
    private var debugHandler: (@Sendable (String) -> Void)?
    private var shellTask: Task<Void, Error>?
    private var pollingTask: Task<Void, Never>?
    private var currentSessionName: String?
    private var lastCapturedContent: String = ""
    private var hasLoggedFirstCapture: Bool = false
    
    #if os(macOS)
    private var stdinWriter: TTYStdinWriter?
    #endif
    
    public func registerOutputHandler(_ handler: @escaping @Sendable (String) -> Void) {
        self.outputHandler = handler
    }

    public func registerDebugHandler(_ handler: @escaping @Sendable (String) -> Void) {
        self.debugHandler = handler
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
                let tempKey = try _RSA.Signing.PrivateKey(pemRepresentation: key)
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
        try await startShell(sessionName: nil, cols: cols, rows: rows)
    }
    
    public func startShell(sessionName: String?, cols: Int = 80, rows: Int = 24) async throws {
        guard let client = client, isConnected else {
            throw SSHTransportError.notConnected
        }
        
        shellTask?.cancel()
        pollingTask?.cancel()
        currentSessionName = sessionName
        lastCapturedContent = ""
        hasLoggedFirstCapture = false
        
        #if os(macOS)
        if #available(macOS 15.0, *) {
            shellTask = Task {
                do {
                    let env = [SSHChannelRequestEvent.EnvironmentRequest(wantReply: false, name: "LANG", value: "en_US.UTF-8")]
                    try await client.withTTY(environment: env) { [weak self] inbound, outbound in
                        guard let self = self else { return }
                        await self.setStdinWriter(outbound)
                        try? await outbound.changeSize(cols: cols, rows: rows, pixelWidth: 0, pixelHeight: 0)
                        
                        if let session = sessionName {
                            let attachCmd = "tmux attach-session -t \(session)\n"
                            try await outbound.write(ByteBuffer(string: attachCmd))
                        }
                        
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
        guard let session = sessionName else {
            await handleOutput("[Terminal] No tmux session specified\r\n")
            return
        }
        
        await handleOutput("[Terminal] Connecting to tmux session: \(session)\r\n")
        await handleOutput("[Terminal] Mode: capture-pane polling (non-interactive)\r\n\r\n")
        await emitDebug("Polling task started")
        let tmuxPath = await resolveTmuxPath()
        await emitDebug("tmux path: \(tmuxPath ?? "not found")")
        
        pollingTask = Task { [weak self] in
            var pollInterval: UInt64 = 200_000_000
            
            while !Task.isCancelled {
                guard let self = self else { break }
                
                do {
                    let content = try await self.capturePane(session: session, tmuxPath: tmuxPath)
                    await self.logFirstCaptureIfNeeded(length: content.count)
                    let lastContent = await self.lastCapturedContent
                    if content != lastContent {
                        await self.emitDebug("Capture changed: \(content.count) chars")
                        await self.handleFullScreenUpdate(content)
                        await self.setLastCapturedContent(content)
                        pollInterval = 200_000_000
                    } else {
                        pollInterval = min(pollInterval + 50_000_000, 500_000_000)
                    }
                } catch {
                    let errorText = String(describing: error)
                    await self.emitDebug("Capture error: \(error)")
                    print("[Terminal] Capture error: \(error)")
                    if errorText.contains("creatingChannelAfterClosure") {
                        await self.emitDebug("Reconnecting SSH after channel closure")
                        await self.reconnectIfPossible()
                    }
                }
                
                try? await Task.sleep(nanoseconds: pollInterval)
            }
        }
        #endif
    }
    
    #if !os(macOS)
    private func capturePane(session: String, tmuxPath: String?) async throws -> String {
        guard let client = client, isConnected else {
            throw SSHTransportError.notConnected
        }
        let tmux = tmuxPath ?? "tmux"
        let cmd = "\(tmux) capture-pane -p -t \(session) -e"
        let buffer = try await client.executeCommand(cmd)
        return String(buffer: buffer)
    }
    
    private func handleFullScreenUpdate(_ content: String) {
        let clearScreen = "\u{1B}[2J\u{1B}[H"
        outputHandler?(clearScreen + content)
    }
    
    private func setLastCapturedContent(_ content: String) {
        lastCapturedContent = content
    }
    
    private func emitDebug(_ message: String) async {
        debugHandler?(message)
    }

    private func logFirstCaptureIfNeeded(length: Int) async {
        if !hasLoggedFirstCapture {
            hasLoggedFirstCapture = true
            await emitDebug("First capture length: \(length)")
        }
    }

    private func resolveTmuxPath() async -> String? {
        guard let client = client, isConnected else { return nil }
        let candidates = ["tmux", "/usr/local/bin/tmux", "/opt/homebrew/bin/tmux", "/usr/bin/tmux"]
        for candidate in candidates {
            let cmd = "command -v \(candidate)"
            if let output = try? await client.executeCommand(cmd), !String(buffer: output).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return candidate
            }
        }
        return nil
    }

    private func reconnectIfPossible() async {
        guard isConnected else { return }
        try? await client?.close()
        client = nil
        isConnected = false
    }
    #endif
    
    public func send(input: String) async throws {
        try await send(input: input, sessionName: currentSessionName)
    }
    
    public func send(input: String, sessionName: String?) async throws {
        #if os(macOS)
        if #available(macOS 15.0, *) {
            guard let writer = stdinWriter else { return }
            let buffer = ByteBuffer(string: input)
            try await writer.write(buffer)
        }
        #else
        guard let session = sessionName, isConnected else { return }
        let escaped = escapeForTmuxSendKeys(input)
        let tmux = await resolveTmuxPath() ?? "tmux"
        let cmd = "\(tmux) send-keys -t \(session) \(escaped)"
        _ = try? await execute(command: cmd)
        #endif
    }
    
    #if !os(macOS)
    private func escapeForTmuxSendKeys(_ input: String) -> String {
        var result = ""
        for char in input {
            switch char {
            case "\n", "\r":
                result += " Enter"
            case "\t":
                result += " Tab"
            case "\u{1B}":
                result += " Escape"
            case " ":
                result += " Space"
            case "\u{7F}":
                result += " BSpace"
            case "\u{03}":
                result += " C-c"
            case "'":
                result += " \"'\""
            case "\"":
                result += " '\"'"
            case "\\":
                result += " '\\\\'"
            case "$":
                result += " '\\$'"
            case "`":
                result += " '\\`'"
            default:
                result += " '\(char)'"
            }
        }
        return result.isEmpty ? "" : result
    }
    #endif
    
    public func resize(cols: Int, rows: Int, sessionName: String? = nil) async {
        #if os(macOS)
        if #available(macOS 15.0, *) {
            try? await stdinWriter?.changeSize(cols: cols, rows: rows, pixelWidth: 0, pixelHeight: 0)
        }
        #else
        let session = sessionName ?? currentSessionName
        guard let session = session, isConnected else { return }
        let tmux = await resolveTmuxPath() ?? "tmux"
        let cmd = "\(tmux) resize-pane -t \(session) -x \(cols) -y \(rows)"
        _ = try? await execute(command: cmd)
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
            let buffer = try await client.executeCommand(command)
            return String(buffer: buffer)
        } catch {
            throw SSHTransportError.commandFailed(-1, error.localizedDescription)
        }
    }
    
    public func disconnect() async {
        shellTask?.cancel()
        shellTask = nil
        pollingTask?.cancel()
        pollingTask = nil
        currentSessionName = nil
        lastCapturedContent = ""
        #if os(macOS)
        stdinWriter = nil
        #endif
        try? await client?.close()
        client = nil
        isConnected = false
    }
}
