import SwiftUI
import VoiceTmuxCore

struct TreeView: View {
    @ObservedObject var viewModel: AppViewModel
    
    var body: some View {
        NavigationStack {
            Group {
                if let tree = viewModel.tree {
                    List {
                        ForEach(tree.sessions) { sessionNode in
                            DisclosureGroup {
                                ForEach(sessionNode.windows) { windowNode in
                                    DisclosureGroup {
                                        ForEach(windowNode.panes) { paneNode in
                                            NavigationLink(value: paneNode.pane) {
                                                HStack {
                                                    Image(systemName: "square.split.2x1")
                                                    Text("Pane \(paneNode.pane.id)")
                                                }
                                            }
                                        }
                                    } label: {
                                        Text("\(windowNode.window.index): \(windowNode.window.name)")
                                            .font(.headline)
                                    }
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "rectangle.on.rectangle")
                                    Text("Session: \(sessionNode.session.name)")
                                        .font(.headline)
                                }
                            }
                        }
                    }
                    .refreshable {
                        await viewModel.refreshTree()
                    }
                } else {
                    ContentUnavailableView("No Sessions", systemImage: "terminal", description: Text("Pull to refresh or check connection."))
                }
            }
            .navigationTitle("Tmux Sessions")
            .navigationDestination(for: TmuxPane.self) { pane in
                if let transport = viewModel.transport {
                    InteractiveTerminalView(transport: transport)
                        .navigationTitle("Shell")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar(.hidden, for: .tabBar) // Hide tab bar when pushed
                } else {
                    ContentUnavailableView("Disconnected", systemImage: "network.slash")
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(role: .destructive) {
                        Task { await viewModel.disconnect() }
                    } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        viewModel.showXunfeiSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    Button {
                        Task { await viewModel.refreshTree() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showXunfeiSettings) {
                XunfeiSettingsView()
            }
        }
    }
}
