import Foundation

struct TerminalScript {
    static func generateHTML(fontSize: Int = 14, fontFamily: String = "'Menlo', 'Courier New', monospace") -> String {
        // 预处理 JS，注入动态参数
        let clientScript = TerminalClientScript.js
            .replacingOccurrences(of: "fontSizePlaceholder", with: "\(fontSize)")
            .replacingOccurrences(of: "'fontFamilyPlaceholder'", with: "'\(fontFamily)'")

        return """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
          <style>
            \(TerminalStyles.xtermCSS)
            
            :root {
                --bg-color: #000000;
                --fg-color: #ffffff;
                --safe-top: env(safe-area-inset-top);
                --safe-bottom: env(safe-area-inset-bottom);
                --safe-left: env(safe-area-inset-left);
                --safe-right: env(safe-area-inset-right);
            }

            html, body { 
                margin: 0; 
                padding: 0;
                background-color: var(--bg-color); 
                height: 100%; 
                width: 100%; 
                overflow: hidden; 
                font-family: \(fontFamily);
                -webkit-tap-highlight-color: transparent;
                /* 禁止 iOS 默认的长按菜单，交由 xterm 处理 */
                -webkit-touch-callout: none;
                user-select: none;
            }

            #terminal-container {
                /* 绝对定位撑满，且包含安全区域内边距 */
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                padding-top: var(--safe-top);
                padding-bottom: var(--safe-bottom);
                padding-left: max(16px, var(--safe-left));
                padding-right: max(4px, var(--safe-right)); /* 右侧留一点缝隙给滚动条 */
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
            }

            #terminal { 
                flex: 1; 
                width: 100%; 
                height: 100%; 
                /* 解决 iOS 上某些渲染闪烁问题 */
                transform: translateZ(0); 
            }

            /* 隐藏滚动条但允许滚动 */
            .xterm-viewport::-webkit-scrollbar { 
                width: 4px; 
            }
            .xterm-viewport::-webkit-scrollbar-track { 
                background: transparent; 
            }
            .xterm-viewport::-webkit-scrollbar-thumb { 
                background: rgba(255, 255, 255, 0.2); 
                border-radius: 2px; 
            }

            /* --- 内置 Toast 样式 --- */
            #toast-container {
                position: fixed;
                top: calc(20px + var(--safe-top));
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                width: 90%;
                max-width: 400px;
            }

            .toast {
                background: rgba(30, 30, 30, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: #fff;
                padding: 10px 16px;
                border-radius: 20px;
                font-size: 13px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.1);
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                text-align: center;
            }

            .toast.show {
                opacity: 1;
                transform: translateY(0);
            }

            .toast.error {
                border-color: rgba(255, 80, 80, 0.3);
                background: rgba(40, 10, 10, 0.9);
                color: #ffcccc;
            }
          </style>
          <script>
            \(TerminalLibraries.xtermJS)
            \(TerminalLibraries.fitAddonJS)
          </script>
        </head>
        <body>
          <div id="terminal-container">
            <div id="terminal"></div>
          </div>
          <div id="toast-container"></div>
          <script>
            \(clientScript)
          </script>
        </body>
        </html>
        """
    }
}
