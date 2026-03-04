const snowflake = require('snowflake-sdk');

// Disable HTTP keep-alive: the SDK's agent caches TCP connections globally, and in
// containerized environments (Keboola) those connections get silently dropped by NAT/proxies.
// Reusing a dead TCP connection causes Snowflake to return 401/SESSION_TOKEN_INVALID,
// which the SDK surfaces as error 407002 "terminated connection".
snowflake.configure({
  logLevel: process.env.SNOWFLAKE_LOG_LEVEL || 'OFF',
  keepAlive: false,
});

// Serial queue — ensures only one query (and one connection) runs at a time.
// This prevents parallel connections which caused "terminated connection" loops in Keboola.
let queryQueue = Promise.resolve();

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

async function createFreshConnection() {
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

function enqueueQuery(run) {
  const p = queryQueue.then(run, run);
  // prevent a rejected promise from blocking the queue forever
  queryQueue = p.catch(() => {});
  return p;
}

async function executeQuery(query, binds) {
  return enqueueQuery(async () => {
    // Fresh connection per query — avoids stale sessions from idle connections
    // (Keboola's NAT drops idle TCP entries after ~30s, causing "terminated connection")
    const conn = await createFreshConnection();
    try {
      return await new Promise((resolve, reject) => {
        const opts = { sqlText: query };
        if (binds && binds.length > 0) {
          opts.binds = binds;
        }
        opts.complete = (err, _stmt, rows) => {
          if (err) {
            console.error('[Snowflake] Query error:', err.message, '| code:', err.code, '| sqlState:', err.sqlState);
            reject(new Error(`Query failed: ${err.message}`));
            return;
          }
          resolve(rows || []);
        };
        console.log(`[Snowflake] Executing: ${query.substring(0, 80)}...`);
        conn.execute(opts);
      });
    } finally {
      conn.destroy(() => {});
    }
  });
}

function mapJsonToSnowflakeType(jsonType) {
  if (jsonType === 'str') return 'VARCHAR(16777216)';
  if (jsonType === 'int') return 'NUMBER(38,0)';
  if (jsonType === 'datetime64[ns]') return 'TIMESTAMP_NTZ(9)';
  throw new Error(`Unsupported JSON type: ${jsonType}`);
}

module.exports = { executeQuery, mapJsonToSnowflakeType };
