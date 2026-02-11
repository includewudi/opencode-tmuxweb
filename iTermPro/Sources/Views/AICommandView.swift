import SwiftUI
import TerminalCore

/// AI command generation view — replicates web version's AI tab
struct AICommandView: View {
    @ObservedObject var viewModel: AppViewModel
    @State private var prompt = ""
    @State private var selectedRole: AIRole?
    @State private var result = ""
    @State private var isLoading = false
    @State private var showRolePicker = false
    
    var body: some View {
        VStack(spacing: 8) {
            // Role selector
            Button { showRolePicker = true } label: {
                HStack {
                    Text(selectedRole?.emoji ?? "🖥️")
                    Text(selectedRole?.label ?? "命令行大神")
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption2)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(hex: "#3e4452"))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .padding(.horizontal, 12)
            
            // Input field
            HStack(spacing: 6) {
                TextField("输入指令...", text: $prompt, axis: .vertical)
                    .font(.caption)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color(hex: "#2c313a"))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .lineLimit(1...3)
                
                Button {
                    Task { await generate() }
                } label: {
                    Image(systemName: isLoading ? "hourglass" : "paperplane.fill")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(prompt.isEmpty ? Color.gray : Color.blue)
                        .clipShape(Circle())
                }
                .disabled(prompt.isEmpty || isLoading)
            }
            .padding(.horizontal, 12)
            
            // Result
            if !result.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("结果").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                            Spacer()
                            Button {
                                Task { await viewModel.sendInput(result + "\n") }
                            } label: {
                                HStack(spacing: 2) {
                                    Image(systemName: "play.fill")
                                    Text("执行")
                                }
                                .font(.caption2)
                                .foregroundStyle(.green)
                            }
                        }
                        Text(result)
                            .font(.caption.monospaced())
                            .foregroundStyle(.white)
                            .textSelection(.enabled)
                    }
                    .padding(8)
                    .background(Color(hex: "#2c313a"))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .padding(.horizontal, 12)
            }
        }
        .padding(.vertical, 8)
        .sheet(isPresented: $showRolePicker) {
            rolePicker
        }
        .onAppear {
            if selectedRole == nil {
                selectedRole = builtinRoles.first
            }
        }
    }
    
    private func generate() async {
        guard let role = selectedRole, !prompt.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        
        do {
            result = try await viewModel.generateAICommand(prompt: prompt, role: role)
        } catch {
            result = "错误: \(error.localizedDescription)"
        }
    }
    
    private var rolePicker: some View {
        NavigationStack {
            List(viewModel.settings.allRoles) { role in
                Button {
                    selectedRole = role
                    showRolePicker = false
                } label: {
                    HStack {
                        Text(role.emoji).font(.title3)
                        VStack(alignment: .leading) {
                            Text(role.label).font(.body.weight(.semibold))
                            Text(role.desc).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if selectedRole?.id == role.id {
                            Image(systemName: "checkmark").foregroundStyle(.blue)
                        }
                    }
                }
                .foregroundStyle(.primary)
            }
            .navigationTitle("选择角色")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { showRolePicker = false }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
