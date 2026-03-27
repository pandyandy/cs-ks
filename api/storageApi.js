const fs = require('fs');
const { gunzipSync } = require('zlib');

const KEBOOLA_URL = (process.env.KBC_URL || '').replace(/\/$/, '');
const TOKEN = process.env.KEBOOLA_TOKEN;
const INPUT_TABLES_DIR = process.env.KBC_DATADIR
  ? `${process.env.KBC_DATADIR}/in/tables`
  : '/data/in/tables';

// ==================== HTTP HELPERS ====================

async function fetchWithRetry(url, opts, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`  fetch failed (attempt ${i + 1}/${retries}): ${e.message} — retrying in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function kbcGet(path) {
  const res = await fetchWithRetry(`${KEBOOLA_URL}/v2/storage${path}`, {
    headers: { 'X-StorageApi-Token': TOKEN },
  });
  if (!res.ok) throw new Error(`Keboola GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function kbcPost(path, params) {
  const res = await fetchWithRetry(`${KEBOOLA_URL}/v2/storage${path}`, {
    method: 'POST',
    headers: {
      'X-StorageApi-Token': TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`Keboola POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pollJob(jobId, label) {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const job = await kbcGet(`/jobs/${jobId}`);
    console.log(`  [${label}] job ${jobId} → ${job.status} (${i * 2}s)`);
    if (job.status === 'success') return job;
    if (job.status === 'error') throw new Error(`Job ${jobId} failed: ${JSON.stringify(job.error)}`);
  }
  throw new Error(`Job ${jobId} timed out`);
}

// ==================== CSV HELPERS ====================

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
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

function rowsToCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');
}

// ==================== EXPORT ====================

async function exportTable(tableId) {
  const tableName = tableId.split('.').pop();
  const filePath = `${INPUT_TABLES_DIR}/${tableName}.csv`;

  // In Keboola: read from Input Mapping (pre-loaded before app starts)
  if (fs.existsSync(filePath)) {
    console.log(`  [${tableName}] reading from input mapping: ${filePath}`);
    const csvText = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(csvText);
    console.log(`  [${tableName}] ${rows.length} rows`);
    return rows;
  }

  // Local dev fallback: fetch via Storage API
  console.log(`  [${tableName}] ${filePath} not found — falling back to Storage API export`);
  if (!KEBOOLA_URL || !TOKEN) throw new Error(`${filePath} not found and KBC_URL/KEBOOLA_TOKEN not set`);

  const job = await kbcPost(`/tables/${tableId}/export-async`, { format: 'rfc' });
  console.log(`  [${tableName}] job ${job.id} created, polling…`);
  const result = await pollJob(job.id, tableName);

  const fileId = result.results?.file?.id || result.file?.id;
  if (!fileId) throw new Error(`No file ID for ${tableId}: ${JSON.stringify(result.results)}`);

  const fileInfo = await kbcGet(`/files/${fileId}?federationToken=1`);
  console.log(`  [${tableName}] provider=${fileInfo.provider}, isSliced=${fileInfo.isSliced}`);

  let csvText;
  if (!fileInfo.isSliced) {
    const res = await fetchWithRetry(fileInfo.url);
    if (!res.ok) throw new Error(`File download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    try { csvText = gunzipSync(buf).toString('utf-8'); } catch { csvText = buf.toString('utf-8'); }
  } else {
    const creds = fileInfo.credentials || {};
    const sas = creds.SASToken || creds.sas
      || (() => { const m = (creds.SASConnectionString || '').match(/SharedAccessSignature=(.+)/); return m?.[1]; })()
      || (() => { try { const u = new URL(fileInfo.url); return u.search ? u.search.slice(1) : ''; } catch { return ''; } })();

    const manifestRes = await fetchWithRetry(fileInfo.url);
    if (!manifestRes.ok) throw new Error(`Manifest download failed: ${manifestRes.status}`);
    const manifest = JSON.parse(await manifestRes.text());
    const parts = await Promise.all((manifest.entries || []).map(async (entry, i) => {
      const url = entry.url.replace(/^azure:\/\//, 'https://');
      const r = await fetchWithRetry(sas ? `${url}?${sas}` : url);
      if (!r.ok) throw new Error(`Slice ${i} failed: ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      try { return gunzipSync(buf).toString('utf-8'); } catch { return buf.toString('utf-8'); }
    }));
    csvText = parts[0] + parts.slice(1).map((p) => { const nl = p.indexOf('\n'); return nl === -1 ? '' : p.slice(nl + 1); }).join('');
  }

  const rows = parseCSV(csvText);
  console.log(`  [${tableName}] done — ${rows.length} rows`);
  return rows;
}

// ==================== IMPORT ====================

async function importTableIncremental(tableId, rows, primaryKeys) {
  if (!rows || rows.length === 0) return;
  const short = tableId.split('.').pop();
  console.log(`  [${short}] importing ${rows.length} rows…`);

  const csvBuf = Buffer.from(rowsToCSV(rows), 'utf-8');

  // 1. Prepare file upload and get Azure credentials
  const fileRes = await fetchWithRetry(`${KEBOOLA_URL}/v2/storage/files/prepare`, {
    method: 'POST',
    headers: {
      'X-StorageApi-Token': TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      name: 'data.csv',
      sizeBytes: String(csvBuf.length),
      notify: '0',
      isPublic: '0',
      federationToken: '1',
      'tags[]': 'file-import',
    }).toString(),
  });
  if (!fileRes.ok) throw new Error(`File prepare failed: ${fileRes.status} ${await fileRes.text()}`);
  const fileInfo = await fileRes.json();
  const fileId = fileInfo.id;
  const absParams = fileInfo.absUploadParams;
  if (!absParams) throw new Error(`No absUploadParams in file prepare response for ${tableId}`);

  // 2. Upload CSV to Azure Blob Storage
  const sasConn = absParams.absCredentials.SASConnectionString;
  const blobEndpointMatch = sasConn.match(/BlobEndpoint=([^;]+)/);
  const sasMatch = sasConn.match(/SharedAccessSignature=(.+)/);
  if (!blobEndpointMatch || !sasMatch) throw new Error(`Cannot parse SASConnectionString for ${tableId}`);
  const uploadUrl = `${blobEndpointMatch[1].replace(/\/$/, '')}/${absParams.container}/${absParams.blobName}?${sasMatch[1]}`;

  const uploadRes = await fetchWithRetry(uploadUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/csv' },
    body: csvBuf,
  });
  if (!uploadRes.ok) throw new Error(`Azure upload failed: ${uploadRes.status}`);
  console.log(`  [${short}] file uploaded (id=${fileId})`);

  // 3. Trigger async incremental import referencing the uploaded file
  const searchParams = new URLSearchParams();
  searchParams.set('dataFileId', String(fileId));
  searchParams.set('incremental', '1');
  for (const pk of primaryKeys) searchParams.append('primaryKey[]', pk);

  const importJob = await fetchWithRetry(`${KEBOOLA_URL}/v2/storage/tables/${tableId}/import-async`, {
    method: 'POST',
    headers: {
      'X-StorageApi-Token': TOKEN,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: searchParams.toString(),
  });
  if (!importJob.ok) throw new Error(`Import-async failed: ${importJob.status} ${await importJob.text()}`);
  const importJobData = await importJob.json();
  await pollJob(importJobData.id, `${short}-import`);
  console.log(`  [${short}] import done`);
}

module.exports = { exportTable, importTableIncremental };
