import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getEmployeesPath() {
  return path.join(process.cwd(), 'src', 'data', 'employees.json');
}

function readEmployees() {
  const raw = fs.readFileSync(getEmployeesPath(), 'utf-8');
  return JSON.parse(raw);
}

export async function GET() {
  try {
    const rows = readEmployees();

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

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
