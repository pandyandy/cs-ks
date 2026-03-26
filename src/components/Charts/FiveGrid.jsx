import { useMemo } from 'react';
import { build5GridPivot, categorize5Grid, calculateCategorySummary } from '@/lib/chartUtils';
import CategorySummary from './CategorySummary';

const JAK_VALUES = [0, 1, 2, 3, 4, 5];

function getCellStyle(co, jak) {
  co = Number(co);
  if (co === 1 && jak >= 1) return { backgroundColor: '#2970ED', color: 'white' };
  if (jak === 1 && co >= 1) return { backgroundColor: '#2970ED', color: 'white' };
  if (co === 2 && jak === 2) return { backgroundColor: '#2970ED', color: 'white' };
  if ([3, 4, 5].includes(co) && jak === 2) return { backgroundColor: 'lightblue' };
  if ([2, 3, 4, 5].includes(co) && jak === 3) return { backgroundColor: 'lightblue' };
  if ([2, 3].includes(co) && [4, 5].includes(jak)) return { backgroundColor: 'lightblue' };
  return {};
}

export default function FiveGrid({ data, period = 'current' }) {
  const coKey = period === 'previous' ? 'CO_PREVIOUS' : 'CO';
  const pivotData = useMemo(() => build5GridPivot(data, period), [data, period]);
  const summary = useMemo(
    () => calculateCategorySummary(data, (row) => categorize5Grid(row.CO, row.JAK)),
    [data]
  );

  return (
    <div>
      <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-500 min-w-[50px]">
                {coKey}\JAK
              </th>
              {JAK_VALUES.map((jak) => (
                <th key={jak} className="border border-gray-200 px-2 py-1.5 font-semibold text-gray-500 text-center">
                  {jak}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pivotData.map((row) => (
              <tr key={row[coKey]}>
                <td className="border border-gray-200 px-2 py-1.5 font-semibold bg-gray-50 text-center">
                  {row[coKey]}
                </td>
                {JAK_VALUES.map((jak) => (
                  <td
                    key={jak}
                    style={getCellStyle(row[coKey], jak)}
                    className="border border-gray-200 px-2 py-1.5 align-top whitespace-pre-wrap min-w-[120px]"
                  >
                    {row[String(jak)]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CategorySummary items={summary} />
    </div>
  );
}
