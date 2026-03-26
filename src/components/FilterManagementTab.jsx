
import { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { filterDataframe, applyFilterUnion } from '@/lib/dataManager';
import { FILTER_MANAGEMENT_COLUMNS, FILTER_COLUMNS } from '@/lib/constants';
import columnNames from '@/lib/columnNames.json';

const PREVIEW_ROWS = 200;

export default function FilterManagementTab() {
  const { state, saveFilter } = useApp();
  const [selectedFilterName, setSelectedFilterName] = useState('');
  const [filterSelections, setFilterSelections] = useState({});
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [directReportsToggle, setDirectReportsToggle] = useState(false);

  const handleFilterNameChange = useCallback((name) => {
    setSelectedFilterName(name);
    if (!name) { setFilterSelections({}); return; }
    const filter = state.userFilters.find((f) => f.FILTER_NAME === name);
    if (filter) {
      try {
        const model = JSON.parse(filter.FILTERED_VALUES);
        const newSelections = {};
        for (const col of FILTER_COLUMNS) {
          if (model[col]?.filterType === 'set' && model[col]?.values) {
            newSelections[col] = Array.isArray(model[col].values) ? model[col].values : Object.values(model[col].values);
          }
        }
        setFilterSelections(newSelections);
      } catch { setFilterSelections({}); }
    }
  }, [state.userFilters]);

  const currentYear = useMemo(() => {
    if (!state.data.length) return null;
    return state.data.map((r) => r.YEAR_EVALUATION).sort().reverse()[0];
  }, [state.data]);

  const baseData = useMemo(() => {
    if (!currentYear) return [];
    const filtered = filterDataframe(state.data, state.userRole, state.userEmail, null, currentYear, state.userRole === 'MA' ? directReportsToggle : false);
    return filtered.map((row) => {
      const subset = {};
      for (const col of FILTER_MANAGEMENT_COLUMNS) subset[col] = row[col];
      return subset;
    });
  }, [state.data, state.userRole, state.userEmail, currentYear, directReportsToggle]);

  const currentFilterModel = useMemo(() => {
    const model = {};
    for (const [col, values] of Object.entries(filterSelections)) {
      if (values?.length > 0) model[col] = { filterType: 'set', values };
    }
    return Object.keys(model).length > 0 ? model : null;
  }, [filterSelections]);

  const filterOptions = useMemo(() => {
    const options = {};
    for (const col of FILTER_COLUMNS) {
      options[col] = [...new Set(baseData.map((r) => r[col]).filter(Boolean))].sort();
    }
    return options;
  }, [baseData]);

  const displayedData = useMemo(() => {
    if (currentFilterModel) return applyFilterUnion(baseData, currentFilterModel);
    return [...baseData].sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
  }, [baseData, currentFilterModel]);

  const handleSelectionChange = useCallback((column, values) => {
    setFilterSelections((prev) => ({ ...prev, [column]: values }));
  }, []);

  const handleSaveFilter = useCallback(async () => {
    if (!saveName) return;
    setSaving(true);
    try {
      const model = {};
      for (const [col, values] of Object.entries(filterSelections)) {
        if (values?.length > 0) model[col] = { filterType: 'set', values };
      }
      const success = await saveFilter(state.userEmail, saveName, model);
      if (success) setSaveName('');
    } finally { setSaving(false); }
  }, [saveName, filterSelections, state.userEmail, saveFilter]);

  const isFilterApplied = currentFilterModel !== null;
  const activeFilterCount = currentFilterModel ? Object.keys(currentFilterModel).length : 0;
  const activeValueCount = currentFilterModel
    ? Object.values(currentFilterModel).reduce((sum, d) => sum + (d.values?.length || 0), 0)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Saved filter selector */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
        <div className="grid grid-cols-12 gap-4 items-end">
          <div className={state.userRole === 'MA' ? 'col-span-9' : 'col-span-12'}>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Uložené filtry
            </label>
            <select
              value={selectedFilterName}
              onChange={(e) => handleFilterNameChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Vyberte filtr pro zobrazení dat...</option>
              {[...state.filterNames].sort().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          {state.userRole === 'MA' && (
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Pouze přímí podřízení
              </label>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" checked={directReportsToggle} onChange={(e) => setDirectReportsToggle(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Multiselect filters */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Sestavení filtru
        </h4>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {FILTER_COLUMNS.map((col) => (
            <div key={col}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {columnNames[col] || col}
              </label>
              <MultiSelect
                options={filterOptions[col] || []}
                selected={filterSelections[col] || []}
                onChange={(values) => handleSelectionChange(col, values)}
                placeholder="Vyberte z možností..."
              />
            </div>
          ))}
        </div>

        {isFilterApplied && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light rounded-md text-primary font-medium">
              {activeFilterCount} {activeFilterCount === 1 ? 'sloupec' : 'sloupce'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light rounded-md text-primary font-medium">
              {activeValueCount} {activeValueCount === 1 ? 'hodnota' : 'hodnot'}
            </span>
            <span className="text-gray-400">— řádky odpovídající jakékoliv podmínce budou zahrnuty</span>
          </div>
        )}
      </div>

      {/* Preview table */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Náhled filtrovaných hodnot
          </h4>
          <span className="text-xs text-gray-400 font-medium">
            {isFilterApplied
              ? `${displayedData.length} z ${baseData.length} řádků`
              : `${Math.min(PREVIEW_ROWS, displayedData.length)} z ${displayedData.length} řádků`
            }
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-xs">
            <thead>
              <tr>
                {FILTER_MANAGEMENT_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className={`px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wider ${
                      col === 'FULL_NAME'
                        ? 'bg-primary text-white sticky left-0 z-10'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {columnNames[col] || col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(isFilterApplied ? displayedData : displayedData.slice(0, PREVIEW_ROWS)).map((row, idx) => (
                <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                  {FILTER_MANAGEMENT_COLUMNS.map((col) => (
                    <td
                      key={col}
                      className={`px-3 py-2 whitespace-nowrap ${
                        col === 'FULL_NAME'
                          ? 'bg-primary text-white font-semibold sticky left-0 z-10'
                          : 'text-gray-700'
                      }`}
                    >
                      {row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save filter */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Uložení filtru
        </h4>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Název filtru</label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Zadejte název filtru..."
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={handleSaveFilter}
            disabled={!saveName || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Ukládám...' : 'Uložit filtr'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MultiSelect({ options, selected, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(
    () => options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const toggleOption = useCallback((opt) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  }, [selected, onChange]);

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[38px] border rounded-lg px-2.5 py-1.5 cursor-pointer flex flex-wrap gap-1 items-center transition-colors ${
          isOpen ? 'border-primary ring-2 ring-primary/10' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        {selected.length === 0 && (
          <span className="text-gray-400 text-xs">{placeholder}</span>
        )}
        {selected.map((s) => (
          <span key={s} className="bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
            {s}
            <button onClick={(e) => { e.stopPropagation(); onChange(selected.filter((v) => v !== s)); }} className="hover:text-primary-dark">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearch(''); }} />
          <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-popup max-h-56 overflow-hidden animate-fade-in">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat..."
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div className="overflow-auto max-h-44">
              {filteredOptions.map((opt) => (
                <label key={opt} className="flex items-center px-3 py-2 hover:bg-blue-50/60 cursor-pointer text-xs transition-colors">
                  <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} className="mr-2.5 rounded border-gray-300 text-primary focus:ring-primary/30" />
                  <span className="text-gray-700">{opt}</span>
                </label>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">Žádné výsledky</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
