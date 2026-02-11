import Foundation

/// Local settings storage — no backend needed
class SettingsStore: ObservableObject {
    @Published var aiProvider: AIProvider {
        didSet { save() }
    }
    @Published var customRoles: [AIRole] {
        didSet { save() }
    }
    @Published var snippets: [CommandSnippet] {
        didSet { save() }
    }
    @Published var terminalFontSize: CGFloat {
        didSet { save() }
    }
    @Published var defaultSessionName: String {
        didSet { save() }
    }
    
    private let settingsURL: URL
    
    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.settingsURL = docs.appendingPathComponent("iTermPro_settings.json")
        
        // Defaults
        self.aiProvider = AIProvider()
        self.customRoles = []
        self.snippets = []
        self.terminalFontSize = 14
        self.defaultSessionName = ""
        
        load()
    }
    
    var allRoles: [AIRole] {
        builtinRoles + customRoles
    }
    
    private func save() {
        let data = SettingsData(
            aiProvider: aiProvider,
            customRoles: customRoles,
            snippets: snippets,
            terminalFontSize: terminalFontSize,
            defaultSessionName: defaultSessionName
        )
        if let encoded = try? JSONEncoder().encode(data) {
            try? encoded.write(to: settingsURL, options: .atomic)
        }
    }
    
    private func load() {
        guard let data = try? Data(contentsOf: settingsURL),
              let decoded = try? JSONDecoder().decode(SettingsData.self, from: data) else { return }
        self.aiProvider = decoded.aiProvider
        self.customRoles = decoded.customRoles
        self.snippets = decoded.snippets
        self.terminalFontSize = decoded.terminalFontSize
        self.defaultSessionName = decoded.defaultSessionName
    }
}

struct CommandSnippet: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var command: String
    
    init(id: String = UUID().uuidString, name: String, command: String) {
        self.id = id
        self.name = name
        self.command = command
    }
}

private struct SettingsData: Codable {
    var aiProvider: AIProvider
    var customRoles: [AIRole]
    var snippets: [CommandSnippet]
    var terminalFontSize: CGFloat
    var defaultSessionName: String
}
