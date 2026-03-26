const zlib = require('zlib');

function getConfig() {
  const url = (process.env.KBC_URL || '').replace(/\/$/, '');
  const token = process.env.KEBOOLA_TOKEN;
  if (!url || !token) throw new Error('KBC_URL and KEBOOLA_TOKEN must be set');
  return { url, token };
}

async function apiRequest(path, options = {}) {
  const { url, token } = getConfig();
  const fullUrl = `${url}/v2/storage${path}`;
  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'X-StorageApi-Token': token,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Storage API ${response.status}: ${text.substring(0, 300)}`);
  }
  return response.json();
}

async function waitForJob(jobId) {
  for (;;) {
    const job = await apiRequest(`/jobs/${jobId}`);
    if (job.status === 'success') return job;
    if (job.status === 'error' || job.status === 'cancelled') {
      throw new Error(`Storage job ${jobId} ${job.status}: ${job.error || 'unknown error'}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });
}

function rowsToCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  return lines.join('\n');
}

async function exportTable(tableId) {
  console.log(`[Storage API] Exporting table: ${tableId}`);
  const job = await apiRequest(`/tables/${encodeURIComponent(tableId)}/export-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'format=rfc',
  });

  const completed = await waitForJob(job.id);
  console.log(`[Storage API] Job results: ${JSON.stringify(completed.results)}`);

  // The URL may be directly on results.file, or we may need to fetch file details by ID
  let fileUrl = completed.results?.file?.url ?? completed.results?.url;
  if (!fileUrl) {
    const fileId = completed.results?.file?.id ?? completed.results?.id;
    if (!fileId) throw new Error(`No file URL or ID in export job results: ${JSON.stringify(completed.results)}`);
    const fileDetails = await apiRequest(`/files/${fileId}`);
    fileUrl = fileDetails.url;
    if (!fileUrl) throw new Error(`No URL in file details for file ${fileId}`);
  }

  const fileResp = await fetch(fileUrl);
  if (!fileResp.ok) throw new Error(`Failed to download export: ${fileResp.status}`);

  const buffer = Buffer.from(await fileResp.arrayBuffer());
  let csvText;
  try {
    csvText = zlib.gunzipSync(buffer).toString('utf-8');
  } catch {
    csvText = buffer.toString('utf-8');
  }

  const rows = parseCSV(csvText);
  console.log(`[Storage API] Exported ${rows.length} rows from ${tableId}`);
  return rows;
}

async function importTableIncremental(tableId, rows, primaryKeys) {
  console.log(`[Storage API] Importing ${rows.length} rows into ${tableId}`);
  const csv = rowsToCSV(rows);

  const formData = new FormData();
  formData.append('data', new Blob([csv], { type: 'text/csv' }), 'data.csv');
  formData.append('incremental', '1');
  for (const pk of primaryKeys) {
    formData.append('primaryKey[]', pk);
  }

  const job = await apiRequest(`/tables/${encodeURIComponent(tableId)}/import-async`, {
    method: 'POST',
    body: formData,
  });

  await waitForJob(job.id);
  console.log(`[Storage API] Import to ${tableId} complete`);
}

module.exports = { exportTable, importTableIncremental };
