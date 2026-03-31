const mysql = require('mysql2/promise');
const config = require('../config-loader');

// Resolve DB config: config_private.json > env vars > defaults
// If no db config and no env vars with real credentials, db is disabled.
const dbConfig = config.db || {};
const resolvedConfig = {
  host: dbConfig.host || process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(dbConfig.port || process.env.MYSQL_PORT, 10) || 3306,
  user: dbConfig.user || process.env.MYSQL_USER || 'root',
  password: dbConfig.password || process.env.MYSQL_PASSWORD || '',
  database: dbConfig.database || process.env.MYSQL_DATABASE || 'tmuxweb',
};

// DB is considered "enabled" only if user explicitly configured it
// (either via config_private.json db section or MYSQL_* env vars)
const dbEnabled = !!(
  (config.db && config.db.host) ||
  process.env.MYSQL_HOST ||
  process.env.MYSQL_PASSWORD
);

let pool = null;

if (dbEnabled) {
  pool = mysql.createPool({
    ...resolvedConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  pool.on('error', (err) => {
    console.error('[DB Pool Error]', err.message);
  });

  console.log(`[DB] Pool created: ${resolvedConfig.host}:${resolvedConfig.port}/${resolvedConfig.database}`);
} else {
  console.log('[DB] No database configured — running without MySQL (task tracking disabled)');
}

async function testConnection() {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (err) {
    console.error('[DB Connection Test Failed]', err.message);
    return false;
  }
}

function getDbConfig() {
  return resolvedConfig;
}

module.exports = { pool, dbEnabled, testConnection, getDbConfig };
