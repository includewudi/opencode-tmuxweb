import SwiftUI
import TerminalCore

/// Settings view — API key, model, terminal preferences
struct SettingsView: View {
    @ObservedObject var viewModel: AppViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var apiKey: String = ""
    @State private var apiUrl: String = ""
    @State private var model: String = ""
    @State private var fontSize: Double = 14
    
    var body: some View {
        NavigationStack {
            Form {
                Section("AI 配置") {
                    HStack {
                        Text("API Key")
                        Spacer()
                        SecureField("sk-...", text: $apiKey)
                            .multilineTextAlignment(.trailing)
                    }
                    HStack {
                        Text("API URL")
                        Spacer()
                        TextField("https://api.deepseek.com/v1/chat/completions", text: $apiUrl)
                            .multilineTextAlignment(.trailing)
                            .font(.caption)
                    }
                    HStack {
                        Text("模型")
                        Spacer()
                        TextField("deepseek-chat", text: $model)
                            .multilineTextAlignment(.trailing)
                    }
                }
                
                Section("终端") {
                    HStack {
                        Text("字体大小")
                        Spacer()
                        Slider(value: $fontSize, in: 10...24, step: 1) {
                            Text("Font Size")
                        }
                        Text("\(Int(fontSize))")
                            .monospacedDigit()
                            .frame(width: 24)
                    }
                }
                
                Section("自定义角色") {
                    ForEach(viewModel.settings.customRoles) { role in
                        HStack {
                            Text(role.emoji)
                            Text(role.label)
                            Spacer()
                            Text(role.desc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .onDelete { indexSet in
                        viewModel.settings.customRoles.remove(atOffsets: indexSet)
                    }
                    
                    Button("添加角色") {
                        let newRole = AIRole(id: UUID().uuidString, emoji: "🤖",
                                            label: "新角色", desc: "自定义角色",
                                            prompt: "你是一位专家...")
                        viewModel.settings.customRoles.append(newRole)
                    }
                }
                
                Section("关于") {
                    HStack {
                        Text("版本")
                        Spacer()
                        Text("1.0.0").foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { save(); dismiss() }
                }
            }
            .onAppear {
                apiKey = viewModel.settings.aiProvider.apiKey
                apiUrl = viewModel.settings.aiProvider.apiUrl
                model = viewModel.settings.aiProvider.model
                fontSize = Double(viewModel.settings.terminalFontSize)
            }
        }
    }
    
    private func save() {
        viewModel.settings.aiProvider = AIProvider(apiKey: apiKey, apiUrl: apiUrl, model: model)
        viewModel.settings.terminalFontSize = CGFloat(fontSize)
    }
}
