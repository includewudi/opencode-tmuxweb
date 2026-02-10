# WebSocket "RSV1 must be clear" / "Invalid frame header" Error

## Problem

When using multiple `WebSocketServer` instances sharing the same HTTP server in Node.js with the `ws` library, WebSocket connections fail with:

```
Error: Invalid WebSocket frame: RSV1 must be clear
```

or

```
Error: Invalid frame header
```

## Root Cause

The `ws` library (v8.x+) has issues when multiple `WebSocketServer` instances are attached to the same HTTP server using the `path` option. Both instances register their own `upgrade` event handlers, causing:

1. Race conditions in upgrade handling
2. Frame header corruption
3. RSV1 bit being incorrectly set (compression flag)

### Problematic Code Pattern

```javascript
const server = http.createServer(app);

// ❌ WRONG: Multiple WebSocketServer with path option
const wss1 = new WebSocketServer({ server, path: '/ws/terminal', perMessageDeflate: false });
const wss2 = new WebSocketServer({ server, path: '/ws/speech', perMessageDeflate: false });
```

## Solution

Use `noServer: true` and manually handle the HTTP upgrade event:

```javascript
const server = http.createServer(app);

// ✅ CORRECT: Use noServer mode
const terminalWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const speechWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

// Manually route WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  
  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/speech') {
    speechWss.handleUpgrade(request, socket, head, (ws) => {
      speechWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
```

## Verification

Test with single WebSocketServer (works):
```javascript
const wss = new WebSocketServer({ server, path: '/ws/terminal', perMessageDeflate: false });
// ✅ Works fine
```

Test with two WebSocketServers sharing server (fails):
```javascript
const wss1 = new WebSocketServer({ server, path: '/ws/terminal', perMessageDeflate: false });
const wss2 = new WebSocketServer({ server, path: '/ws/speech', perMessageDeflate: false });
// ❌ Causes "RSV1 must be clear" error
```

## Debugging Symptoms

1. WebSocket connects successfully (`onopen` fires)
2. First data packet triggers error immediately
3. Error occurs only when PTY or other data source sends data
4. Single WebSocketServer works; multiple fail
5. Error message mentions RSV1, RSV2, RSV3, or "Invalid frame header"

## Related Resources

- [ws GitHub Issue #1353 - Supporting multiple instances on single HTTP server](https://github.com/websockets/ws/issues/1353)
- [StackOverflow - handleUpgrade() called more than once](https://stackoverflow.com/questions/63552689/how-to-deal-with-server-handleupgrade-was-called-more-than-once-in-nodejs)
- [ws README - External HTTP/S server](https://github.com/websockets/ws#external-https-server)

## Environment

- ws library: v8.x+
- Node.js: v18+
- Discovered: 2025-02-09

## Tags

`websocket` `ws` `node-pty` `RSV1` `Invalid frame header` `multiple WebSocketServer` `noServer` `handleUpgrade`
