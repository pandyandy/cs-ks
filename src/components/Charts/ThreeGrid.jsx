'use client';

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { build3GridPivot, categorize3Grid, calculateCategorySummary } from '@/lib/chartUtils';
import { build3GridColumnDefs } from '@/lib/gridConfig';
import CategorySummary from './CategorySummary';

export default function ThreeGrid({ data, period = 'current' }) {
  const pivotData = useMemo(() => build3GridPivot(data, period), [data, period]);
  const columnDefs = useMemo(() => build3GridColumnDefs(period), [period]);

  const summary = useMemo(
    () =>
      calculateCategorySummary(data, (row) =>
        categorize3Grid(row.CO, row.JAK, row.POTENCIAL)
      ),
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
        />
      </div>
      <CategorySummary items={summary} />
    </div>
  );
}
