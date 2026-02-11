import Foundation

/// AI role definition for command generation
public struct AIRole: Codable, Identifiable, Equatable {
    public let id: String
    public var emoji: String
    public var label: String
    public var desc: String
    public var prompt: String
    public var suffix: String?
    public var model: String?       // Per-role model override
    public var isBuiltin: Bool
    
    public init(id: String, emoji: String, label: String, desc: String,
                prompt: String, suffix: String? = nil, model: String? = nil, isBuiltin: Bool = false) {
        self.id = id
        self.emoji = emoji
        self.label = label
        self.desc = desc
        self.prompt = prompt
        self.suffix = suffix
        self.model = model
        self.isBuiltin = isBuiltin
    }
}

/// AI API provider configuration
public struct AIProvider: Codable {
    public var apiKey: String
    public var apiUrl: String
    public var model: String
    
    public init(apiKey: String = "",
                apiUrl: String = "https://api.deepseek.com/v1/chat/completions",
                model: String = "deepseek-chat") {
        self.apiKey = apiKey
        self.apiUrl = apiUrl
        self.model = model
    }
}

/// AI command generation service — direct API calls, no backend
public actor AIService {
    private var provider: AIProvider
    
    public init(provider: AIProvider = AIProvider()) {
        self.provider = provider
    }
    
    public func updateProvider(_ provider: AIProvider) {
        self.provider = provider
    }
    
    /// Generate a command using the specified role
    public func generateCommand(prompt: String, role: AIRole) async throws -> String {
        guard !provider.apiKey.isEmpty else {
            throw AIError.noApiKey
        }
        
        let model = role.model ?? provider.model
        let systemPrompt = role.prompt
        var userPrompt = prompt
        if let suffix = role.suffix {
            userPrompt += "\n\n" + suffix
        }
        
        let body: [String: Any] = [
            "model": model,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userPrompt]
            ],
            "temperature": 0.7,
            "max_tokens": 2048
        ]
        
        guard let url = URL(string: provider.apiUrl) else {
            throw AIError.invalidUrl
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(provider.apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AIError.networkError("Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AIError.apiError(httpResponse.statusCode, errorBody)
        }
        
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let first = choices.first,
              let message = first["message"] as? [String: Any],
              let content = message["content"] as? String else {
            throw AIError.parseError
        }
        
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

public enum AIError: LocalizedError {
    case noApiKey
    case invalidUrl
    case networkError(String)
    case apiError(Int, String)
    case parseError
    
    public var errorDescription: String? {
        switch self {
        case .noApiKey: return "请先配置 API Key"
        case .invalidUrl: return "无效的 API URL"
        case .networkError(let msg): return "网络错误: \(msg)"
        case .apiError(let code, let body): return "API 错误 (\(code)): \(body)"
        case .parseError: return "解析响应失败"
        }
    }
}
