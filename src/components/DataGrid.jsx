import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useApp } from '@/context/AppContext';
import { buildMainGridColumnDefs } from '@/lib/gridConfig';
import { mergeChangedRows } from '@/lib/dataManager';
import { COLUMNS_TO_DISPLAY, EDITABLE_COLUMNS } from '@/lib/constants';

const rowKey = (row) => `${row.USER_ID}_${row.YEAR}_${row.EVALUATION}`;

export default function DataGrid({ data, dataKey, onDataChanged }) {
  const { state, dispatch } = useApp();
  const gridRef = useRef(null);

  // Local copy that AG Grid actually renders — only syncs from props on external changes
  // (year/filter switch, server reload), never on local cell edits.
  const [gridData, setGridData] = useState(() => data);
  const [displayedCount, setDisplayedCount] = useState(data.length);

  useEffect(() => {
    setGridData(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, state.gridRefreshTimestamp]);

  const getRowId = useCallback((params) => rowKey(params.data), []);

  const columnDefs = useMemo(
    () => buildMainGridColumnDefs(COLUMNS_TO_DISPLAY, EDITABLE_COLUMNS, state.userRole, state.userEmail),
    [state.userRole, state.userEmail]
  );

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    menuTabs: ['filterMenuTab'],
  }), []);

  const onCellValueChanged = useCallback((event) => {
    // Update local grid data immediately — no React round-trip through filteredData
    setGridData((prev) => prev.map((row) => rowKey(row) === rowKey(event.data) ? event.data : row));
    dispatch({ type: 'UPDATE_ROW', payload: event.data });
    const newChanges = mergeChangedRows(state.changedRows, [event.data]);
    dispatch({ type: 'SET_CHANGED_ROWS', payload: newChanges });
    onDataChanged?.(newChanges);
  }, [state.changedRows, dispatch, onDataChanged]);

  const onFirstDataRendered = useCallback((params) => {
    params.api.sizeColumnsToFit();
    setDisplayedCount(params.api.getDisplayedRowCount());
  }, []);

  const onFilterChanged = useCallback((params) => {
    setDisplayedCount(params.api.getDisplayedRowCount());
  }, []);

  return (
    <div>
      <div className="ag-theme-alpine" style={{ height: 380, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={gridData}
          getRowId={getRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          onFirstDataRendered={onFirstDataRendered}
          onFilterChanged={onFilterChanged}
          animateRows={true}
          suppressClickEdit={false}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          headerHeight={36}
          rowHeight={34}
          localeText={{
            totalRows: 'Řádků celkem',
            filteredRows: 'Po vyfiltrování',
          }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1 px-1">
        Po vyfiltrování: <span className="font-medium text-gray-600">{displayedCount}</span>
        {' · '}Celkem: <span className="font-medium text-gray-600">{data.length}</span>
      </div>
    </div>
  );
}
