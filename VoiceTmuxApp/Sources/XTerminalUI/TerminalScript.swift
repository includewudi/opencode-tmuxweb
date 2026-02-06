import Foundation

struct TerminalScript {
    static func generateHTML(fontSize: Int = 14, fontFamily: String = "'PingFang SC', Menlo, monospace") -> String {
        return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
          <link rel="stylesheet" href="xterm.css" />
          <script src="xterm.min.js"></script>
          <script src="xterm-addon-fit.min.js"></script>
          <style>
            html, body { margin: 0; background-color: #000; overflow: hidden; height: 100%; width: 100%; font-family: 'PingFang SC', Menlo, monospace; }
            #terminal { width: 100%; height: 100%; }
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
          </style>
        </head>
        <body>
          <div id="terminal"></div>
          <script>
            window.onerror = function(message, source, lineno, colno, error) {
                try {
                    window.webkit.messageHandlers.terminalBridge.postMessage({
                        "type": "jsError",
                        "message": String(message)
                    });
                } catch(e) {}
            };

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
            term.focus();
            fitAddon.fit();
            const dims = fitAddon.proposeDimensions();
            if (dims) {
                term.resize(dims.cols, dims.rows);
            }
            term.write('\\x1b[2J\\x1b[H');

            const statusEl = document.createElement('div');
            statusEl.style.position = 'absolute';
            statusEl.style.left = '6px';
            statusEl.style.top = '6px';
            statusEl.style.zIndex = '9999';
            statusEl.style.fontSize = '10px';
            statusEl.style.color = '#fff';
            statusEl.style.background = 'rgba(0,0,0,0.5)';
            statusEl.style.padding = '2px 4px';
            statusEl.style.borderRadius = '4px';
            statusEl.textContent = 'xterm ready';
            document.body.appendChild(statusEl);

            try {
                window.webkit.messageHandlers.terminalBridge.postMessage({
                    "type": "ready"
                });
            } catch(e) {}
            
            term.onData(data => {
                window.webkit.messageHandlers.terminalBridge.postMessage({
                    "type": "input",
                    "data": data
                });
            });

            window.write = function(data) {
                try {
                    const container = document.getElementById('terminal');
                    statusEl.textContent = 'write len:' + data.length + 
                        ' cols=' + term.cols + ' rows=' + term.rows +
                        ' w=' + container.clientWidth + ' h=' + container.clientHeight;
                    term.write(data);
                } catch(e) {
                    statusEl.textContent = 'write ERROR: ' + e.message;
                    window.webkit.messageHandlers.terminalBridge.postMessage({
                        "type": "jsError",
                        "message": "write() exception: " + e.message
                    });
                }
            };

            window.writeFallback = function(data) {
                statusEl.textContent = 'fallback len: ' + data.length;
            };

            function notifyResize() {
                try {
                    fitAddon.fit();
                    window.webkit.messageHandlers.terminalBridge.postMessage({
                        "type": "resize",
                        "cols": term.cols,
                        "rows": term.rows
                    });
                } catch(e) {}
            }

            new ResizeObserver(() => {
                notifyResize();
            }).observe(document.getElementById('terminal'));
            
            setTimeout(notifyResize, 500);
        
            function write(data) {
                if (window.write) {
                    window.write(data);
                } else {
                    term.write(data);
                }
            }

            function writeFallback(data) {
                if (window.writeFallback) {
                    window.writeFallback(data);
                }
            }
          </script>
        </body>
        </html>
        """
    }
}
