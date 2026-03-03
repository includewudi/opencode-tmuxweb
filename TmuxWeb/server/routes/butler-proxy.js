const { Router } = require('express');
const http = require('http');

const router = Router();

const BUTLER_HOST = 'localhost';
const BUTLER_PORT = 9999;

// Proxy all requests: /api/butler/* → http://localhost:9999/api/*
router.all('/*', (req, res) => {
  // Strip /api/butler prefix — the wildcard captures the rest
  const targetPath = '/api' + req.url;

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
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[Butler Proxy] Error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Butler service unavailable', detail: err.message });
    }
  });

  // Pipe request body for POST/PUT/PATCH
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq, { end: true });
  } else {
    proxyReq.end();
  }
});

module.exports = router;
