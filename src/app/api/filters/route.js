import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getFiltersPath() {
  return path.join(process.cwd(), 'src', 'data', 'filters.json');
}

function readFilters() {
  const raw = fs.readFileSync(getFiltersPath(), 'utf-8');
  return JSON.parse(raw);
}

function writeFilters(data) {
  fs.writeFileSync(getFiltersPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const allFilters = readFilters();
    const userFilters = allFilters.filter((f) => f.FILTER_CREATOR === userEmail);
    const filterNames = userFilters.map((f) => f.FILTER_NAME);

    return NextResponse.json({ filters: userFilters, filterNames });
  } catch {
    return NextResponse.json({ filters: [], filterNames: [] });
  }
}

export async function POST(request) {
  try {
    const { userEmail, filterName, filterModel } = await request.json();

    if (!userEmail || !filterName) {
      return NextResponse.json({ error: 'Email and filter name are required' }, { status: 400 });
    }

    const allFilters = readFilters();

    // Find existing filter by same user and name
    const existingIdx = allFilters.findIndex(
      (f) => f.FILTER_NAME === filterName && f.FILTER_CREATOR === userEmail
    );

    const filterRecord = {
      FILTER_NAME: filterName,
      FILTER_CREATOR: userEmail,
      FILTERED_VALUES: JSON.stringify(filterModel || {}),
    };

    if (existingIdx >= 0) {
      allFilters[existingIdx] = filterRecord;
    } else {
      allFilters.push(filterRecord);
    }

    writeFilters(allFilters);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
