import SwiftUI
import TerminalCore

/// Toolbox view — replicates web version's BottomToolbox
/// Contains: Quick keys, Command snippets tab, AI command tab
struct ToolboxView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var activeTab: ToolboxTab = .commands
    
    enum ToolboxTab: String, CaseIterable {
        case commands = "命令"
        case ai = "AI"
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Quick keys rows
            quickKeysSection
            
            // Tab selector
            tabSelector
            
            // Tab content
            TabView(selection: $activeTab) {
                snippetsList.tag(ToolboxTab.commands)
                AICommandView(viewModel: viewModel).tag(ToolboxTab.ai)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .background(Color(hex: "#21252b"))
    }
    
    // MARK: - Quick Keys (clone web layout)
    private var quickKeysSection: some View {
        VStack(spacing: 4) {
            // Row 1
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(QuickKey.row1, id: \.label) { key in
                        quickKeyButton(key)
                    }
                }
                .padding(.horizontal, 8)
            }
            .frame(height: 36)
            
            // Row 2
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(QuickKey.row2, id: \.label) { key in
                        quickKeyButton(key)
                    }
                }
                .padding(.horizontal, 8)
            }
            .frame(height: 36)
        }
        .padding(.vertical, 4)
    }
    
    private func quickKeyButton(_ key: QuickKey) -> some View {
        Button {
            if let data = key.data {
                Task { await viewModel.sendInput(data) }
            }
        } label: {
            Text(key.label)
                .font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(hex: "#3e4452"))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }
    
    // MARK: - Tab Selector
    private var tabSelector: some View {
        HStack(spacing: 0) {
            ForEach(ToolboxTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { activeTab = tab }
                } label: {
                    Text(tab.rawValue)
                        .font(.caption.weight(activeTab == tab ? .bold : .regular))
                        .foregroundStyle(activeTab == tab ? .white : .secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(activeTab == tab ? Color(hex: "#3e4452") : .clear)
                }
            }
        }
        .background(Color(hex: "#282c34"))
    }
    
    // MARK: - Snippets List
    private var snippetsList: some View {
        VStack(spacing: 0) {
            HStack {
                Text("常用命令").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Button { addSnippet() } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "plus")
                        Text("添加")
                    }
                    .font(.caption)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(viewModel.settings.snippets) { snippet in
                        snippetRow(snippet)
                    }
                }
                .padding(.horizontal, 8)
            }
        }
    }
    
    private func snippetRow(_ snippet: CommandSnippet) -> some View {
        Button {
            Task { await viewModel.sendInput(snippet.command + "\n") }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(snippet.name)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                    Text(snippet.command)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "play.fill")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(hex: "#2c313a"))
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }
    
    private func addSnippet() {
        let snippet = CommandSnippet(name: "新命令", command: "echo hello")
        viewModel.settings.snippets.append(snippet)
    }
}

// MARK: - Quick Key Definitions (matching web version)
struct QuickKey {
    let label: String
    let data: String?
    
    static let row1: [QuickKey] = [
        QuickKey(label: "esc", data: "\u{1B}"),
        QuickKey(label: "tab", data: "\t"),
        QuickKey(label: "|", data: "|"),
        QuickKey(label: "/", data: "/"),
        QuickKey(label: "-", data: "-"),
        QuickKey(label: "~", data: "~"),
        QuickKey(label: "^C", data: "\u{03}"),
        QuickKey(label: "clr", data: "\u{15}"),
    ]
    
    static let row2: [QuickKey] = [
        QuickKey(label: "↑", data: "\u{1B}[A"),
        QuickKey(label: "↓", data: "\u{1B}[B"),
        QuickKey(label: "←", data: "\u{1B}[D"),
        QuickKey(label: "→", data: "\u{1B}[C"),
        QuickKey(label: "📜", data: "\u{02}["),  // tmux copy mode
        QuickKey(label: "⏎", data: "\r"),
    ]
}
