const snowflake = require('snowflake-sdk');
const crypto = require('crypto');
const fs = require('fs');

let connection = null;

function getPrivateKey() {
  const raw = process.env.SNOWFLAKE_PRIVATE_KEY;
  if (!raw) throw new Error('SNOWFLAKE_PRIVATE_KEY is not set');

  let pem = raw;
  if (!pem.includes('-----BEGIN')) {
    pem = `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
  }

  const key = crypto.createPrivateKey({
    key: pem,
    format: 'pem',
  });

  return key.export({ type: 'pkcs8', format: 'der' });
}

function getConnectionConfig() {
  return {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    authenticator: 'SNOWFLAKE_JWT',
    privateKey: getPrivateKey(),
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
  };
}

function getConnection() {
  return new Promise((resolve, reject) => {
    if (connection && connection.isUp()) {
      resolve(connection);
      return;
    }

    const conn = snowflake.createConnection(getConnectionConfig());
    conn.connect((err, c) => {
      if (err) {
        reject(new Error(`Snowflake connection failed: ${err.message}`));
        return;
      }
      connection = c;
      resolve(c);
    });
  });
}

async function executeQuery(query, binds = []) {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: query,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(new Error(`Query failed: ${err.message}`));
          return;
        }
        resolve(rows || []);
      },
    });
  });
}

function mapJsonToSnowflakeType(jsonType) {
  if (jsonType === 'str') return 'VARCHAR(16777216)';
  if (jsonType === 'int') return 'NUMBER(38,0)';
  if (jsonType === 'datetime64[ns]') return 'TIMESTAMP_NTZ(9)';
  throw new Error(`Unsupported JSON type: ${jsonType}`);
}

module.exports = { executeQuery, mapJsonToSnowflakeType };
