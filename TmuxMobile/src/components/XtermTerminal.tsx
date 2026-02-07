import React, { useRef, useCallback, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

/**
 * XtermTerminal - xterm.js-based terminal component using WebView
 * 
 * Renders xterm.js offline (no CDN) with a bridge for input/output.
 * Exposes ref API: write, clear, resize, scrollToEnd
 */

export interface XtermTerminalRef {
  write: (data: string) => void;
  clear: () => void;
  resize: (cols: number, rows: number) => void;
  scrollToEnd: () => void;
}

export interface XtermTerminalProps {
  initialContent?: string;
  fontSize?: number;
  onData?: (data: string) => void;
  onReady?: () => void;
}

// TODO: Replace CDN with bundled xterm.js assets for true offline support
const getTerminalHtml = (fontSize: number = 14) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      height: 100%; 
      width: 100%; 
      overflow: hidden; 
      background: #1a1a1a; 
    }
    #terminal { 
      height: 100%; 
      width: 100%; 
      padding: 4px;
    }
    .xterm { 
      height: 100%; 
    }
    .xterm-viewport::-webkit-scrollbar {
      width: 8px;
    }
    .xterm-viewport::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 4px;
    }
    .xterm-viewport::-webkit-scrollbar-track {
      background: #1a1a1a;
    }
    /* Fallback terminal styles if xterm fails to load */
    #fallback-terminal {
      display: none;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: ${fontSize}px;
      color: #e5e5e5;
      background: #1a1a1a;
      padding: 8px;
      height: 100%;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    #fallback-terminal.active {
      display: block;
    }
    #terminal.hidden {
      display: none;
    }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
</head>
<body>
  <div id="terminal"></div>
  <div id="fallback-terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
  <script>
    (function() {
      let term = null;
      let fitAddon = null;
      let useFallback = false;
      const fallbackEl = document.getElementById('fallback-terminal');
      const terminalEl = document.getElementById('terminal');
      
      // Message bridge to React Native
      function sendMessage(type, payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
        }
      }
      
      // Fallback terminal for offline mode
      function initFallback() {
        useFallback = true;
        terminalEl.classList.add('hidden');
        fallbackEl.classList.add('active');
        sendMessage('ready', { fallback: true });
      }
      
      // Initialize xterm.js
      function initXterm() {
        try {
          if (typeof Terminal === 'undefined') {
            initFallback();
            return;
          }
          
          term = new Terminal({
            cursorBlink: true,
            fontSize: ${fontSize},
            fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
            theme: {
              background: '#1a1a1a',
              foreground: '#e5e5e5',
              cursor: '#e5e5e5',
              cursorAccent: '#1a1a1a',
              selection: 'rgba(255, 255, 255, 0.3)',
              black: '#1e1e1e',
              red: '#cd3131',
              green: '#0dbc79',
              yellow: '#e5e510',
              blue: '#2472c8',
              magenta: '#bc3fbc',
              cyan: '#11a8cd',
              white: '#e5e5e5',
              brightBlack: '#666666',
              brightRed: '#f14c4c',
              brightGreen: '#23d18b',
              brightYellow: '#f5f543',
              brightBlue: '#3b8eea',
              brightMagenta: '#d670d6',
              brightCyan: '#29b8db',
              brightWhite: '#ffffff'
            },
            scrollback: 1000,
            allowProposedApi: true
          });
          
          // Initialize fit addon
          if (typeof FitAddon !== 'undefined') {
            fitAddon = new FitAddon.FitAddon();
            term.loadAddon(fitAddon);
          }
          
          term.open(terminalEl);
          
          // Fit terminal to container
          setTimeout(() => {
            if (fitAddon) {
              fitAddon.fit();
              sendMessage('resize', { cols: term.cols, rows: term.rows });
            }
          }, 100);
          
          // Handle user input
          term.onData((data) => {
            sendMessage('data', { data });
          });
          
          // Handle resize
          window.addEventListener('resize', () => {
            if (fitAddon && term) {
              fitAddon.fit();
              sendMessage('resize', { cols: term.cols, rows: term.rows });
            }
          });
          
          sendMessage('ready', { fallback: false, cols: term.cols, rows: term.rows });
        } catch (e) {
          sendMessage('error', { message: e.message });
          initFallback();
        }
      }
      
      // Wait for scripts to load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(initXterm, 100);
        });
      } else {
        setTimeout(initXterm, 100);
      }
      
      // Command handler from React Native
      window.handleCommand = function(command, args) {
        try {
          if (useFallback) {
            // Fallback mode
            switch (command) {
              case 'write':
                fallbackEl.textContent += args.data;
                fallbackEl.scrollTop = fallbackEl.scrollHeight;
                break;
              case 'clear':
                fallbackEl.textContent = '';
                break;
              case 'scrollToEnd':
                fallbackEl.scrollTop = fallbackEl.scrollHeight;
                break;
            }
            return;
          }
          
          if (!term) return;
          
          switch (command) {
            case 'write':
              term.write(args.data);
              break;
            case 'clear':
              term.clear();
              term.reset();
              break;
            case 'resize':
              if (args.cols && args.rows) {
                term.resize(args.cols, args.rows);
              } else if (fitAddon) {
                fitAddon.fit();
              }
              sendMessage('resize', { cols: term.cols, rows: term.rows });
              break;
            case 'scrollToEnd':
              term.scrollToBottom();
              break;
            case 'focus':
              term.focus();
              break;
            case 'blur':
              term.blur();
              break;
          }
        } catch (e) {
          sendMessage('error', { message: e.message, command });
        }
      };
    })();
  </script>
