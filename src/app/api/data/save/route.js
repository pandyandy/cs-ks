import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PK_COLUMNS = ['USER_ID', 'YEAR', 'EVALUATION'];
const COLUMNS_TO_UPDATE = [
  'HODNOTY', 'VYKON', 'POTENCIAL', 'POZNAMKY', 'NASTUPCE',
  'PRAVDEPODOBNOST_ODCHODU', 'IS_LOCKED', 'MOZNY_KARIERNI_POSUN',
  'LOCKED_TIMESTAMP', 'HIST_DATA_MODIFIED_BY', 'HIST_DATA_MODIFIED_WHEN',
];

function getEmployeesPath() {
  return path.join(process.cwd(), 'src', 'data', 'employees.json');
}

function readEmployees() {
  const raw = fs.readFileSync(getEmployeesPath(), 'utf-8');
  return JSON.parse(raw);
}

function writeEmployees(data) {
  fs.writeFileSync(getEmployeesPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export async function POST(request) {
  try {
    const { changedRows, userEmail } = await request.json();

    if (!changedRows?.length) {
      return NextResponse.json({ error: 'No changes to save' }, { status: 400 });
    }

    const employees = readEmployees();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 23);

    // Build a lookup by PK for fast access
    const indexMap = new Map();
    for (let i = 0; i < employees.length; i++) {
      const key = `${employees[i].USER_ID}_${employees[i].YEAR}_${employees[i].EVALUATION}`;
      indexMap.set(key, i);
    }

    let updatedCount = 0;

    for (const changed of changedRows) {
      const key = `${changed.USER_ID}_${changed.YEAR}_${changed.EVALUATION}`;
      const idx = indexMap.get(key);
      if (idx == null) continue;

      const row = employees[idx];

      for (const col of COLUMNS_TO_UPDATE) {
        if (changed[col] !== undefined) {
          row[col] = changed[col];
        }
      }

      row.HIST_DATA_MODIFIED_BY = userEmail;
      row.HIST_DATA_MODIFIED_WHEN = now;

      // Ensure numeric columns
      for (const col of ['IS_LOCKED', 'HODNOTY', 'VYKON']) {
        row[col] = parseInt(row[col], 10) || 0;
      }

      // Update LOCKED_TIMESTAMP when newly locked
      if (
        row.IS_LOCKED === 1 &&
        (!row.LOCKED_TIMESTAMP ||
          row.LOCKED_TIMESTAMP === '1970-01-01 00:00:00.000' ||
          row.LOCKED_TIMESTAMP === '')
      ) {
        row.LOCKED_TIMESTAMP = now;
      }

      updatedCount++;
    }

    writeEmployees(employees);

    return NextResponse.json({ success: true, rowsUpdated: updatedCount });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
