import Foundation

struct TerminalScript {
    static func generateHTML(fontSize: Int = 14, fontFamily: String = "Menlo, monospace") -> String {
        return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
          <link rel="stylesheet" href="xterm.css" />
          <script src="xterm.min.js"></script>
          <script src="xterm-addon-fit.min.js"></script>
          <style>
            body { margin: 0; background-color: #000; overflow: hidden; height: 100vh; }
            #terminal { width: 100%; height: 100%; }
            /* Custom Scrollbar for iOS */
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
          </style>
        </head>
        <body>
          <div id="terminal"></div>
          <script>
            const term = new Terminal({
                cursorBlink: true,
                fontFamily: '\(fontFamily)',
                fontSize: \(fontSize),
                theme: { background: '#000000' },
                allowProposedApi: true
            });
            const fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            term.open(document.getElementById('terminal'));
            fitAddon.fit();
            
            // Output handling
            term.onData(data => {
                window.webkit.messageHandlers.terminalBridge.postMessage({
                    "type": "input",
                    "data": data
                });
            });

            // Resize observer
            new ResizeObserver(() => {
                try { fitAddon.fit(); } catch(e) {}
            }).observe(document.getElementById('terminal'));
        
            function write(data) {
                term.write(data);
            }
          </script>
        </body>
        </html>
        """
    }
}
