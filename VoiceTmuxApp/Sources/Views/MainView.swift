import SwiftUI
import VoiceTmuxCore

struct MainView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var selectedPaneId: String?
    @State private var showConnectionSheet = false
    @State private var selectedHostForEdit: HostModel?
    @State private var expandedSessions: Set<String> = []
    @State private var expandedWindows: Set<String> = []

    var body: some View {
        NavigationSplitView {
            sidebar
                .navigationDestination(for: PaneDetailRoute.self) { route in
                    switch route {
                    case .terminal(let sessionName, _):
                        InteractiveTerminalView(viewModel: viewModel, sessionName: sessionName)
                    }
                }
        } detail: {
            detailPlaceholder
        }
        .sheet(isPresented: $showConnectionSheet) {
            ConnectionSettingsView(viewModel: viewModel, existingHost: nil)
        }
        .sheet(item: $selectedHostForEdit) { host in
            ConnectionSettingsView(viewModel: viewModel, existingHost: host)
        }
    }

    @ViewBuilder
    private var sidebar: some View {
        List {
            if viewModel.connectionState == .disconnected {
                hostListSection
            } else if viewModel.connectionState == .connecting {
                connectingSection
            } else if viewModel.connectionState == .connected {
                sessionTreeSection
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(navigationTitle)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                primaryToolbarButton
            }
            if viewModel.connectionState == .connected {
                ToolbarItem(placement: .automatic) {
                    connectedMenuButton
                }
            }
        }
        .refreshable {
            if viewModel.connectionState == .connected {
                await viewModel.refreshTree()
            }
        }
    }

    private var navigationTitle: String {
        if viewModel.connectionState == .connected, let host = viewModel.currentHost {
            return host.alias
        }
        return "Servers"
    }

    @ViewBuilder
    private var hostListSection: some View {
        if viewModel.hostStore.hosts.isEmpty {
            ContentUnavailableView("No Hosts", systemImage: "server.rack", description: Text("Add a new SSH server to get started."))
        } else {
            ForEach(viewModel.hostStore.hosts) { host in
                Button {
                    Task { await viewModel.connect(host: host) }
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

    @ViewBuilder
    private var connectingSection: some View {
        HStack {
            ProgressView()
            Text("Connecting...")
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var sessionTreeSection: some View {
        if let tree = viewModel.tree {
            if tree.sessions.isEmpty {
                ContentUnavailableView("No Sessions", systemImage: "terminal", description: Text("No tmux sessions found."))
            } else {
                ForEach(tree.sessions) { session in
                    sessionRow(session)
                }
            }
        } else {
            ContentUnavailableView("Loading...", systemImage: "arrow.clockwise", description: Text("Fetching tmux sessions..."))
        }
    }

    @ViewBuilder
    private func sessionRow(_ session: TmuxTree.SessionNode) -> some View {
        let isExpanded = expandedSessions.contains(session.session.name)

        Section {
            Button {
                withAnimation {
                    if isExpanded {
                        expandedSessions.remove(session.session.name)
                    } else {
                        expandedSessions.insert(session.session.name)
                    }
                }
            } label: {
                HStack {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 20)
                    Image(systemName: "rectangle.on.rectangle")
                        .foregroundStyle(.blue)
                    Text(session.session.name)
                        .foregroundStyle(.primary)
                    Spacer()
                    Text("\(session.windows.count) windows")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                ForEach(session.windows) { window in
                    windowRow(window, sessionName: session.session.name)
                        .padding(.leading, 12)
                }
            }
        }
    }

    @ViewBuilder
    private func windowRow(_ window: TmuxTree.WindowNode, sessionName: String) -> some View {
        let isExpanded = expandedWindows.contains(window.window.name)

        Button {
            withAnimation {
                if isExpanded {
                    expandedWindows.remove(window.window.name)
                } else {
                    expandedWindows.insert(window.window.name)
                }
            }
        } label: {
            HStack {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)
                Image(systemName: "macwindow")
                    .foregroundStyle(.orange)
                Text("\(window.window.index): \(window.window.name)")
                    .foregroundStyle(.primary)
                Spacer()
                Text("\(window.panes.count) panes")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)

        if isExpanded {
            ForEach(window.panes) { paneNode in
                NavigationLink(value: PaneDetailRoute.terminal(sessionName: sessionName, paneId: paneNode.pane.id)) {
                    HStack {
                        Image(systemName: selectedPaneId == paneNode.pane.id ? "square.fill" : "square")
                            .foregroundStyle(.green)
                        Text("Pane \(paneNode.pane.id)")
                    }
                }
                .simultaneousGesture(TapGesture().onEnded {
                    selectedPaneId = paneNode.pane.id
                })
                .padding(.leading, 24)
            }
        }
    }

    @ViewBuilder
    private var primaryToolbarButton: some View {
        if viewModel.connectionState == .connected {
            Menu {
                Button(role: .destructive) {
                    Task { await viewModel.disconnect() }
                } label: {
                    Label("Disconnect", systemImage: "xmark.circle")
                }
            } label: {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
        } else {
            Button {
                showConnectionSheet = true
            } label: {
                Image(systemName: "plus.circle")
            }
        }
    }

    @ViewBuilder
    private var connectedMenuButton: some View {
        Menu {
            Button {
                Task { await viewModel.refreshTree() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
    }

    @ViewBuilder
    private var detailPlaceholder: some View {
        ContentUnavailableView(
            "Select a Pane",
            systemImage: "sidebar.left",
            description: Text("Choose a pane from the sidebar to view its content")
        )
    }
}
