const path = require('path');
const fs = require('fs');

// Load .env.local only when it exists (local dev). In Keboola, configuration
// comes from environment variables/secrets instead.
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: envPath });
}

const express = require('express');
const { exportTable, importTableIncremental } = require('./storageApi');

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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache — invalidated on every successful save
const cache = { data: null, at: 0 };

function invalidateCache() {
  cache.data = null;
  cache.at = 0;
}

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
    const tableId = process.env.KBC_SOURCE_TABLE_ID;
    if (!tableId) {
      return res.status(500).json({ error: 'KBC_SOURCE_TABLE_ID not configured' });
    }

    if (cache.data && Date.now() - cache.at < CACHE_TTL) {
      console.log('[API] Serving data from cache');
      return res.json({ data: cache.data });
    }

    const allRows = await exportTable(tableId);

    const data = allRows
      .filter((row) => DATA_COLUMNS.every((col) => col in row))
      .map((row) => {
        const picked = {};
        for (const col of DATA_COLUMNS) picked[col] = row[col] ?? '';

        const evaluation = picked.EVALUATION != null && picked.EVALUATION !== ''
          ? parseInt(picked.EVALUATION, 10)
          : null;
        const yearEval = evaluation != null ? `${picked.YEAR}-${evaluation}` : `${picked.YEAR}-NA`;

        return {
          ...picked,
          YEAR_EVALUATION: yearEval,
          DIRECT_MANAGER_EMAIL: (picked.DIRECT_MANAGER_EMAIL || '').toLowerCase(),
          EMAIL_ADDRESS: (picked.EMAIL_ADDRESS || '').toLowerCase(),
        };
      });

    data.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));

    cache.data = data;
    cache.at = Date.now();

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

    const tableId = process.env.KBC_SOURCE_TABLE_ID;
    if (!tableId) {
      return res.status(500).json({ error: 'KBC_SOURCE_TABLE_ID not configured' });
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

    await importTableIncremental(tableId, mergedRows, PK_COLUMNS);

    invalidateCache();

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

    const tableId = process.env.KBC_FILTER_TABLE_ID;
    if (!tableId) {
      return res.json({ filters: [], filterNames: [] });
    }

    const allRows = await exportTable(tableId);
    const filters = allRows
      .filter((row) => row.FILTER_CREATOR === userEmail)
      .map((row) => ({
        FILTER_NAME: row.FILTER_NAME,
        FILTER_CREATOR: row.FILTER_CREATOR,
        FILTERED_VALUES: row.FILTERED_VALUES,
      }));

    const filterNames = filters.map((f) => f.FILTER_NAME);
    res.json({ filters, filterNames });
  } catch (error) {
    console.error('GET /api/filters error:', error.message);
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

    const tableId = process.env.KBC_FILTER_TABLE_ID;
    if (!tableId) {
      return res.status(500).json({ error: 'KBC_FILTER_TABLE_ID not configured' });
    }

    const filterRow = {
      FILTER_NAME: filterName,
      FILTER_CREATOR: userEmail,
      FILTERED_VALUES: JSON.stringify(filterModel || {}),
    };

    await importTableIncremental(tableId, [filterRow], ['FILTER_NAME', 'FILTER_CREATOR']);

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/filters error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', async (_req, res) => {
  const kbcUrl = process.env.KBC_URL;
  const kbcToken = process.env.KEBOOLA_TOKEN;

  let storageStatus = 'unchecked';
  if (kbcUrl && kbcToken) {
    try {
      const response = await fetch(`${kbcUrl.replace(/\/$/, '')}/v2/storage/`, {
        headers: { 'X-StorageApi-Token': kbcToken },
      });
      storageStatus = response.ok ? 'ok' : `error (${response.status})`;
    } catch (err) {
      storageStatus = `error: ${err.message}`;
    }
  }

  res.json({
    status: 'ok',
    storageApi: {
      url: kbcUrl ? 'set' : 'missing',
      token: kbcToken ? 'set' : 'missing',
      connection: storageStatus,
      sourceTable: process.env.KBC_SOURCE_TABLE_ID || 'missing',
      filterTable: process.env.KBC_FILTER_TABLE_ID || 'missing',
    },
    cache: {
      hasData: !!cache.data,
      ageSeconds: cache.at ? Math.round((Date.now() - cache.at) / 1000) : null,
    },
  });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[API] Server running on http://127.0.0.1:${PORT}`);
  console.log(`[API] KBC_URL=${process.env.KBC_URL || '(not set)'}`);
  console.log(`[API] KEBOOLA_TOKEN=${process.env.KEBOOLA_TOKEN ? '(set)' : '(not set)'}`);
  console.log(`[API] KBC_SOURCE_TABLE_ID=${process.env.KBC_SOURCE_TABLE_ID || '(not set)'}`);
  console.log(`[API] KBC_FILTER_TABLE_ID=${process.env.KBC_FILTER_TABLE_ID || '(not set)'}`);
});
