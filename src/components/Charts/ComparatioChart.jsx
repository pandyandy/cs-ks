import { useMemo, lazy, Suspense } from 'react';
import { prepareComparatioData } from '@/lib/chartUtils';

const Plot = lazy(() => import('./PlotlyWrapper'));

export default function ComparatioChart({ data }) {
  const chartConfig = useMemo(() => prepareComparatioData(data), [data]);

  if (!chartConfig) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
        Žádná data k zobrazení pro COMPARATIO graf.
      </div>
    );
  }

  const traces = [];

  // Trend line (behind bubbles)
  if (chartConfig.trendLine) {
    traces.push({
      x: chartConfig.trendLine.x,
      y: chartConfig.trendLine.y,
      mode: 'lines',
      line: { color: '#83c9ff', width: 2 },
      name: 'Trend',
      hoverinfo: 'skip',
    });
  }

  // Bubbles
  traces.push({
    x: chartConfig.bubbles.map((b) => b.x),
    y: chartConfig.bubbles.map((b) => b.y),
    mode: 'markers',
    marker: {
      size: chartConfig.bubbles.map((b) => Math.max(8, Math.min(20, 8 + b.count * 2))),
      color: '#0068c9',
      opacity: 0.8,
      line: { width: 1, color: 'white' },
    },
    hovertemplate: chartConfig.bubbles.map(
      (b) =>
        `<b>CO+JAK</b>: ${b.x}<br><b>COMPARATIO</b>: ${b.y}%<br><b>Lidé:</b><br>${b.names.join('<br>')}<extra></extra>`
    ),
    showlegend: false,
    type: 'scatter',
  });

  const annotations = chartConfig.bubbles.map((b) => ({
    x: b.x,
    y: b.y,
    text: b.displayText,
    showarrow: false,
    xshift: 30,
    yshift: 0,
    font: { size: 10, color: 'black' },
    align: 'center',
  }));

  const layout = {
    xaxis: {
      title: 'Součet CO + JAK',
      gridcolor: 'lightgray',
      showgrid: true,
      dtick: 1,
      range: chartConfig.xRange,
    },
    yaxis: {
      title: 'COMPARATIO (%)',
      gridcolor: 'lightgray',
      showgrid: true,
      range: chartConfig.yRange,
    },
    plot_bgcolor: 'white',
    height: 700,
    showlegend: false,
    annotations,
    margin: { t: 20, b: 60, l: 60, r: 20 },
  };

  return (
    <Suspense fallback={<div className="text-sm text-gray-400 p-4">Načítám graf...</div>}>
      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true }}
        style={{ width: '100%' }}
      />
    </Suspense>
  );
}
