const path = require('path');
const fs = require('fs');

// Load config: config_private.json overrides config.json
const baseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'server/config.json'), 'utf8'));
let config = { ...baseConfig };
try {
  const privateConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'server/config_private.json'), 'utf8'));
  config = { ...baseConfig, ...privateConfig };
} catch (e) {
  // config_private.json is optional
}

const frontendPort = config.frontendPort || 5215;
const envName = config.envName || 'prod';

module.exports = {
  apps: [
    {
      name: `tmuxweb-${envName}-backend`,
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      kill_timeout: 5000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: `tmuxweb-${envName}-frontend`,
      script: 'node_modules/.bin/vite',
      args: `preview --port ${frontendPort} --host`,
      cwd: __dirname + '/web',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      kill_timeout: 3000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
