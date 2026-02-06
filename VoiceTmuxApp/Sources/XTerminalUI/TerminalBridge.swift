import WebKit
import Foundation

class TerminalBridge: NSObject, WKScriptMessageHandler {
    var onInput: ((String) -> Void)?
    var onResize: ((Int, Int) -> Void)?
    var onReady: (() -> Void)?
    var onJSError: ((String) -> Void)?
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "terminalBridge",
              let dict = message.body as? [String: Any],
              let type = dict["type"] as? String else { return }
        
        switch type {
        case "input":
            if let data = dict["data"] as? String {
                onInput?(data)
            }
        case "resize":
            if let cols = dict["cols"] as? Int,
               let rows = dict["rows"] as? Int {
                onResize?(cols, rows)
            }
        case "ready":
            onReady?()
        case "jsError":
            if let message = dict["message"] as? String {
                onJSError?(message)
            }
        default:
            break
        }
    }
}
