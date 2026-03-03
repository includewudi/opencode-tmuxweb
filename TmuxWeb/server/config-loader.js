const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const configPath = path.join(__dirname, 'config.json');
const privatePath = path.join(__dirname, 'config_private.json');

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (fs.existsSync(privatePath)) {
  const privateConfig = JSON.parse(fs.readFileSync(privatePath, 'utf8'));
  config = deepMerge(config, privateConfig);
  console.log('[Config] Merged config_private.json');
} else {
  console.warn('[Config] No config_private.json found — using defaults from config.json');
}

// Auto-generate allowedOrigins from port/frontendPort + hosts
// If config explicitly sets allowedOrigins (non-empty array), use it as-is.
// Otherwise, build from: hosts list × [backendPort, frontendPort] × [http, https]
if (!config.allowedOrigins || config.allowedOrigins.length === 0) {
  const backendPort = config.port || 8215;
  const frontendPort = config.frontendPort || 5215;
  const hosts = config.hosts || ['localhost', '127.0.0.1'];
  const ports = [...new Set([backendPort, frontendPort])];
  const origins = [];
  for (const host of hosts) {
    for (const port of ports) {
      origins.push(`http://${host}:${port}`);
      origins.push(`https://${host}:${port}`);
    }
  }
  config.allowedOrigins = origins;
  console.log(`[Config] Auto-generated ${origins.length} allowedOrigins from hosts × ports`);
}

module.exports = config;
