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

module.exports = config;
