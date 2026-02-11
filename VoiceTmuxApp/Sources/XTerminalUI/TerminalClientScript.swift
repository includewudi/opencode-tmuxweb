import Foundation

public struct TerminalClientScript {
    public static let js = ##"""
    // --- UI Helpers ---
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = message;
        container.appendChild(el);
        
        // Trigger reflow
        el.offsetHeight;
        el.classList.add('show');
        
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => {
                if (el.parentNode) el.remove();
            }, 300);
        }, duration);
    }

    // 全局错误捕获，直接显示在界面上
    window.onerror = function(message, source, lineno, colno, error) {
        const errorMsg = String(message);
        showToast("JS Error: " + errorMsg, 'error', 5000);
        try {
            window.webkit.messageHandlers.terminalBridge.postMessage({
                "type": "jsError",
                "message": errorMsg
            });
        } catch(e) {}
    };

    // --- Terminal Setup ---
    let term;
    let fitAddon;

    try {
        term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar', // 移动端光标用 bar 更容易看清
            fontFamily: 'fontFamilyPlaceholder',
            fontSize: fontSizePlaceholder,
            lineHeight: 1.2, // 增加行高，提升阅读体验
            theme: { 
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#007AFF', // iOS 蓝光标
                selectionBackground: 'rgba(0, 122, 255, 0.3)' 
            },
            allowProposedApi: true,
            scrollback: 1000,
            drawBoldTextInBrightColors: true
        });

        fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        
        const terminalElem = document.getElementById('terminal');
        term.open(terminalElem);
        
        // 初始适配
        fitAddon.fit();
        term.focus();
        
        // 欢迎信息
        // term.write('\x1b[2mTerminal Ready.\x1b[0m\r\n');

    } catch (e) {
        showToast("Init Failed: " + e.message, 'error');
    }

    // --- Interaction Logic ---

    // 监听输入并传回原生层
    term.onData(data => {
        window.webkit.messageHandlers.terminalBridge.postMessage({
            "type": "input",
            "data": data
        });
    });
    
    // 自定义 Title 变化监听 (如果支持)
    term.onTitleChange(title => {
        // 可选：传回原生层更新导航栏标题
    });

    // 核心写入函数
    window.write = function(data) {
        try {
            term.write(data);
        } catch(e) {
            showToast("Write Error: " + e.message, 'error');
        }
    };

    // --- Layout & Resize ---
    
    let resizeTimeout;
    function handleResize() {
        if (!term) return;
        
        // 重新计算尺寸
        try {
            // Logic fix: Capture old dimensions *before* fitting to detect change
            const oldCols = term.cols;
            const oldRows = term.rows;

            fitAddon.fit();
            
            // Only notify native layer if dimensions actually changed
            if (term.cols !== oldCols || term.rows !== oldRows) {
                window.webkit.messageHandlers.terminalBridge.postMessage({
                    "type": "resize",
                    "cols": term.cols,
                    "rows": term.rows
                });
            }
        } catch(e) {
            console.error(e);
        }
    }

    // 使用 ResizeObserver 监听容器大小变化（比 window.onresize 更准确）
    const resizeObserver = new ResizeObserver(entries => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 100); // 防抖 100ms
    });
    
    const container = document.getElementById('terminal-container');
    if (container) {
        resizeObserver.observe(container);
    } else {
        resizeObserver.observe(document.getElementById('terminal'));
    }

    // 通知原生层 JS 已就绪
    setTimeout(() => {
        try {
            window.webkit.messageHandlers.terminalBridge.postMessage({
                "type": "ready"
            });
            handleResize(); // 再次确保尺寸正确
        } catch(e) {}
    }, 100);

    // 暴露给外部调用
    window.setTheme = function(themeConfig) {
        if (term) {
            term.options.theme = themeConfig;
        }
    }
    
    window.setFontSize = function(size) {
        if (term) {
            term.options.fontSize = size;
            handleResize();
        }
    }
    """##
}
