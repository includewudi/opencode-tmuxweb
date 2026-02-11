/**
 * Config loader — merges config.json with config_private.json.
 * config_private.json overrides config.json for any matching keys.
 * Sensitive credentials should go in config_private.json (not committed).
 */
const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function loadConfig() {
    const publicPath = path.join(__dirname, '../TmuxWeb/server/config.json');
    const privatePath = path.join(__dirname, 'config_private.json');

    let config = {};

    // Load public config
    try {
        config = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    } catch (e) {
        console.warn('[Config] No config.json found:', e.message);
    }

    // Merge private config (overrides public)
    try {
        if (fs.existsSync(privatePath)) {
            const priv = JSON.parse(fs.readFileSync(privatePath, 'utf8'));
            deepMerge(config, priv);
            console.log('[Config] Loaded config_private.json ✓');
        }
    } catch (e) {
        console.warn('[Config] Error loading config_private.json:', e.message);
    }

    return config;
}

module.exports = loadConfig();
