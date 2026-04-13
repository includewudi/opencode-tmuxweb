/**
 * cli-history-sdk — Unified entry point
 *
 * Exports:
 *   - createProvider(type, opts)  — create a provider instance by type
 *   - createRouter(opts)         — create an Express router (re-export from express-plugin)
 *
 * @example
 * // Pure API usage
 * const { createProvider } = require('cli-history-sdk');
 * const provider = createProvider('opencode', { dbPath: '/path/to/opencode.db' });
 * const { sessions } = provider.listSessions({ limit: 20 });
 */
const { createOpenCodeProvider } = require('./providers/opencode');

/**
 * Create a CLI history provider by type.
 * @param {string} type - Provider type (e.g. 'opencode')
 * @param {object} [opts] - Provider options (e.g. { dbPath })
 * @returns {object} Provider instance
 */
function createProvider(type, opts = {}) {
  switch (type) {
    case 'opencode':
      return createOpenCodeProvider(opts);
    default:
      throw new Error(`Unknown provider type: "${type}"`);
  }
}

// Re-export Express plugin for convenience
const { createRouter } = require('./express-plugin');

module.exports = {
  createProvider,
  createRouter,
};
