import Foundation

struct TerminalScript {
    static func generateHTML(fontSize: Int = 14, fontFamily: String = "'PingFang SC', Menlo, monospace") -> String {
        // Pre-process the client script to inject dynamic values
        // We do simple string replacement for the dynamic values in the JS
        let clientScript = TerminalClientScript.js
            .replacingOccurrences(of: "fontSizePlaceholder", with: "\(fontSize)")
            .replacingOccurrences(of: "'fontFamilyPlaceholder'", with: "'\(fontFamily)'")

        return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
          <style>
            \(TerminalStyles.xtermCSS)
            html, body { margin: 0; background-color: #000; overflow: hidden; height: 100%; width: 100%; font-family: 'PingFang SC', Menlo, monospace; }
            #terminal { width: 100%; height: 100%; }
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
          </style>
          <script>
            \(TerminalLibraries.xtermJS)
            \(TerminalLibraries.fitAddonJS)
          </script>
        </head>
        <body>
          <div id="terminal"></div>
          <script>
            \(clientScript)
          </script>
        </body>
        </html>
        """
    }
}
