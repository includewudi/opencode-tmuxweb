import SwiftUI
import TerminalCore

/// Main app view — replicates web version layout
/// iPhone: sidebar drawer + terminal + toolbox (vertical split)
/// iPad: 3-column layout (sidebar | terminal | toolbox)
struct MainView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var selectedPane: String?
    @State private var showSettings = false
    @State private var showSidebar = true
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic
    
    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SessionTreeView(
                viewModel: viewModel,
                selectedPane: $selectedPane,
                showSettings: $showSettings
            )
        } detail: {
            if let pane = selectedPane {
                TerminalContainerView(
                    viewModel: viewModel,
                    paneTarget: pane
                )
            } else {
                emptyState
            }
        }
        .navigationSplitViewStyle(.balanced)
        .sheet(isPresented: $showSettings) {
            SettingsView(viewModel: viewModel)
        }
        .alert("错误", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("确定") { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "terminal")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("选择一个会话")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("从侧边栏选择 tmux pane 开始")
                .font(.callout)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "#1e2127"))
    }
}

// MARK: - Terminal Container (terminal + toolbox)
struct TerminalContainerView: View {
    @ObservedObject var viewModel: AppViewModel
    let paneTarget: String
    @State private var toolboxHeight: CGFloat = 280
    
    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                // Terminal area
                TerminalView(
                    viewModel: viewModel,
                    paneTarget: paneTarget
                )
                .frame(height: geo.size.height - toolboxHeight)
                .clipped()
                
                // Divider
                Rectangle()
                    .fill(Color(hex: "#3e4452"))
                    .frame(height: 1)
                
                // Toolbox
                ToolboxView(viewModel: viewModel)
                    .frame(height: toolboxHeight)
            }
        }
        .background(Color(hex: "#1e2127"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(.green)
                        .frame(width: 8, height: 8)
                    Text(paneTarget)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
