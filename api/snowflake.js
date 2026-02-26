const snowflake = require('snowflake-sdk');

snowflake.configure({ logLevel: 'OFF' });

function getPrivateKey() {
  const raw = process.env.SNOWFLAKE_PRIVATE_KEY;
  if (!raw) throw new Error('SNOWFLAKE_PRIVATE_KEY is not set');

  let pem = raw.replace(/\\n/g, '\n').trim();

  if (!pem.includes('-----BEGIN')) {
    const base64 = pem.replace(/\s+/g, '');
    const lines = base64.match(/.{1,64}/g) || [base64];
    pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
  }

  return pem;
}

async function getConnection() {
  const config = {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    authenticator: 'SNOWFLAKE_JWT',
    privateKey: getPrivateKey(),
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
  };

  console.log(`[Snowflake] Connecting as ${config.username} to ${config.account}`);

  const conn = snowflake.createConnection(config);
  await conn.connectAsync();
  console.log('[Snowflake] Connected successfully');
  return conn;
}

async function executeQuery(query, binds) {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    const opts = { sqlText: query };
    if (binds && binds.length > 0) {
      opts.binds = binds;
    }
    opts.complete = (err, _stmt, rows) => {
      if (err) {
        console.error('[Snowflake] Query error:', err.message);
        conn.destroy(() => {});
        reject(new Error(`Query failed: ${err.message}`));
        return;
      }
      conn.destroy(() => {});
      resolve(rows || []);
    };
    console.log(`[Snowflake] Executing: ${query.substring(0, 80)}...`);
    conn.execute(opts);
  });
}

function mapJsonToSnowflakeType(jsonType) {
  if (jsonType === 'str') return 'VARCHAR(16777216)';
  if (jsonType === 'int') return 'NUMBER(38,0)';
  if (jsonType === 'datetime64[ns]') return 'TIMESTAMP_NTZ(9)';
  throw new Error(`Unsupported JSON type: ${jsonType}`);
}

module.exports = { executeQuery, mapJsonToSnowflakeType };
