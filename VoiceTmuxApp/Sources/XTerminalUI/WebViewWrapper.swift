import SwiftUI
import WebKit

struct WebViewWrapper: UIViewRepresentable {
    @Binding var script: String?
    let bridge: TerminalBridge
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(bridge, name: "terminalBridge")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        
        // Load the HTML template
        let html = TerminalScript.generateHTML()
        
        // Setup Base URL for resources
        // Assuming resources are in the main bundle or a known directory
        // We look for xterm.css in the bundle to find the correct base path
        let baseURL: URL?
        if let resourceURL = Bundle.main.url(forResource: "xterm", withExtension: "css") {
            baseURL = resourceURL.deletingLastPathComponent()
        } else {
             // Fallback for previews or if not in bundle yet
             baseURL = Bundle.main.bundleURL
        }

        webView.loadHTMLString(html, baseURL: baseURL)
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let script = script {
            uiView.evaluateJavaScript(script)
            DispatchQueue.main.async {
                self.script = nil
            }
        }
    }
}
