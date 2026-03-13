const { Router } = require('express');
const http = require('http');
const config = require('../config-loader');

const router = Router();

const BUTLER_HOST = config.butler?.host || 'localhost';
const BUTLER_PORT = config.butler?.port || 9999;

function log(tag, data) {
  const ts = new Date().toISOString();
  console.log(`[Butler Proxy] [${ts}] [${tag}]`, typeof data === 'string' ? data : JSON.stringify(data));
}

// Detect SSE requests (Accept: text/event-stream)
function isSSE(req) {
  return (req.headers.accept || '').includes('text/event-stream');
}

// SSE passthrough: pipe Butler SSE directly to client without buffering
function proxySSE(req, res, targetPath) {
  const startTime = Date.now();
  const reqBody = req.body;
  log('SSE-REQ', { method: req.method, path: targetPath, body: reqBody });

  const options = {
    hostname: BUTLER_HOST,
    port: BUTLER_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      'content-type': 'application/json',
      'accept': 'text/event-stream',
      host: `${BUTLER_HOST}:${BUTLER_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    log('SSE-CONNECT', { path: targetPath, status: proxyRes.statusCode });

    // Pass through headers — ensure no buffering
    res.writeHead(proxyRes.statusCode, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',  // nginx passthrough
    });

    // Pipe SSE stream directly (no buffering for logging)
    proxyRes.on('data', (chunk) => {
      res.write(chunk);
      // Flush immediately for real-time streaming
      if (typeof res.flush === 'function') res.flush();
    });

    proxyRes.on('end', () => {
      const elapsed = Date.now() - startTime;
      log('SSE-END', { path: targetPath, ms: elapsed });
      res.end();
    });
  });

  proxyReq.on('error', (err) => {
    const elapsed = Date.now() - startTime;
    log('SSE-ERR', { path: targetPath, error: err.message, ms: elapsed });
    if (!res.headersSent) {
      res.status(502).json({ error: 'Butler SSE unavailable', detail: err.message });
    } else {
      res.end();
    }
  });

  // Send body
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyStr = JSON.stringify(req.body);
    proxyReq.setHeader('content-length', Buffer.byteLength(bodyStr));
    proxyReq.end(bodyStr);
  } else {
    proxyReq.end();
  }
}

// Proxy all requests: /api/butler/* → http://localhost:9999/api/*
router.all('/*', (req, res) => {
  const startTime = Date.now();
  // Strip /api/butler prefix — the wildcard captures the rest
  const targetPath = '/api' + req.url;

  // SSE requests get special handling (no buffering)
  if (isSSE(req)) {
    return proxySSE(req, res, targetPath);
  }

  // --- Log incoming request ---
  const reqBody = (req.method !== 'GET' && req.method !== 'HEAD') ? req.body : undefined;
  log('REQ', {
    method: req.method,
    path: targetPath,
    body: reqBody,
    from: req.ip || req.connection?.remoteAddress,
  });

  const options = {
    hostname: BUTLER_HOST,
    port: BUTLER_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${BUTLER_HOST}:${BUTLER_PORT}`,
    },
  };
  // Remove hop-by-hop headers
  delete options.headers['connection'];
  delete options.headers['transfer-encoding'];

  const proxyReq = http.request(options, (proxyRes) => {
    // --- Collect response body for logging ---
    const chunks = [];
    proxyRes.on('data', (chunk) => chunks.push(chunk));
    proxyRes.on('end', () => {
      const elapsed = Date.now() - startTime;
      const resBody = Buffer.concat(chunks).toString('utf-8');
      let parsed;
      try { parsed = JSON.parse(resBody); } catch { parsed = resBody; }

      log('RES', {
        method: req.method,
        path: targetPath,
        status: proxyRes.statusCode,
        body: parsed,
        ms: elapsed,
      });
    });

    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    const elapsed = Date.now() - startTime;
    log('ERR', {
      method: req.method,
      path: targetPath,
      error: err.message,
      ms: elapsed,
    });
    if (!res.headersSent) {
      res.status(502).json({ error: 'Butler service unavailable', detail: err.message });
    }
  });

  // express.json() consumes the raw stream — req.pipe() would send empty body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyStr = JSON.stringify(req.body);
      proxyReq.setHeader('content-length', Buffer.byteLength(bodyStr));
      log('FWD', { method: req.method, path: targetPath, bodyLen: bodyStr.length });
      proxyReq.end(bodyStr);
    } else {
      log('FWD', { method: req.method, path: targetPath, bodyLen: 0, note: 'empty body' });
      proxyReq.end();
    }
  } else {
    proxyReq.end();
  }
});

module.exports = router;
