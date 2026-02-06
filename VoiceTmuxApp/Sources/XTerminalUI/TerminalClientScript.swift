import Foundation

public struct TerminalClientScript {
    public static let js = ##"""
    window.onerror = function(message, source, lineno, colno, error) {
        try {
            window.webkit.messageHandlers.terminalBridge.postMessage({
                "type": "jsError",
                "message": String(message)
            });
        } catch(e) {}
    };

    // Terminal Initialization
    const term = new Terminal({
        cursorBlink: true,
        fontFamily: 'fontFamilyPlaceholder', // Will be replaced
        fontSize: fontSizePlaceholder,       // Will be replaced
        theme: { background: '#000000' },
        allowProposedApi: true
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    term.focus();
    fitAddon.fit();
    
    // Initial Resize
    const dims = fitAddon.proposeDimensions();
    if (dims) {
        term.resize(dims.cols, dims.rows);
    }
    term.write('\x1b[2J\x1b[H');

    // Debug Status Overlay
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
    statusEl.textContent = 'xterm (modular 2)';
    document.body.appendChild(statusEl);

    // Notify Bridge Ready
    try {
        window.webkit.messageHandlers.terminalBridge.postMessage({
            "type": "ready"
        });
    } catch(e) {}
    
    // Input Handling
    term.onData(data => {
        window.webkit.messageHandlers.terminalBridge.postMessage({
            "type": "input",
            "data": data
        });
    });

    // Custom Write Function with Debugging
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

    // Resize Logic
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

    // Public API
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
"""##
}