</body>
</html>
`;

export const XtermTerminal = forwardRef<XtermTerminalRef, XtermTerminalProps>(
  ({ initialContent = '', fontSize = 14, onData, onReady }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const pendingWrites = useRef<string[]>([]);

    const sendCommand = useCallback((command: string, args: Record<string, unknown> = {}) => {
      const script = `window.handleCommand && window.handleCommand('${command}', ${JSON.stringify(args)}); true;`;
      webViewRef.current?.injectJavaScript(script);
    }, []);

    const write = useCallback((data: string) => {
      if (!isReady) {
        pendingWrites.current.push(data);
        return;
      }
      sendCommand('write', { data });
    }, [isReady, sendCommand]);

    const clear = useCallback(() => {
      sendCommand('clear');
    }, [sendCommand]);

    const resize = useCallback((cols: number, rows: number) => {
      sendCommand('resize', { cols, rows });
    }, [sendCommand]);

    const scrollToEnd = useCallback(() => {
      sendCommand('scrollToEnd');
    }, [sendCommand]);

    useImperativeHandle(ref, () => ({
      write,
      clear,
      resize,
      scrollToEnd,
    }), [write, clear, resize, scrollToEnd]);

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        
        switch (message.type) {
          case 'ready':
            setIsReady(true);
            pendingWrites.current.forEach((data) => {
              sendCommand('write', { data });
            });
            pendingWrites.current = [];
            if (initialContent) {
              sendCommand('write', { data: initialContent });
            }
            onReady?.();
            break;
          case 'data':
            onData?.(message.payload.data);
            break;
          case 'resize':
            break;
          case 'error':
            console.warn('[XtermTerminal] Error:', message.payload.message);
            break;
        }
      } catch (e) {
        console.warn('[XtermTerminal] Failed to parse message:', e);
      }
    }, [initialContent, onData, onReady, sendCommand]);

    useEffect(() => {
      if (isReady && initialContent) {
        sendCommand('write', { data: initialContent });
      }
    }, [isReady, initialContent, sendCommand]);

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: getTerminalHtml(fontSize) }}
          style={styles.webview}
          originWhitelist={['*']}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          textInteractionEnabled={false}
          hideKeyboardAccessoryView={true}
          keyboardDisplayRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          mixedContentMode="compatibility"
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('[XtermTerminal] WebView error:', nativeEvent.description);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            if (nativeEvent.statusCode !== 200) {
              console.debug('[XtermTerminal] HTTP error (expected if offline):', nativeEvent.url);
            }
          }}
        />
      </View>
    );
  }
);

XtermTerminal.displayName = 'XtermTerminal';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default XtermTerminal;
