const snowflake = require('snowflake-sdk');

let connection = null;

function getConnectionConfig() {
  return {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
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
