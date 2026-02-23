/**
 * Build manager hierarchy - maps each manager email to their direct reports.
 */
function buildManagerHierarchy(data) {
  const managerToReports = {};

  for (const row of data) {
    const email = (row.EMAIL_ADDRESS || '').toLowerCase().trim();
    const managerEmail = (row.DIRECT_MANAGER_EMAIL || '').toLowerCase().trim();

    if (email === '0') continue;

    if (!managerToReports[managerEmail]) {
      managerToReports[managerEmail] = [];
    }
    managerToReports[managerEmail].push(email);
  }

  return managerToReports;
}

/**
 * BFS traversal to get all direct and indirect reports for a manager.
 */
export function getAllReports(data, managerEmail) {
  const hierarchy = buildManagerHierarchy(data);
  const email = managerEmail.toLowerCase().trim();
  const allReports = new Set();
  const queue = [email];

  while (queue.length > 0) {
    const current = queue.shift();
    if (allReports.has(current)) continue;
    allReports.add(current);

    const directReports = hierarchy[current] || [];
    for (const report of directReports) {
      queue.push(report);
    }
  }

  allReports.delete(email);
  return allReports;
}

/**
 * Filter data based on user role.
 */
export function filterDataByRole(data, userRole, userEmail) {
  if (userRole === 'MA') {
    const allReports = getAllReports(data, userEmail);
    return data.filter((row) => allReports.has((row.EMAIL_ADDRESS || '').toLowerCase()));
  }
  return data;
}

/**
 * Apply filter model (AND logic) - rows must match ALL filter conditions.
 */
export function applyFilter(data, filterModel) {
  if (!filterModel) return data;

  let filtered = [...data];

  for (const [column, filterDetails] of Object.entries(filterModel)) {
    if (filterDetails.filterType === 'set' && filterDetails.values) {
      const values = new Set(filterDetails.values);
      filtered = filtered.filter((row) => values.has(row[column]));
    }
  }

  filtered.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
  return filtered;
}

/**
 * Apply filter model (OR logic / union) - rows matching ANY filter condition are included.
 */
export function applyFilterUnion(data, filterModel) {
  if (!filterModel || Object.keys(filterModel).length === 0) return data;

  const resultSet = new Set();
  const results = [];

  for (const [column, filterDetails] of Object.entries(filterModel)) {
    if (filterDetails.filterType === 'set' && filterDetails.values?.length) {
      const values = new Set(filterDetails.values);
      for (let i = 0; i < data.length; i++) {
        if (values.has(data[i][column]) && !resultSet.has(i)) {
          resultSet.add(i);
          results.push(data[i]);
        }
      }
    }
  }

  results.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
  return results;
}

/**
 * Combine a saved filter model with current filter model.
 */
export function combineFilterModels(savedModel, currentModel) {
  const combined = {};

  if (savedModel) {
    Object.assign(combined, savedModel);
  }

  if (currentModel) {
    for (const [column, filterInfo] of Object.entries(currentModel)) {
      if (filterInfo.filterType === 'set' && filterInfo.values?.length) {
        if (combined[column]?.filterType === 'set') {
          const existing = Array.isArray(combined[column].values)
            ? combined[column].values
            : Object.values(combined[column].values);
          const newVals = Array.isArray(filterInfo.values)
            ? filterInfo.values
            : Object.values(filterInfo.values);
          combined[column] = {
            filterType: 'set',
            values: [...new Set([...existing, ...newVals])],
          };
        } else {
          combined[column] = filterInfo;
        }
      } else {
        combined[column] = filterInfo;
      }
    }
  }

  return combined;
}

/**
 * Mask DataFrame for 1-on-1 meetings - replace other names with '*'.
 */
export function maskDataForOneOnOne(data, selectedName) {
  return data.map((row) => ({
    ...row,
    FULL_NAME: row.FULL_NAME === selectedName ? row.FULL_NAME : '*',
  }));
}

