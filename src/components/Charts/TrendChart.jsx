import { useMemo, lazy, Suspense } from 'react';
import { prepareTrendData } from '@/lib/chartUtils';

const Plot = lazy(() => import('./PlotlyWrapper'));

export default function TrendChart({ fullData, filteredData }) {
  const trendData = useMemo(
    () => prepareTrendData(fullData, filteredData),
    [fullData, filteredData]
  );

  if (!trendData.length) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
        Žádná data k zobrazení.
      </div>
    );
  }

  const traces = [
    {
      x: trendData.map((d) => d.year),
      y: trendData.map((d) => d.JAK),
      name: 'JAK',
      type: 'bar',
    },
    {
      x: trendData.map((d) => d.year),
      y: trendData.map((d) => d.CO),
      name: 'CO',
      type: 'bar',
    },
  ];

  const layout = {
    barmode: 'group',
    xaxis: { title: 'Rok' },
    yaxis: { title: 'CO a JAK' },
    height: 300,
    margin: { t: 20, b: 60, l: 60, r: 20 },
  };

  return (
    <div>
      <h4 className="text-sm font-bold mb-2">Vývoj CO a JAK v čase</h4>
      <Suspense fallback={<div className="text-sm text-gray-400 p-4">Načítám graf...</div>}>
        <Plot
          data={traces}
          layout={layout}
          config={{ responsive: true }}
          style={{ width: '100%' }}
        />
      </Suspense>
    </div>
  );
}
