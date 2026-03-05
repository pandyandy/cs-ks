const snowflake = require('snowflake-sdk');

snowflake.configure({
  logLevel: process.env.SNOWFLAKE_LOG_LEVEL || 'OFF',
  keepAlive: false,
});

// Single persistent connection — initialized once at startup and reused.
// On any query failure the connection is re-established and the query retried once.
let conn = null;
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

async function connect() {
  if (conn) {
    conn.destroy(() => {});
    conn = null;
  }

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
  const c = snowflake.createConnection(config);
  await c.connectAsync();
  conn = c;
  console.log('[Snowflake] Connected successfully');
}

function enqueueQuery(run) {
  const p = queryQueue.then(run, run);
  queryQueue = p.catch(() => {});
  return p;
}

async function executeQuery(query, binds) {
  return enqueueQuery(async () => {
    if (!conn) {
      await connect();
    }

    const runQuery = () => new Promise((resolve, reject) => {
      const opts = { sqlText: query };
      if (binds && binds.length > 0) {
        opts.binds = binds;
      }
      opts.complete = (err, _stmt, rows) => {
        if (err) {
          console.error('[Snowflake] Query error:', err.message, '| code:', err.code, '| sqlState:', err.sqlState);
          reject(err);
          return;
        }
        resolve(rows || []);
      };
      console.log(`[Snowflake] Executing: ${query.substring(0, 80)}...`);
      conn.execute(opts);
    });

    try {
      return await runQuery();
    } catch (err) {
      // Session dropped or connection went stale — reconnect once and retry
      console.warn('[Snowflake] Query failed, reconnecting and retrying:', err.message);
      conn = null;
      await connect();
      return await runQuery();
    }
  });
}

function mapJsonToSnowflakeType(jsonType) {
  if (jsonType === 'str') return 'VARCHAR(16777216)';
  if (jsonType === 'int') return 'NUMBER(38,0)';
  if (jsonType === 'datetime64[ns]') return 'TIMESTAMP_NTZ(9)';
  throw new Error(`Unsupported JSON type: ${jsonType}`);
}

module.exports = { executeQuery, connect, mapJsonToSnowflakeType };

