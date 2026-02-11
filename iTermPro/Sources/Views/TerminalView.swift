import SwiftUI
import WebKit

/// Terminal view using xterm.js WKWebView — matches web version rendering
struct TerminalView: View {
    @ObservedObject var viewModel: AppViewModel
    let paneTarget: String
    
    var body: some View {
        XTermWebView(viewModel: viewModel, paneTarget: paneTarget)
            .background(Color(hex: "#282c34"))
            .onAppear {
                Task { await viewModel.attachToSession(paneTarget) }
            }
    }
}

/// WKWebView wrapper for xterm.js terminal
struct XTermWebView: UIViewRepresentable {
    @ObservedObject var viewModel: AppViewModel
    let paneTarget: String
    
    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "terminal")
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(hex: "#282c34")
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        
        // Load xterm.js terminal HTML
        let html = Self.generateHTML(fontSize: viewModel.settings.terminalFontSize)
        webView.loadHTMLString(html, baseURL: nil)
        
        context.coordinator.webView = webView
        
        // Register output handler
        viewModel.terminalOutputHandler = { [weak webView] output in
            let escaped = output
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "\\r")
            let js = "window.termWrite('\(escaped)');"
            webView?.evaluateJavaScript(js)
        }
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    
    class Coordinator: NSObject, WKScriptMessageHandler {
        weak var webView: WKWebView?
        let viewModel: AppViewModel
        
        init(viewModel: AppViewModel) {
            self.viewModel = viewModel
        }
        
        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            
            switch type {
            case "input":
                if let data = body["data"] as? String {
                    Task { await viewModel.sendInput(data) }
                }
            case "ready":
                // Terminal initialized
                break
            default:
                break
            }
        }
    }
    
    // MARK: - HTML Generation
    static func generateHTML(fontSize: CGFloat) -> String {
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #282c34; }
        #terminal { width: 100%; height: 100%; }
        .xterm { padding: 4px; }
        \(xtermCSS)
        </style>
        <script>\(xtermJS)</script>
        <script>\(fitAddonJS)</script>
        </head>
        <body>
        <div id="terminal"></div>
        <script>
        const term = new Terminal({
            fontSize: \(Int(fontSize)),
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            cursorBlink: true,
            cursorStyle: 'bar',
            theme: {
                background: '#282c34',
                foreground: '#abb2bf',
                cursor: '#528bff',
                selectionBackground: 'rgba(82,139,255,0.3)',
                black: '#3f4451', red: '#e06c75', green: '#98c379',
                yellow: '#d19a66', blue: '#61afef', magenta: '#c678dd',
                cyan: '#56b6c2', white: '#abb2bf',
            },
            allowProposedApi: true,
            scrollback: 5000,
        });
        
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(document.getElementById('terminal'));
        
        try { fitAddon.fit(); } catch(e) {}
        
        // Expose write function for Swift
        window.termWrite = function(data) {
            term.write(data);
        };
        
        // Send input from terminal to Swift
        term.onData(function(data) {
            window.webkit.messageHandlers.terminal.postMessage({
                type: 'input', data: data
            });
        });
        
        // Notify Swift that terminal is ready
        window.webkit.messageHandlers.terminal.postMessage({ type: 'ready' });
        
        // Resize observer
        new ResizeObserver(() => {
            try { fitAddon.fit(); } catch(e) {}
        }).observe(document.getElementById('terminal'));
        </script>
        </body>
        </html>
        """
    }
    
    // xterm.js and CSS are inlined — loaded from bundle in production
    // For now, the actual content would be loaded from Resources
    static var xtermCSS: String { "" }  // TODO: load from bundle
    static var xtermJS: String { "" }    // TODO: load from bundle
    static var fitAddonJS: String { "" } // TODO: load from bundle
}

// MARK: - Color Hex Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255
        let b = Double(rgbValue & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = CGFloat((rgbValue & 0xFF0000) >> 16) / 255
        let g = CGFloat((rgbValue & 0x00FF00) >> 8) / 255
        let b = CGFloat(rgbValue & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
