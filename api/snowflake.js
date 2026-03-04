const snowflake = require('snowflake-sdk');

snowflake.configure({
  logLevel: process.env.SNOWFLAKE_LOG_LEVEL || 'OFF',
  keepAlive: false,
});

// Single persistent connection — initialized once at startup and reused.
// A keepalive ping runs every 3 minutes to prevent the session from expiring.
let conn = null;
let keepAliveTimer = null;
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
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
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

  // Keepalive: ping every 3 minutes so the session doesn't go idle
  keepAliveTimer = setInterval(() => {
    if (!conn) return;
    conn.execute({
      sqlText: 'SELECT 1',
      complete: (err) => {
        if (err) {
          console.warn('[Snowflake] Keepalive ping failed — will reconnect on next query:', err.message);
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          keepAliveTimer = null;
          conn = null;
        } else {
          console.log('[Snowflake] Keepalive OK');
        }
      },
    });
  }, 3 * 60 * 1000);
}

function enqueueQuery(run) {
  const p = queryQueue.then(run, run);
  queryQueue = p.catch(() => {});
  return p;
}

async function executeQuery(query, binds) {
  return enqueueQuery(async () => {
    // Reconnect if the session was dropped
    if (!conn) {
      await connect();
    }

    return new Promise((resolve, reject) => {
      const opts = { sqlText: query };
      if (binds && binds.length > 0) {
        opts.binds = binds;
      }
      opts.complete = (err, _stmt, rows) => {
        if (err) {
          console.error('[Snowflake] Query error:', err.message, '| code:', err.code, '| sqlState:', err.sqlState);
          // Mark connection as dead so the next query reconnects
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          keepAliveTimer = null;
          conn = null;
          reject(new Error(`Query failed: ${err.message}`));
          return;
        }
        resolve(rows || []);
      };
      console.log(`[Snowflake] Executing: ${query.substring(0, 80)}...`);
      conn.execute(opts);
    });
  });
}

function mapJsonToSnowflakeType(jsonType) {
  if (jsonType === 'str') return 'VARCHAR(16777216)';
  if (jsonType === 'int') return 'NUMBER(38,0)';
  if (jsonType === 'datetime64[ns]') return 'TIMESTAMP_NTZ(9)';
  throw new Error(`Unsupported JSON type: ${jsonType}`);
}

module.exports = { executeQuery, connect, mapJsonToSnowflakeType };
