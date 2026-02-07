import Foundation

public struct TerminalLibraries {
    public static var xtermJS: String {
        loadResource(name: "xterm.min", type: "js") ?? "console.error('Failed to load xterm.min.js');"
    }
    
    public static var fitAddonJS: String {
        loadResource(name: "xterm-addon-fit.min", type: "js") ?? "console.error('Failed to load xterm-addon-fit.min.js');"
    }
    
    private static func loadResource(name: String, type: String) -> String? {
        if let url = Bundle.main.url(forResource: name, withExtension: type) {
            return try? String(contentsOf: url, encoding: .utf8)
        }
        
        #if SWIFT_PACKAGE
        if let url = Bundle.module.url(forResource: name, withExtension: type) {
            return try? String(contentsOf: url, encoding: .utf8)
        }
        #endif
        
        return nil
    }
}
