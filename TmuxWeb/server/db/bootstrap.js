#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SCHEMA_PATH = path.join(__dirname, 'init.sql');

async function bootstrap() {
  const config = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'tmuxweb',
    multipleStatements: true
  };

  console.log(`[Bootstrap] Connecting to MySQL at ${config.host}:${config.port}/${config.database}`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('[Bootstrap] Connected successfully');

    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found: ${SCHEMA_PATH}`);
    }

    let schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    schema = schema.replace(/CREATE TABLE `/g, 'CREATE TABLE IF NOT EXISTS `');

    console.log('[Bootstrap] Executing schema...');
    await connection.query(schema);
    console.log('[Bootstrap] Schema executed successfully');

  } catch (err) {
    console.error('[Bootstrap] Error:', err.message);
    process.exit(1);
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
