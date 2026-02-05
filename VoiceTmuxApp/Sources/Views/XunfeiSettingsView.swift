import SwiftUI
import VoiceTmuxCore

struct XunfeiSettingsView: View {
    @Environment(\.dismiss) var dismiss
    
    @State private var appId: String = ""
    @State private var apiKey: String = ""
    @State private var apiSecret: String = ""
    @State private var isSaving = false
    @State private var saveSuccess = false
    @State private var errorMessage: String?
    
    private let keychainService = KeychainService.shared
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("App ID", text: $appId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    TextField("API Key", text: $apiKey)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    SecureField("API Secret", text: $apiSecret)
                } header: {
                    Text("讯飞开放平台凭证")
                } footer: {
                    Text("从讯飞开放平台控制台获取，使用大模型多语种语音识别服务")
                }
                
                Section {
                    Link(destination: URL(string: "https://console.xfyun.cn/app/myapp")!) {
                        HStack {
                            Image(systemName: "arrow.up.right.square")
                            Text("讯飞开放平台控制台")
                        }
                    }
                    
                    Link(destination: URL(string: "https://www.xfyun.cn/doc/spark/spark_mul_cn_iat.html")!) {
                        HStack {
                            Image(systemName: "doc.text")
                            Text("API 文档")
                        }
                    }
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
                
                if saveSuccess {
                    Section {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text("保存成功")
                        }
                    }
                }
            }
            .navigationTitle("语音识别设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        save()
                    }
                    .disabled(appId.isEmpty || apiKey.isEmpty || apiSecret.isEmpty || isSaving)
                }
            }
            .onAppear {
                loadConfig()
            }
        }
    }
    
    private func loadConfig() {
        if let config = try? keychainService.loadXunfeiConfig() {
            appId = config.appId
            apiKey = config.apiKey
            apiSecret = config.apiSecret
        }
    }
    
    private func save() {
        isSaving = true
        errorMessage = nil
        saveSuccess = false
        
        do {
            try keychainService.saveXunfeiConfig(appId: appId, apiKey: apiKey, apiSecret: apiSecret)
            saveSuccess = true
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                dismiss()
            }
        } catch {
            errorMessage = "保存失败: \(error.localizedDescription)"
        }
        
        isSaving = false
    }
}
