import SwiftUI
import VoiceTmuxCore

struct HostListView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var showSettings = false
    @State private var selectedHostForEdit: HostModel?
    
    var body: some View {
        NavigationStack {
            List {
                if viewModel.hostStore.hosts.isEmpty {
                    ContentUnavailableView("No Hosts", systemImage: "server.rack", description: Text("Add a new SSH server to get started."))
                } else {
                    ForEach(viewModel.hostStore.hosts) { host in
                        Button {
                            Task {
                                await viewModel.connect(host: host)
                            }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(host.alias)
                                        .font(.headline)
                                    Text("\(host.username)@\(host.hostname):\(host.port)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if viewModel.currentHost?.id == host.id && viewModel.connectionState == .connected {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                } else if viewModel.currentHost?.id == host.id && viewModel.connectionState == .connecting {
                                    ProgressView()
                                }
                            }
                        }
                        .foregroundStyle(.primary)
                        .contextMenu {
                            Button {
                                selectedHostForEdit = host
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            Button(role: .destructive) {
                                viewModel.deleteHost(host)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let host = viewModel.hostStore.hosts[index]
                            viewModel.deleteHost(host)
                        }
                    }
                }
            }
            .navigationTitle("Servers")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        selectedHostForEdit = nil
                        showSettings = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        viewModel.showXunfeiSettings = true
                    } label: {
                        Image(systemName: "mic.badge.gear")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                ConnectionSettingsView(viewModel: viewModel, existingHost: nil)
            }
            .sheet(item: $selectedHostForEdit) { host in
                ConnectionSettingsView(viewModel: viewModel, existingHost: host)
            }
            .sheet(isPresented: $viewModel.showXunfeiSettings) {
                XunfeiSettingsView()
            }
            // Navigate to main session view when connected
            .navigationDestination(isPresented: Binding(get: { viewModel.connectionState == .connected }, set: { _ in })) {
                if let _ = viewModel.currentHost {
                    // Start with TreeExplorerView as the main dashboard
                    // But we might want a container that has both Tree and Terminal
                    TerminalContainerView(viewModel: viewModel)
                }
            }
        }
    }
}
