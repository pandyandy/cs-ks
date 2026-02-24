const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const express = require('express');
const { executeQuery, mapJsonToSnowflakeType } = require('./snowflake');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));

const expectedSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'expectedSchema.json'), 'utf-8')
);

const DATA_COLUMNS = [
  'USER_ID', 'YEAR', 'EVALUATION', 'LOGIN', 'USERNAME', 'EMAIL_ADDRESS',
  'DIRECT_MANAGER_EMAIL', 'FULL_NAME', 'JOB_TITLE_CZ', 'DIRECT_MANAGER_FULL_NAME',
  'LAST_EVALUATION', 'VYKON_PREVIOUS', 'HODNOTY_PREVIOUS', 'POTENCIAL_PREVIOUS',
  'VYKON_SYSTEM', 'HODNOTY_SYSTEM', 'IS_LOCKED', 'VYKON', 'HODNOTY', 'POTENCIAL',
  'PRAVDEPODOBNOST_ODCHODU', 'NASTUPCE', 'MOZNY_KARIERNI_POSUN', 'POZNAMKY',
  'LOCKED_TIMESTAMP', 'HIST_DATA_MODIFIED_WHEN', 'HIST_DATA_MODIFIED_BY',
  'JOB_ENTRY_DATE', 'TM_DATE', 'L2_ORGANIZATION_UNIT_NAME_CZ',
  'L3_ORGANIZATION_UNIT_NAME_CZ', 'L4_ORGANIZATION_UNIT_NAME_CZ', 'TEAM_CODE',
  'L2_HEAD_OF_UNIT_FULL_NAME', 'L3_HEAD_OF_UNIT_FULL_NAME',
  'L4_HEAD_OF_UNIT_FULL_NAME', 'MES_DPP_STATUS',
];

const PK_COLUMNS = ['USER_ID', 'YEAR', 'EVALUATION'];
const COLUMNS_TO_UPDATE = [
  'HODNOTY', 'VYKON', 'POTENCIAL', 'POZNAMKY', 'NASTUPCE',
  'PRAVDEPODOBNOST_ODCHODU', 'IS_LOCKED', 'MOZNY_KARIERNI_POSUN',
  'LOCKED_TIMESTAMP', 'HIST_DATA_MODIFIED_BY', 'HIST_DATA_MODIFIED_WHEN',
];
const DEFAULT_TIMESTAMP = '1970-01-01 00:00:00.000';

function formatTimestamp(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return DEFAULT_TIMESTAMP;
  }
  return String(value);
}

function buildMergedRow(changedRow, originalRow, userEmail) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 23);
  const merged = { ...originalRow, ...changedRow };

  merged.HIST_DATA_MODIFIED_BY = userEmail;
  merged.HIST_DATA_MODIFIED_WHEN = now;

  for (const col of COLUMNS_TO_UPDATE) {
    if (merged[col] == null && originalRow[col] != null) {
      merged[col] = originalRow[col];
    }
  }

  for (const col of ['IS_LOCKED', 'HODNOTY', 'VYKON']) {
    merged[col] = parseInt(merged[col], 10) || 0;
  }

  const lockedTs = formatTimestamp(merged.LOCKED_TIMESTAMP);
  if (
    merged.IS_LOCKED === 1 &&
    (lockedTs === '' || lockedTs === DEFAULT_TIMESTAMP ||
      lockedTs === '1970-01-01 00:00:00' || lockedTs === '1970-01-01 00:00:00.000000')
  ) {
    merged.LOCKED_TIMESTAMP = now;
  }

  for (const [col, dtype] of Object.entries(expectedSchema)) {
    if (merged[col] == null) {
      if (dtype.includes('datetime')) merged[col] = DEFAULT_TIMESTAMP;
      else if (dtype === 'str') merged[col] = '';
      else merged[col] = 0;
    } else {
      if (dtype === 'str') merged[col] = String(merged[col]);
      else if (dtype.includes('int')) merged[col] = parseInt(merged[col], 10) || 0;
      else if (dtype.includes('datetime')) merged[col] = formatTimestamp(merged[col]);
    }
  }

  delete merged.YEAR_EVALUATION;
  return merged;
}

