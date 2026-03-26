const { gunzipSync } = require('zlib');

const KEBOOLA_URL = (process.env.KBC_URL || '').replace(/\/$/, '');
const TOKEN = process.env.KEBOOLA_TOKEN;

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
  const short = tableId.split('.').pop();
  const t0 = Date.now();
  console.log(`  [${short}] starting export…`);

  if (!KEBOOLA_URL || !TOKEN) throw new Error('KBC_URL and KEBOOLA_TOKEN must be set');

  const job = await kbcPost(`/tables/${tableId}/export-async`, { format: 'rfc' });
  console.log(`  [${short}] job ${job.id} created, polling…`);

  const result = await pollJob(job.id, short);

  const fileId = result.results?.file?.id || result.file?.id;
  if (!fileId) throw new Error(`No file ID for ${tableId}: ${JSON.stringify(result.results)}`);

  // Fetch file info with federationToken to get Azure SAS credentials
  console.log(`  [${short}] fetching file info (federationToken)…`);
  const fileInfo = await kbcGet(`/files/${fileId}?federationToken=1`);
  const creds = fileInfo.credentials || {};
  console.log(`  [${short}] provider=${fileInfo.provider}, credKeys=${Object.keys(creds).join(',') || 'none'}`);

  // Resolve SAS token from credentials or manifest URL
  let sas = creds.sas || '';
  if (!sas && creds.SASConnectionString) {
    const match = creds.SASConnectionString.match(/SharedAccessSignature=(.+)/);
    if (match) sas = match[1];
  }
  if (!sas && fileInfo.url) {
    const u = new URL(fileInfo.url);
    if (u.search) sas = u.search.slice(1);
  }
  console.log(`  [${short}] sas resolved: ${sas ? 'yes (' + sas.slice(0, 30) + '…)' : 'NO — will try without'}`);

  // Download manifest
  console.log(`  [${short}] downloading manifest…`);
  const manifestRes = await fetchWithRetry(fileInfo.url);
  if (!manifestRes.ok) throw new Error(`Manifest download failed: ${manifestRes.status}`);
  const manifestText = await manifestRes.text();

  let csvText = '';
  let entries = null;
  try { entries = JSON.parse(manifestText).entries; } catch { /* not JSON — raw CSV */ }

  if (entries && entries.length > 0) {
    console.log(`  [${short}] downloading ${entries.length} blob(s)…`);
    const parts = await Promise.all(entries.map(async (entry, i) => {
      const httpsUrl = entry.url.replace(/^azure:\/\//, 'https://');
      const blobUrl = sas ? `${httpsUrl}?${sas}` : httpsUrl;
      const r = await fetchWithRetry(blobUrl);
      if (!r.ok) throw new Error(`Blob ${i} failed: ${r.status} — URL: ${httpsUrl.slice(0, 100)}`);
      const buf = Buffer.from(await r.arrayBuffer());
      try { return gunzipSync(buf).toString('utf-8'); } catch { return buf.toString('utf-8'); }
    }));
    csvText = parts.join('');
  } else {
    // Fallback: manifest is the raw CSV (non-Azure backends)
    csvText = manifestText;
  }

  const rows = parseCSV(csvText);
  console.log(`  [${short}] done — ${rows.length} rows (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
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
  const params = {
    dataFileId: String(fileId),
    incremental: '1',
  };
  for (const pk of primaryKeys) {
    params['primaryKey[]'] = pk; // URLSearchParams handles duplicate keys
  }
  // Build params properly for multiple primary keys
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
