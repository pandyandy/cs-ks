'use client';

import { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useApp } from '@/context/AppContext';
import { buildMainGridColumnDefs } from '@/lib/gridConfig';
import { mergeChangedRows } from '@/lib/dataManager';
import { COLUMNS_TO_DISPLAY, EDITABLE_COLUMNS } from '@/lib/constants';

export default function DataGrid({ data, onDataChanged }) {
  const { state, dispatch } = useApp();
  const gridRef = useRef(null);

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

  const statusBar = useMemo(() => ({
    statusPanels: [
      { statusPanel: 'agTotalRowCountComponent', align: 'left' },
      { statusPanel: 'agFilteredRowCountComponent', align: 'left' },
    ],
  }), []);

  const onCellValueChanged = useCallback((event) => {
    const newChanges = mergeChangedRows(state.changedRows, [event.data]);
    dispatch({ type: 'SET_CHANGED_ROWS', payload: newChanges });
    onDataChanged?.(newChanges);
  }, [state.changedRows, dispatch, onDataChanged]);

  const onFirstDataRendered = useCallback((params) => {
    params.api.sizeColumnsToFit();
  }, []);

  return (
    <div className="ag-theme-alpine" style={{ height: 380, width: '100%' }}>
      <AgGridReact
        ref={gridRef}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        statusBar={statusBar}
        onCellValueChanged={onCellValueChanged}
        onFirstDataRendered={onFirstDataRendered}
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
  );
}
