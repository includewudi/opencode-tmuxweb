import SwiftUI
import VoiceTmuxCore

struct ConnectionSettingsView: View {
    @ObservedObject var viewModel: AppViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var host: String = ""
    @State private var port: String = "22"
    @State private var username: String = ""
    @State private var authMethod: AuthMethodOption = .password
    @State private var password: String = ""
    @State private var privateKey: String = "" // PEM content
    @State private var saveCredentials: Bool = true
    
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
                Section("Server") {
                    TextField("Host", text: $host)
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
                    
                    Toggle("Save Credentials", isOn: $saveCredentials)
                }
                
                if case .failed(let msg) = viewModel.connectionState {
                    Section {
                        Text(msg)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Connect")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Connect") {
                        connect()
                    }
                    .disabled(host.isEmpty || username.isEmpty)
                }
            }
            .onAppear {
                loadSavedConfig()
            }
        }
    }
    
    private func connect() {
        guard let portInt = Int(port) else { return }
        
        let method: SSHAuthMethod
        switch authMethod {
        case .password:
            method = .password(password)
        case .privateKey:
            method = .privateKey(key: privateKey, passphrase: nil)
        }
        
        let creds = SSHCredentials(
            host: host,
            port: portInt,
            username: username,
            authMethod: method
        )
        
        Task {
            await viewModel.connect(credentials: creds, save: saveCredentials)
        }
    }
    
    private func loadSavedConfig() {
        // We could load from Keychain here to pre-fill the form if desired
        if let saved = try? KeychainService.shared.loadCredentials() {
            self.host = saved.host
            self.port = String(saved.port)
            self.username = saved.username
            
            switch saved.authMethod {
            case .password(let pwd):
                self.authMethod = .password
                self.password = pwd
            case .privateKey(let key, _):
                self.authMethod = .privateKey
                self.privateKey = key
            }
            self.saveCredentials = true
        }
    }
}
