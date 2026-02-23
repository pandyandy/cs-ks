'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { filterDataframe, maskDataForOneOnOne } from '@/lib/dataManager';
import { preprocessForCharts } from '@/lib/chartUtils';
import FiveGrid from './Charts/FiveGrid';
import ThreeGrid from './Charts/ThreeGrid';
import ComparatioChart from './Charts/ComparatioChart';
import TrendChart from './Charts/TrendChart';
import Expander from './Expander';

export default function ReportsTab() {
  const { state } = useApp();
  const [selectedName, setSelectedName] = useState('Zobraz všechny');

  const filterModel = useMemo(() => {
    if (!state.selectedFilterName) return null;
    const filter = state.userFilters.find((f) => f.FILTER_NAME === state.selectedFilterName);
    if (!filter) return null;
    try { return JSON.parse(filter.FILTERED_VALUES); } catch { return null; }
  }, [state.selectedFilterName, state.userFilters]);

  const selectedYear = state.selectedYear || (state.data.length > 0
    ? [...new Set(state.data.map((r) => r.YEAR_EVALUATION))].sort().reverse()[0]
    : null);

  const filteredData = useMemo(() => {
    if (!selectedYear) return [];
    return filterDataframe(state.data, state.userRole, state.userEmail, filterModel, selectedYear, state.userRole === 'MA' ? state.directReportsOnly : false);
  }, [state.data, state.userRole, state.userEmail, filterModel, selectedYear, state.directReportsOnly]);

  const fullNames = useMemo(() => {
    return ['Zobraz všechny', ...new Set(filteredData.map((r) => r.FULL_NAME).filter(Boolean))];
  }, [filteredData]);

  const displayData = useMemo(() => {
    if (state.userRole === 'MA' && selectedName !== 'Zobraz všechny') {
      return maskDataForOneOnOne(filteredData, selectedName);
    }
    return filteredData;
  }, [filteredData, state.userRole, selectedName]);

  const chartData = useMemo(() => preprocessForCharts(displayData), [displayData]);

  if (!state.selectedFilterName && state.userRole !== 'MA') {
    return (
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 animate-fade-in">
        <div className="flex items-center gap-3 p-5 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-700 text-sm">
          <svg className="w-5 h-5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pro zobrazení dat nejprve vyberte filtr v záložce &#39;Hodnocení&#39;.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {state.userRole === 'MA' && (
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Schůzka 1-on-1
          </label>
          <select
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full max-w-md border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {fullNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <Expander title="Výkon v dimenzích CO a JAK" defaultOpen={false}>
        <FiveGrid data={chartData} period="current" />
      </Expander>

      <Expander title="Výkon v dimenzích CO, JAK a POTENCIÁL" defaultOpen={false}>
        <ThreeGrid data={chartData} period="current" />
      </Expander>

      <Expander title="COMPARATIO — Porovnání hodnocení" defaultOpen={false}>
        <ComparatioChart data={chartData} />
      </Expander>

      <Expander title="Vývoj CO a JAK v čase" defaultOpen={false}>
        <TrendChart fullData={state.data} filteredData={displayData} />
      </Expander>
    </div>
  );
}
