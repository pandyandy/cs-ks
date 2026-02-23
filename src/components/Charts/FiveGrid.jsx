'use client';

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { build5GridPivot, categorize5Grid, calculateCategorySummary } from '@/lib/chartUtils';
import { build5GridColumnDefs } from '@/lib/gridConfig';
import CategorySummary from './CategorySummary';

export default function FiveGrid({ data, period = 'current' }) {
  const pivotData = useMemo(() => build5GridPivot(data, period), [data, period]);
  const columnDefs = useMemo(() => build5GridColumnDefs(period), [period]);

  const summary = useMemo(
    () =>
      calculateCategorySummary(data, (row) => categorize5Grid(row.CO, row.JAK)),
    [data]
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: false,
      resizable: true,
      autoHeight: true,
      wrapText: true,
      suppressMovable: true,
    }),
    []
  );

  return (
    <div>
      <div className="ag-theme-alpine" style={{ height: 700, width: '100%' }}>
        <AgGridReact
          rowData={pivotData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          domLayout="normal"
          suppressRowHoverHighlight={false}
        />
      </div>
      <CategorySummary items={summary} />
    </div>
  );
}
