
import { useState, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import DataGrid from './DataGrid';
import LockDialog from './LockDialog';
import { filterDataframe } from '@/lib/dataManager';
import { COLUMNS_TO_DISPLAY, EDITABLE_COLUMNS } from '@/lib/constants';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

function IconButton({ onClick, disabled, primary, children, icon, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
        ${primary
          ? 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow-md active:scale-[0.98]'
          : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm active:bg-gray-100'
        }
      `}
    >
      {icon}
      {children}
    </button>
  );
}

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export default function EvaluationTab() {
  const { state, dispatch, saveChanges, reloadData } = useApp();
  const [saving, setSaving] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const uniqueYears = useMemo(() => {
    const years = [...new Set(state.data.map((r) => r.YEAR_EVALUATION))];
    return years.sort().reverse();
  }, [state.data]);

  const selectedYear = state.selectedYear || uniqueYears[0] || null;

  const filterModel = useMemo(() => {
    if (!state.selectedFilterName) return null;
    const filter = state.userFilters.find((f) => f.FILTER_NAME === state.selectedFilterName);
    if (!filter) return null;
    try { return JSON.parse(filter.FILTERED_VALUES); } catch { return null; }
  }, [state.selectedFilterName, state.userFilters]);

  const filteredData = useMemo(() => {
    if (!selectedYear) return [];
    return filterDataframe(
      state.data, state.userRole, state.userEmail,
      filterModel, selectedYear,
      state.userRole === 'MA' ? state.directReportsOnly : false
    );
  }, [state.data, state.userRole, state.userEmail, filterModel, selectedYear, state.directReportsOnly]);

  const handleSave = useCallback(async () => {
    if (state.changedRows.length === 0) return;
    setSaving(true);
    setSaveProgress(20);
    try {
      setSaveProgress(50);
      const success = await saveChanges(state.changedRows, state.data, state.userEmail);
      setSaveProgress(success ? 100 : 80);
    } finally {
      setTimeout(() => { setSaving(false); setSaveProgress(0); }, 1000);
    }
  }, [state.changedRows, state.data, state.userEmail, saveChanges]);

  const handleExport = useCallback(() => {
    const exportColumns = [...COLUMNS_TO_DISPLAY, ...EDITABLE_COLUMNS].filter(
      (col, idx, arr) => arr.indexOf(col) === idx
    );
    const exportData = filteredData.map((row) => {
      const exportRow = {};
      for (const col of exportColumns) { if (col in row) exportRow[col] = row[col]; }
      return exportRow;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    saveAs(blob, `${timestamp}_DigiKS_Export.xlsx`);
  }, [filteredData]);

  const showData = state.selectedFilterName || state.userRole === 'MA';

  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 animate-fade-in">
      {/* Filters row */}
      <div className="grid grid-cols-12 gap-4 mb-5 items-end">
        <div className={state.userRole === 'MA' ? 'col-span-6' : 'col-span-8'}>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Výběr filtru
          </label>
          <select
            value={state.selectedFilterName}
            onChange={(e) => dispatch({ type: 'SET_SELECTED_FILTER', payload: e.target.value })}
            disabled={state.unsavedWarning}
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Vyberte filtr...</option>
            {[...state.filterNames].sort().map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className={state.userRole === 'MA' ? 'col-span-3' : 'col-span-4'}>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Výběr období
          </label>
          <select
            value={selectedYear || ''}
            onChange={(e) => dispatch({ type: 'SET_SELECTED_YEAR', payload: e.target.value })}
            disabled={state.unsavedWarning}
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50"
          >
            {uniqueYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {state.userRole === 'MA' && (
          <div className="col-span-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Pouze přímí podřízení
            </label>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={state.directReportsOnly}
                onChange={(e) => dispatch({ type: 'SET_DIRECT_REPORTS_ONLY', payload: e.target.checked })}
                disabled={state.unsavedWarning}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
              <span className="ml-2 text-sm text-gray-600">Přímí</span>
            </label>
          </div>
        )}
      </div>

      {/* Content */}
      {showData ? (
        <>
          {filteredData.length > 0 ? (
            <div className="mb-4">
              <DataGrid
            data={filteredData}
            dataKey={`${selectedYear}_${state.selectedFilterName}_${state.directReportsOnly}`}
          />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm mb-4">
              <svg className="w-5 h-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Pro vybrané filtry a období nebyla nalezena žádná data.
            </div>
          )}

          {/* Unsaved warning */}
          {state.unsavedWarning && (
            <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4 animate-fade-in">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Máte neuložené změny.</span> Nezapomeňte je uložit před opuštěním aplikace.
            </div>
          )}

          {/* Progress bar */}
          {saving && (
            <div className="mb-4 animate-fade-in">
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary to-blue-400 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${saveProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5 font-medium">Odesílám data do databáze...</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {['BP', 'DEV', 'TEST'].includes(state.userRole) && (
              <>
                <IconButton onClick={reloadData} icon={<RefreshIcon />} title="Obnovit data z databáze">
                  Aktualizovat
                </IconButton>
                <IconButton onClick={handleExport} icon={<DownloadIcon />} title="Stáhnout XLSX">
                  Export
                </IconButton>
                <IconButton onClick={() => filteredData.length > 0 && setShowLockDialog(true)} icon={<LockIcon />}>
                  Uzamknout
                </IconButton>
                <div className="flex-1" />
                <IconButton onClick={handleSave} disabled={!state.changedRows.length || saving} primary icon={<SaveIcon />}>
                  Uložit změny
                </IconButton>
              </>
            )}
            {state.userRole === 'MA' && (
              <>
                <IconButton onClick={reloadData} icon={<RefreshIcon />}>Aktualizovat</IconButton>
                <IconButton onClick={handleExport} icon={<DownloadIcon />}>Export</IconButton>
                <div className="flex-1" />
                <IconButton onClick={handleSave} disabled={!state.changedRows.length || saving} primary icon={<SaveIcon />}>
                  Uložit změny
                </IconButton>
              </>
            )}
            {state.userRole === 'LC' && (
              <>
                <IconButton onClick={handleExport} icon={<DownloadIcon />}>Export</IconButton>
                <IconButton onClick={reloadData} icon={<RefreshIcon />}>Aktualizovat</IconButton>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 p-5 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-700 text-sm">
          <svg className="w-5 h-5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pro zobrazení dat vyberte filtr ze seznamu.
        </div>
      )}

      {showLockDialog && (
        <LockDialog rows={filteredData} onClose={() => setShowLockDialog(false)} />
      )}
    </div>
  );
}
