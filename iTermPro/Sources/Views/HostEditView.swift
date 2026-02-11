import SwiftUI
import TerminalCore

/// Host add/edit view
struct HostEditView: View {
    @ObservedObject var viewModel: AppViewModel
    @Environment(\.dismiss) private var dismiss
    
    let host: HostModel?
    
    @State private var alias = ""
    @State private var hostname = ""
    @State private var port = "22"
    @State private var username = "root"
    @State private var password = ""
    @State private var useKey = false
    @State private var privateKey = ""
    
    var body: some View {
        NavigationStack {
            Form {
                Section("连接信息") {
                    TextField("别名", text: $alias)
                    TextField("主机地址", text: $hostname)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    TextField("端口", text: $port)
                        .keyboardType(.numberPad)
                    TextField("用户名", text: $username)
                        .textInputAutocapitalization(.never)
                }
                
                Section("认证") {
                    Toggle("使用 SSH Key", isOn: $useKey)
                    
                    if useKey {
                        VStack(alignment: .leading) {
                            Text("私钥").font(.caption).foregroundStyle(.secondary)
                            TextEditor(text: $privateKey)
                                .font(.caption.monospaced())
                                .frame(minHeight: 100)
                        }
                    } else {
                        SecureField("密码", text: $password)
                    }
                }
            }
            .navigationTitle(host == nil ? "添加主机" : "编辑主机")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("保存") { save(); dismiss() }
                        .disabled(hostname.isEmpty || username.isEmpty)
                }
            }
            .onAppear {
                if let h = host {
                    alias = h.alias
                    hostname = h.hostname
                    port = "\(h.port)"
                    username = h.username
                    switch h.authMethod {
                    case .password(let pwd):
                        password = pwd
                        useKey = false
                    case .privateKey(let key, _):
                        privateKey = key
                        useKey = true
                    }
                }
            }
        }
    }
    
    private func save() {
        let portNum = Int(port) ?? 22
        let authMethod: SSHCredentials.AuthMethod = useKey
            ? .privateKey(key: privateKey, passphrase: nil)
            : .password(password)
        
        let newHost = HostModel(
            id: host?.id ?? UUID().uuidString,
            alias: alias.isEmpty ? hostname : alias,
            hostname: hostname,
            port: portNum,
            username: username,
            authMethod: authMethod
        )
        
        viewModel.hostStore.save(newHost)
    }
}