/**
 * Merge new changes into existing changed rows without duplicates.
 */
export function mergeChangedRows(existingChanges, newChanges) {
  if (!newChanges || newChanges.length === 0) return existingChanges;
  if (!existingChanges || existingChanges.length === 0) return [...newChanges];

  const changeMap = new Map();

  for (const row of existingChanges) {
    const key = `${row.USER_ID}_${row.YEAR}_${row.EVALUATION}`;
    changeMap.set(key, { ...row });
  }

  for (const row of newChanges) {
    const key = `${row.USER_ID}_${row.YEAR}_${row.EVALUATION}`;
    const existing = changeMap.get(key);
    if (existing) {
      changeMap.set(key, { ...existing, ...row });
    } else {
      changeMap.set(key, { ...row });
    }
  }

  return Array.from(changeMap.values());
}

/**
 * Detect changed rows by comparing current data with last saved data.
 */
export function detectChanges(currentData, lastSavedData) {
  const excludedColumns = ['HIST_DATA_MODIFIED_BY', 'HIST_DATA_MODIFIED_WHEN', 'LOCKED_TIMESTAMP'];
  const changes = [];

  const savedMap = new Map();
  for (const row of lastSavedData) {
    const key = `${row.USER_ID}_${row.YEAR}_${row.EVALUATION}`;
    savedMap.set(key, row);
  }

  for (const row of currentData) {
    const key = `${row.USER_ID}_${row.YEAR}_${row.EVALUATION}`;
    const savedRow = savedMap.get(key);
    if (!savedRow) continue;

    let hasChange = false;
    for (const col of Object.keys(row)) {
      if (excludedColumns.includes(col)) continue;
      if (String(row[col] ?? '') !== String(savedRow[col] ?? '')) {
        hasChange = true;
        break;
      }
    }

    if (hasChange) {
      changes.push(row);
    }
  }

  return changes;
}

/**
 * Filter the dataframe based on filter model, selected year, and direct-reports toggle.
 */
export function filterDataframe(data, userRole, userEmail, filterModel, selectedYear, directOnly) {
  let filtered = filterDataByRole(data, userRole, userEmail);

  filtered = filtered.filter((row) => row.YEAR_EVALUATION === selectedYear);

  if (filterModel) {
    filtered = applyFilter(filtered, filterModel);
  }

  if (userRole === 'MA' && directOnly) {
    filtered = filtered.filter(
      (row) => (row.DIRECT_MANAGER_EMAIL || '').toLowerCase() === userEmail.toLowerCase()
    );
  }

  return filtered;
}

/**
 * Generate Excel file from data using the xlsx library.
 */
export function generateExcelBuffer(data, columnsToDisplay, editableColumns) {
  const columnOrder = getColumnOrder(columnsToDisplay, editableColumns);
  const existingColumns = columnOrder.filter((col) =>
    data.length > 0 ? col in data[0] : true
  );

  const exportData = data.map((row) => {
    const exportRow = {};
    for (const col of existingColumns) {
      exportRow[col] = row[col];
    }
    return exportRow;
  });

  return exportData;
}

/**
 * Get standardized column order.
 */
export function getColumnOrder(columnsToDisplay, editableColumns) {
  const baseColumns = columnsToDisplay.filter(
    (col) => !['MES_DPP_STATUS', 'IS_LOCKED', 'COMPARATIO'].includes(col)
  );
  const editableWithoutPoznamky = editableColumns.filter((col) => col !== 'POZNAMKY');
  const allColumns = [...baseColumns, ...editableWithoutPoznamky];

  if (columnsToDisplay.includes('COMPARATIO')) {
    allColumns.push('COMPARATIO');
  }
  if (editableColumns.includes('POZNAMKY')) {
    allColumns.push('POZNAMKY');
  }

  return [...allColumns, 'MES_DPP_STATUS', 'IS_LOCKED'];
}
