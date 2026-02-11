import SwiftUI
import TerminalCore

/// Session tree sidebar — replicates web version's sidebar
struct SessionTreeView: View {
    @ObservedObject var viewModel: AppViewModel
    @Binding var selectedPane: String?
    @Binding var showSettings: Bool
    
    @State private var showAddHost = false
    @State private var editingHost: HostModel?
    @State private var expandedSessions: Set<String> = []
    @State private var expandedWindows: Set<String> = []
    
    var body: some View {
        List {
            switch viewModel.connectionState {
            case .disconnected:
                hostListSection
            case .connecting:
                connectingSection
            case .connected:
                sessionTreeSection
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(navTitle)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if viewModel.connectionState == .connected {
                        Button { Task { await viewModel.refreshTree() } } label: {
                            Label("刷新", systemImage: "arrow.clockwise")
                        }
                        Button(role: .destructive) { Task { await viewModel.disconnect() } } label: {
                            Label("断开", systemImage: "xmark.circle")
                        }
                        Divider()
                    }
                    Button { showAddHost = true } label: {
                        Label("添加主机", systemImage: "plus.circle")
                    }
                    Button { showSettings = true } label: {
                        Label("设置", systemImage: "gear")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showAddHost) {
            HostEditView(viewModel: viewModel, host: nil)
        }
        .sheet(item: $editingHost) { host in
            HostEditView(viewModel: viewModel, host: host)
        }
        .refreshable {
            if viewModel.connectionState == .connected {
                await viewModel.refreshTree()
            }
        }
    }
    
    private var navTitle: String {
        if viewModel.connectionState == .connected, let host = viewModel.currentHost {
            return host.alias
        }
        return "SESSIONS"
    }
    
    // MARK: - Host List
    @ViewBuilder
    private var hostListSection: some View {
        if viewModel.hostStore.hosts.isEmpty {
            ContentUnavailableView(
                "没有主机",
                systemImage: "server.rack",
                description: Text("添加 SSH 服务器开始使用")
            )
        } else {
            Section("主机") {
                ForEach(viewModel.hostStore.hosts) { host in
                    Button { Task { await viewModel.connect(host: host) } } label: {
                        HStack {
                            Image(systemName: "desktopcomputer")
                                .foregroundStyle(.blue)
                            VStack(alignment: .leading) {
                                Text(host.alias).font(.headline)
                                Text("\(host.username)@\(host.hostname):\(host.port)")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .foregroundStyle(.primary)
                    .contextMenu {
                        Button { editingHost = host } label: {
                            Label("编辑", systemImage: "pencil")
                        }
                        Button(role: .destructive) { viewModel.deleteHost(host) } label: {
                            Label("删除", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Connecting
    private var connectingSection: some View {
        HStack {
            ProgressView()
            Text("连接中...")
                .foregroundStyle(.secondary)
        }
    }
    
    // MARK: - Session Tree
    @ViewBuilder
    private var sessionTreeSection: some View {
        if let tree = viewModel.tree {
            if tree.sessions.isEmpty {
                ContentUnavailableView("无 tmux 会话", systemImage: "terminal",
                                      description: Text("服务器上未找到 tmux 会话"))
            } else {
                ForEach(tree.sessions) { session in
                    Section {
                        sessionRow(session)
                    }
                }
            }
        } else {
            ProgressView("加载中...")
        }
    }
    
    @ViewBuilder
    private func sessionRow(_ session: TmuxTree.SessionNode) -> some View {
        let isExpanded = expandedSessions.contains(session.session.name)
        
        Button {
            withAnimation { toggleSet(&expandedSessions, session.session.name) }
        } label: {
            HStack {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption).foregroundStyle(.secondary).frame(width: 20)
                Text("#").font(.headline).foregroundStyle(.purple)
                Text(session.session.name).foregroundStyle(.primary)
                Spacer()
                Text("\(session.windows.count)")
                    .font(.caption.monospacedDigit())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(.blue.opacity(0.2)).clipShape(Capsule())
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
    
    @ViewBuilder
    private func windowRow(_ window: TmuxTree.WindowNode, sessionName: String) -> some View {
        let isExpanded = expandedWindows.contains(window.window.name)
        
        Button {
            withAnimation { toggleSet(&expandedWindows, window.window.name) }
        } label: {
            HStack {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption).foregroundStyle(.secondary).frame(width: 20)
                Image(systemName: "macwindow").foregroundStyle(.orange)
                Text("\(window.window.index): \(window.window.name)")
                    .foregroundStyle(.primary)
                Spacer()
                Text("\(window.panes.count)p")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
        
        if isExpanded {
            ForEach(window.panes) { pane in
                Button {
                    selectedPane = "\(sessionName):\(window.window.name).\(pane.pane.id)"
                } label: {
                    HStack {
                        Image(systemName: selectedPane?.contains(pane.pane.id) == true
                              ? "square.fill" : "square")
                            .foregroundStyle(.green)
                        Text("Pane \(pane.pane.id)")
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
                .padding(.leading, 24)
            }
        }
    }
    
    private func toggleSet<T: Hashable>(_ set: inout Set<T>, _ value: T) {
        if set.contains(value) { set.remove(value) } else { set.insert(value) }
    }
}
