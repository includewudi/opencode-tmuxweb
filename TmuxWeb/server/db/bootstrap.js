#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getDbConfig, dbEnabled } = require('./pool');

const SCHEMA_PATH = path.join(__dirname, 'init.sql');

async function bootstrap() {
  if (!dbEnabled) {
    console.log('[Bootstrap] Database not configured, skipping table creation');
    return;
  }

  const dbConf = getDbConfig();
  const connConfig = {
    ...dbConf,
    multipleStatements: true
  };

  console.log(`[Bootstrap] Connecting to MySQL at ${connConfig.host}:${connConfig.port}/${connConfig.database}`);

  let connection;
  try {
    connection = await mysql.createConnection(connConfig);
    console.log('[Bootstrap] Connected successfully');

    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found: ${SCHEMA_PATH}`);
    }

    let schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    schema = schema.replace(/CREATE TABLE `/g, 'CREATE TABLE IF NOT EXISTS `');

    console.log('[Bootstrap] Executing schema...');
    await connection.query(schema);
    console.log('[Bootstrap] Schema executed successfully — all tables ready');

  } catch (err) {
    console.error('[Bootstrap] Error:', err.message);
    // Don't exit process — let server continue in degraded mode
  } finally {
    if (connection) {
      await connection.end();
      console.log('[Bootstrap] Connection closed');
    }
  }
}

if (require.main === module) {
  bootstrap();
}

module.exports = { bootstrap };
