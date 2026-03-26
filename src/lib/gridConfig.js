import columnNames from './columnNames.json';

/**
 * Get standardized column order.
 */
export function getColumnOrder(columnsToDisplay, editableColumns) {
  const baseColumns = columnsToDisplay.filter(
    (col) => !['MES_DPP_STATUS', 'IS_LOCKED', 'COMPARATIO'].includes(col)
  );
  const editableWithoutPoznamky = editableColumns.filter((col) => col !== 'POZNAMKY');
  const allColumns = [...baseColumns, ...editableWithoutPoznamky];

  if (columnsToDisplay.includes('COMPARATIO')) allColumns.push('COMPARATIO');
  if (editableColumns.includes('POZNAMKY')) allColumns.push('POZNAMKY');

  return [...allColumns, 'MES_DPP_STATUS', 'IS_LOCKED'];
}

/**
 * Get friendly column name from the mapping.
 */
export function getColumnDisplayName(col) {
  return columnNames[col] || col;
}

/**
 * Build AG Grid column definitions for the main editable table.
 */
export function buildMainGridColumnDefs(columnsToDisplay, editableColumns, userRole, userEmail) {
  const columns = getColumnOrder(columnsToDisplay, editableColumns);

  return columns.map((col) => {
    const def = {
      field: col,
      headerName: getColumnDisplayName(col),
      filter: true,
      resizable: true,
      minWidth: 100,
    };

    // Pin essential columns
    if (col === 'FULL_NAME') {
      def.pinned = 'left';
      def.cellStyle = { backgroundColor: '#2870ed', fontWeight: 'bold', color: 'white' };
    } else if (col === 'DIRECT_MANAGER_FULL_NAME') {
      def.pinned = 'left';
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
    } else if (col === 'JOB_TITLE_CZ') {
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
    } else if (['HODNOTY_SYSTEM', 'VYKON_SYSTEM'].includes(col)) {
      def.cellStyle = (params) => {
        if (params.data?.IS_LOCKED === 1) return { backgroundColor: 'lightGrey' };
        return { backgroundColor: '#e7effd', color: '#2870ed' };
      };
    } else if ([
      'LOGIN', 'USERNAME', 'L2_ORGANIZATION_UNIT_NAME_CZ',
      'L3_ORGANIZATION_UNIT_NAME_CZ', 'L4_ORGANIZATION_UNIT_NAME_CZ',
      'TEAM_CODE', 'L2_HEAD_OF_UNIT_FULL_NAME',
      'L3_HEAD_OF_UNIT_FULL_NAME', 'L4_HEAD_OF_UNIT_FULL_NAME',
    ].includes(col)) {
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
    }

    // Editable columns configuration
    if (editableColumns.includes(col)) {
      def.editable = getEditableCondition(userRole, userEmail);
      def.cellStyle = getEditableCellStyle(editableColumns);

      if (['HODNOTY', 'VYKON'].includes(col)) {
        def.cellEditor = 'agSelectCellEditor';
        def.cellEditorParams = { values: [0, 1, 2, 3, 4, 5] };
      } else if (['POTENCIAL', 'PRAVDEPODOBNOST_ODCHODU'].includes(col)) {
        def.cellEditor = 'agSelectCellEditor';
        def.cellEditorParams = { values: ['nízký', 'střední', 'vysoký', 0] };
      } else if (['NASTUPCE', 'MOZNY_KARIERNI_POSUN'].includes(col)) {
        def.cellEditor = 'agSelectCellEditor';
        def.cellEditorParams = { values: ['Ano', 'Ne'] };
      } else if (col === 'POZNAMKY') {
        def.minWidth = 450;
        def.cellEditor = 'agLargeTextCellEditor';
        def.cellEditorPopup = true;
        def.wrapText = true;
        def.autoHeight = true;
        def.cellEditorParams = { maxLength: 1000 };
      }
    }

    // IS_LOCKED column
    if (col === 'IS_LOCKED') {
      def.minWidth = 70;
      if (['BP', 'DEV', 'TEST'].includes(userRole)) {
        def.editable = (params) => params.data?.IS_LOCKED !== 1;
        def.cellEditor = 'agSelectCellEditor';
        def.cellEditorParams = { values: [0, 1] };
        def.cellStyle = getEditableCellStyle(editableColumns);
      }
    }

    return def;
  });
}

function getEditableCondition(userRole, _userEmail) {
  switch (userRole) {
    case 'BP':
      return (params) => {
        const isLocked = params.data?.IS_LOCKED === 1;
        const lockedTs = params.data?.LOCKED_TIMESTAMP ? new Date(params.data.LOCKED_TIMESTAMP) : null;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        return !isLocked || (lockedTs && lockedTs >= cutoff);
      };
    case 'MA':
      return (params) => params.data?.IS_LOCKED !== 1;
    case 'LC':
      return () => false;
    case 'DEV':
    case 'TEST':
      return () => true;
    default:
      return () => false;
  }
}

function getEditableCellStyle(editableColumns) {
  return (params) => {
    const style = {};

    if (params.data?.IS_LOCKED === 1) {
      style.backgroundColor = 'lightGrey';
      style.color = 'gray';
    } else if (editableColumns.includes(params.colDef.field)) {
      style.fontWeight = 'bold';
      style.color = 'black';
    }

    if (params.data?.IS_LOCKED === 0 && params.colDef.field === 'HODNOTY' &&
        params.data.HODNOTY !== params.data.HODNOTY_SYSTEM) {
      style.backgroundColor = '#EDA528';
      style.color = 'black';
      style.fontWeight = 'bold';
    }

    if (params.data?.IS_LOCKED === 0 && params.colDef.field === 'VYKON' &&
        params.data.VYKON !== params.data.VYKON_SYSTEM) {
      style.backgroundColor = '#EDA528';
      style.color = 'black';
      style.fontWeight = 'bold';
    }

    return style;
  };
}

/**
 * Build column definitions for filter management table.
 */
export function buildFilterManagementColumnDefs(columns) {
  return columns.map((col) => {
    const def = {
      field: col,
      headerName: getColumnDisplayName(col),
      filter: true,
      editable: false,
      resizable: true,
    };

    if (col === 'FULL_NAME') {
      def.pinned = 'left';
      def.cellStyle = { backgroundColor: '#2870ed', fontWeight: 'bold', color: 'white' };
      def.width = 250;
      def.minWidth = 200;
    } else if (col === 'DIRECT_MANAGER_FULL_NAME') {
      def.pinned = 'left';
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
      def.width = 250;
      def.minWidth = 200;
    } else if (col === 'JOB_TITLE_CZ') {
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
      def.width = 220;
      def.minWidth = 180;
    } else if (col.includes('ORGANIZATION_UNIT')) {
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
      def.width = 220;
      def.minWidth = 180;
    } else if (col.includes('HEAD_OF_UNIT')) {
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
      def.width = 200;
      def.minWidth = 180;
    } else if (col === 'USERNAME') {
      def.cellStyle = { backgroundColor: '#e7effd', color: '#2870ed' };
      def.width = 150;
      def.minWidth = 120;
    } else {
      def.width = 150;
      def.minWidth = 120;
    }

    return def;
  });
}
