import WebKit
import Foundation

class TerminalBridge: NSObject, WKScriptMessageHandler {
    var onInput: ((String) -> Void)?
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "terminalBridge",
              let dict = message.body as? [String: Any],
              let type = dict["type"] as? String else { return }
        
        if type == "input", let data = dict["data"] as? String {
            onInput?(data)
        }
    }
}