// GET /api/data
app.get('/api/data', async (_req, res) => {
  try {
    const tableId = process.env.WORKSPACE_SOURCE_TABLE_ID;
    if (!tableId) {
      return res.status(500).json({ error: 'WORKSPACE_SOURCE_TABLE_ID not configured' });
    }

    const colList = DATA_COLUMNS.map((c) => `"${c}"`).join(', ');
    const rows = await executeQuery(`SELECT ${colList} FROM "${tableId}"`);

    const data = rows.map((row) => {
      const evaluation = row.EVALUATION != null ? parseInt(row.EVALUATION, 10) : null;
      const yearEval = evaluation != null ? `${row.YEAR}-${evaluation}` : `${row.YEAR}-NA`;
      return {
        ...row,
        YEAR_EVALUATION: yearEval,
        DIRECT_MANAGER_EMAIL: (row.DIRECT_MANAGER_EMAIL || '').toLowerCase(),
        EMAIL_ADDRESS: (row.EMAIL_ADDRESS || '').toLowerCase(),
      };
    });

    data.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
    res.json({ data });
  } catch (error) {
    console.error('GET /api/data error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/data/save
app.post('/api/data/save', async (req, res) => {
  try {
    const { changedRows, originalData, userEmail } = req.body;

    if (!changedRows?.length) {
      return res.status(400).json({ error: 'No changes to save' });
    }

    const originalLookup = {};
    for (const row of originalData) {
      const key = `${row.USER_ID}_${row.YEAR}_${row.EVALUATION}`;
      originalLookup[key] = row;
    }

    const mergedRows = changedRows.map((changed) => {
      const key = `${changed.USER_ID}_${changed.YEAR}_${changed.EVALUATION}`;
      const original = originalLookup[key] || {};
      return buildMergedRow(changed, original, userEmail);
    });

    const tableName = process.env.WORKSPACE_SOURCE_TABLE_ID;
    const sanitizedEmail = userEmail.replace('@', '_').replace(/\./g, '_');
    const tempTableName = `TEMP_STAGING_${sanitizedEmail}_${uuidv4().replace(/-/g, '')}`;

    const schemaCols = Object.entries(expectedSchema)
      .map(([col, dtype]) => `"${col}" ${mapJsonToSnowflakeType(dtype)}`)
      .join(',\n');
    await executeQuery(`CREATE OR REPLACE TRANSIENT TABLE "${tempTableName}" (\n${schemaCols}\n);`);

    const schemaKeys = Object.keys(expectedSchema);
    for (const row of mergedRows) {
      const values = schemaKeys.map((col) => {
        const val = row[col];
        if (val == null) return 'NULL';
        if (typeof val === 'number') return val;
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      const insertSql = `INSERT INTO "${tempTableName}" (${schemaKeys.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')})`;
      await executeQuery(insertSql);
    }

    const setClauses = COLUMNS_TO_UPDATE.map((col) => `target."${col}" = source."${col}"`).join(', ');
    const whereClauses = PK_COLUMNS.map((col) => `target."${col}" = source."${col}"`).join(' AND ');
    const updateSql = `UPDATE "${tableName}" AS target SET ${setClauses} FROM "${tempTableName}" AS source WHERE ${whereClauses};`;
    await executeQuery(updateSql);

    await executeQuery(`DROP TABLE IF EXISTS "${tempTableName}";`);

    res.json({ success: true, rowsUpdated: mergedRows.length });
  } catch (error) {
    console.error('POST /api/data/save error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/filters
app.get('/api/filters', async (req, res) => {
  try {
    const userEmail = req.query.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const tableId = process.env.WORKSPACE_FILTER_TABLE_ID;
    if (!tableId) {
      return res.json({ filters: [], filterNames: [] });
    }

    const rows = await executeQuery(
      `SELECT "FILTER_NAME", "FILTER_CREATOR", "FILTERED_VALUES" FROM "${tableId}" WHERE "FILTER_CREATOR" = ?`,
      [userEmail]
    );

    const filters = rows.map((row) => ({
      FILTER_NAME: row.FILTER_NAME,
      FILTER_CREATOR: row.FILTER_CREATOR,
      FILTERED_VALUES: row.FILTERED_VALUES,
    }));
    const filterNames = filters.map((f) => f.FILTER_NAME);

    res.json({ filters, filterNames });
  } catch {
    res.json({ filters: [], filterNames: [] });
  }
});

// POST /api/filters
app.post('/api/filters', async (req, res) => {
  try {
    const { userEmail, filterName, filterModel } = req.body;

    if (!userEmail || !filterName) {
      return res.status(400).json({ error: 'Email and filter name are required' });
    }

    const tableId = process.env.WORKSPACE_FILTER_TABLE_ID;
    if (!tableId) {
      return res.status(500).json({ error: 'WORKSPACE_FILTER_TABLE_ID not configured' });
    }

    const filterModelJson = JSON.stringify(filterModel || {});
    const mergeQuery = `
      MERGE INTO "${tableId}" AS target
      USING (
        SELECT '${filterName.replace(/'/g, "''")}' AS FILTER_NAME,
               '${userEmail.replace(/'/g, "''")}' AS FILTER_CREATOR,
               '${filterModelJson.replace(/'/g, "''")}' AS FILTERED_VALUES
      ) AS source
      ON target."FILTER_NAME" = source.FILTER_NAME AND target."FILTER_CREATOR" = source.FILTER_CREATOR
      WHEN MATCHED THEN UPDATE SET target."FILTERED_VALUES" = source.FILTERED_VALUES
      WHEN NOT MATCHED THEN INSERT ("FILTER_NAME", "FILTER_CREATOR", "FILTERED_VALUES")
      VALUES (source.FILTER_NAME, source.FILTER_CREATOR, source.FILTERED_VALUES)
    `;
    await executeQuery(mergeQuery);

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/filters error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    snowflake: {
      account: process.env.SNOWFLAKE_ACCOUNT ? 'set' : 'missing',
      user: process.env.SNOWFLAKE_USER ? 'set' : 'missing',
      privateKey: process.env.SNOWFLAKE_PRIVATE_KEY ? 'set' : 'missing',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE ? 'set' : 'missing',
      database: process.env.SNOWFLAKE_DATABASE ? 'set' : 'missing',
      schema: process.env.SNOWFLAKE_SCHEMA ? 'set' : 'missing',
      sourceTable: process.env.WORKSPACE_SOURCE_TABLE_ID || 'missing',
      filterTable: process.env.WORKSPACE_FILTER_TABLE_ID || 'missing',
    },
  });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[API] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[API] SNOWFLAKE_ACCOUNT=${process.env.SNOWFLAKE_ACCOUNT || '(not set)'}`);
  console.log(`[API] SNOWFLAKE_USER=${process.env.SNOWFLAKE_USER || '(not set)'}`);
  console.log(`[API] SNOWFLAKE_PRIVATE_KEY=${process.env.SNOWFLAKE_PRIVATE_KEY ? '(set, ' + process.env.SNOWFLAKE_PRIVATE_KEY.length + ' chars)' : '(not set)'}`);
  console.log(`[API] WORKSPACE_SOURCE_TABLE_ID=${process.env.WORKSPACE_SOURCE_TABLE_ID || '(not set)'}`);
  console.log(`[API] WORKSPACE_FILTER_TABLE_ID=${process.env.WORKSPACE_FILTER_TABLE_ID || '(not set)'}`);
});
