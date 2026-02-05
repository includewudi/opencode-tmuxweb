import Foundation
import CryptoKit

public struct XunfeiAuth {
    public static func buildAuthURL(apiKey: String, apiSecret: String) -> URL? {
        let host = "iat-api.xfyun.cn"
        let path = "/v2/iat"
        let requestUrl = "wss://\(host)\(path)"
        
        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "en_US")
        dateFormatter.timeZone = TimeZone(identifier: "GMT")
        dateFormatter.dateFormat = "E, dd MMM yyyy HH:mm:ss 'GMT'"
        let date = Date()
        let dateString = dateFormatter.string(from: date)
        
        // 1. Build signature string
        // "host: iat-api.xfyun.cn\ndate: Wed, 10 Jul 2019 07:35:43 GMT\nGET /v2/iat HTTP/1.1"
        let signatureOrigin = "host: \(host)\ndate: \(dateString)\nGET \(path) HTTP/1.1"
        
        // 2. HMAC-SHA256
        guard let data = signatureOrigin.data(using: .utf8),
              let secretData = apiSecret.data(using: .utf8) else { return nil }
        
        let symKey = SymmetricKey(data: secretData)
        let signature = HMAC<SHA256>.authenticationCode(for: data, using: symKey)
        let signatureBase64 = Data(signature).base64EncodedString()
        
        // 3. Authorization Header
        let authString = "api_key=\"\(apiKey)\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"\(signatureBase64)\""
        
        guard let authBase64 = authString.data(using: .utf8)?.base64EncodedString() else { return nil }
        
        // 4. Final URL
        var components = URLComponents(string: requestUrl)
        components?.queryItems = [
            URLQueryItem(name: "authorization", value: authBase64),
            URLQueryItem(name: "date", value: dateString),
            URLQueryItem(name: "host", value: host)
        ]
        
        return components?.url
    }
}
