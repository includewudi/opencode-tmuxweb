import SwiftUI
import VoiceTmuxCore

public enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case failed(String)
}

@MainActor
public class AppViewModel: ObservableObject {
    // Services
    private let sshTransport = SSHTransport()
    private let keychainService = KeychainService.shared
    private lazy var tmuxSyncService = TmuxSyncService(transport: sshTransport)
    
    // State
    @Published public var connectionState: ConnectionState = .disconnected
    @Published public var tree: TmuxTree?
    @Published public var error: Error? // For alerts
    @Published public var showConnectionSheet: Bool = false
    
    // Setup
    public init() {
        // Auto-connect check can happen here or via onAppear
    }
    
    public func autoConnect() async {
        do {
            let creds = try keychainService.loadCredentials()
            await connect(credentials: creds)
        } catch {
            // No saved credentials or load failed, show sheet
            print("Auto-connect info: \(error)")
            showConnectionSheet = true
        }
    }
    
    public func connect(credentials: SSHCredentials, save: Bool = false) async {
        connectionState = .connecting
        print("Connecting to \(credentials.host)...")
        
        do {
            try await sshTransport.connect(credentials: credentials)
            connectionState = .connected
            showConnectionSheet = false
            if save {
                try? keychainService.saveCredentials(credentials, usePrivateKey: {
                    if case .privateKey = credentials.authMethod { return true }
                    return false
                }())
            }
            // Initial sync
            await refreshTree()
        } catch {
            print("Connection failed: \(error)")
            connectionState = .failed(error.localizedDescription)
            self.error = error // Trigger alert if needed
        }
    }
    
    public func disconnect() async {
        await sshTransport.disconnect()
        connectionState = .disconnected
        tree = nil
    }
    
    public func refreshTree() async {
        guard connectionState == .connected else { return }
        do {
            let newTree = try await tmuxSyncService.sync()
            self.tree = newTree
        } catch {
            print("Sync failed: \(error)")
            self.error = error
        }
    }
    
    // Helper to get transport for downstream views
    public var transport: SSHTransport { sshTransport }
}
