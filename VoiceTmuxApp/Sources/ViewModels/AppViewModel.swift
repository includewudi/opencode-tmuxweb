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
    public let hostStore = HostStore()
    private lazy var tmuxSyncService = TmuxSyncService(transport: sshTransport)
    
    // State
    @Published public var connectionState: ConnectionState = .disconnected
    @Published public var currentHost: HostModel?
    @Published public var tree: TmuxTree?
    @Published public var error: Error?
    @Published public var showConnectionSheet: Bool = false
    @Published public var showXunfeiSettings: Bool = false
    
    // Setup
    public init() {
        // No auto-connect on init anymore, user selects from list
    }
    
    public func connect(host: HostModel) async {
        connectionState = .connecting
        currentHost = host
        print("Connecting to \(host.hostname)...")
        
        do {
            // Load credentials from Keychain using host.id
            let creds = try keychainService.loadCredentials(for: host)
            
            try await sshTransport.connect(credentials: creds)
            connectionState = .connected
            showConnectionSheet = false
            
            // Initial sync
            await refreshTree()
        } catch {
            print("Connection failed: \(error)")
            connectionState = .failed(error.localizedDescription)
            self.error = error
        }
    }
    
    public func saveHost(_ host: HostModel, credentials: SSHCredentials, usePrivateKey: Bool) {
        // Save to HostStore
        if hostStore.hosts.contains(where: { $0.id == host.id }) {
            hostStore.update(host)
        } else {
            hostStore.add(host)
        }
        
        // Save secrets to Keychain
        try? keychainService.saveCredentials(for: host.id, credentials, usePrivateKey: usePrivateKey)
        
        // If this is the current connection, update it? No, explicit connect is better.
    }
    
    public func deleteHost(_ host: HostModel) {
        hostStore.delete(hostId: host.id)
        keychainService.deleteCredentials(for: host.id)
        if currentHost?.id == host.id {
            Task { await disconnect() }
        }
    }
    
    public func disconnect() async {
        await sshTransport.disconnect()
        connectionState = .disconnected
        tree = nil
        currentHost = nil
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
