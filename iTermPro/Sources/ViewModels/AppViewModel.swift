import SwiftUI
import TerminalCore

/// Connection state
enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
}

/// Main app view model — single source of truth
@MainActor
class AppViewModel: ObservableObject {
    // Connection
    @Published var connectionState: ConnectionState = .disconnected
    @Published var currentHost: HostModel?
    @Published var tree: TmuxTree?
    @Published var errorMessage: String?
    
    // Services
    let hostStore = HostStore()
    let settings = SettingsStore()
    let transport = SSHTransport()
    let aiService = AIService()
    
    // Terminal output callback
    var terminalOutputHandler: ((String) -> Void)?
    
    // MARK: - Connection
    
    func connect(host: HostModel) async {
        connectionState = .connecting
        currentHost = host
        errorMessage = nil
        
        let credentials = SSHCredentials(
            host: host.hostname,
            port: host.port,
            username: host.username,
            authMethod: host.authMethod
        )
        
        do {
            try await transport.connect(credentials: credentials)
            connectionState = .connected
            await refreshTree()
        } catch {
            connectionState = .disconnected
            currentHost = nil
            errorMessage = "连接失败: \(error.localizedDescription)"
        }
    }
    
    func disconnect() async {
        await transport.disconnect()
        connectionState = .disconnected
        currentHost = nil
        tree = nil
    }
    
    func refreshTree() async {
        guard connectionState == .connected else { return }
        do {
            let output = try await transport.execute(command: "tmux list-sessions -F '#{session_name}:#{session_windows}:#{session_attached}'")
            let newTree = TmuxListParser.parseTree(from: output)
            self.tree = newTree
        } catch {
            self.tree = nil
        }
    }
    
    // MARK: - Terminal
    
    func attachToSession(_ sessionName: String) async {
        do {
            await transport.registerOutputHandler { [weak self] output in
                DispatchQueue.main.async {
                    self?.terminalOutputHandler?(output)
                }
            }
            try await transport.startShell(sessionName: sessionName)
        } catch {
            errorMessage = "终端连接失败: \(error.localizedDescription)"
        }
    }
    
    func sendInput(_ input: String) async {
        try? await transport.send(input: input)
    }
    
    // MARK: - Host Management
    
    func deleteHost(_ host: HostModel) {
        hostStore.delete(host)
    }
    
    // MARK: - AI Command
    
    func generateAICommand(prompt: String, role: AIRole) async throws -> String {
        await aiService.updateProvider(settings.aiProvider)
        return try await aiService.generateCommand(prompt: prompt, role: role)
    }
}
