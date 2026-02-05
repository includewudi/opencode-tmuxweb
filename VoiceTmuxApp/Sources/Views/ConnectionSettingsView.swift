import SwiftUI
import VoiceTmuxCore

struct ConnectionSettingsView: View {
    @ObservedObject var viewModel: AppViewModel
    @Environment(\.dismiss) var dismiss
    
    let existingHost: HostModel?
    
    @State private var alias: String = ""
    @State private var host: String = ""
    @State private var port: String = "22"
    @State private var username: String = ""
    @State private var authMethod: AuthMethodOption = .password
    @State private var password: String = ""
    @State private var privateKey: String = "" // PEM content
    @State private var isConnecting = false
    
    enum AuthMethodOption: String, CaseIterable, Identifiable {
        case password
        case privateKey
        
        var id: String { rawValue }
        var title: String {
            switch self {
            case .password: return "Password"
            case .privateKey: return "Private Key"
            }
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Host Details") {
                    TextField("Alias (Optional)", text: $alias)
                    
                    TextField("Hostname / IP", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                }
                
                Section("Authentication") {
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    Picker("Method", selection: $authMethod) {
                        ForEach(AuthMethodOption.allCases) { method in
                            Text(method.title).tag(method)
                        }
                    }
                    .pickerStyle(.segmented)
                    
                    if authMethod == .password {
                        SecureField("Password", text: $password)
                    } else {
                        TextEditor(text: $privateKey)
                            .frame(height: 100)
                            .overlay(
                                Text("Private Key (PEM)")
                                    .foregroundStyle(.gray)
                                    .opacity(privateKey.isEmpty ? 0.5 : 0)
                                    .padding(.top, 8)
                                    .padding(.leading, 5),
                                alignment: .topLeading
                            )
                            .font(.system(.body, design: .monospaced))
                    }
                }
                
                if let error = viewModel.error {
                   Section {
                       Text(error.localizedDescription)
                           .foregroundStyle(.red)
                   }
                }
            }
            .navigationTitle(existingHost == nil ? "New Server" : "Edit Server")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isConnecting {
                        ProgressView()
                    } else {
                        Button("Connect") {
                            connectAndSave()
                        }
                        .disabled(host.isEmpty || username.isEmpty)
                    }
                }
            }
            .onAppear {
                populateFields()
            }
        }
    }
    
    private func populateFields() {
        if let existing = existingHost {
            self.alias = existing.alias
            self.host = existing.hostname
            self.port = String(existing.port)
            self.username = existing.username
            
            // Load secrets
            if let creds = try? KeychainService.shared.loadCredentials(for: existing) {
                switch creds.authMethod {
                case .password(let pwd):
                    self.authMethod = .password
                    self.password = pwd
                case .privateKey(let key, _):
                    self.authMethod = .privateKey
                    self.privateKey = key
                }
            }
        }
    }
    
    private func connectAndSave() {
        guard let portInt = Int(port) else { return }
        
        let method: SSHAuthMethod
        switch authMethod {
        case .password:
            method = .password(password)
        case .privateKey:
            method = .privateKey(key: privateKey, passphrase: nil)
        }
        
        let credentials = SSHCredentials(
            host: host,
            port: portInt,
            username: username,
            authMethod: method
        )
        
        let hostId = existingHost?.id ?? UUID()
        let hostAlias = alias.isEmpty ? host : alias
        
        let hostModel = HostModel(
            id: hostId,
            alias: hostAlias,
            hostname: host,
            port: portInt,
            username: username
        )
        
        isConnecting = true
        
        Task {
            // Save first
            viewModel.saveHost(
                hostModel,
                credentials: credentials,
                usePrivateKey: authMethod == .privateKey
            )
            
            // Connect
            await viewModel.connect(host: hostModel)
            
            isConnecting = false
            dismiss()
        }
    }
}
