const { dbEnabled } = require('../db/pool');

/**
 * Middleware that returns 503 when database is not configured.
 * Apply to all routes that require MySQL.
 */
function requireDb(req, res, next) {
  if (!dbEnabled) {
    return res.status(503).json({
      error: 'database_not_configured',
      message: 'This feature requires MySQL. Configure db in config_private.json.'
    });
  }
  next();
}

module.exports = { requireDb };
