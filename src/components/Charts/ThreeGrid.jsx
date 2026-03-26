import { useMemo } from 'react';
import { build3GridPivot, categorize3Grid, calculateCategorySummary } from '@/lib/chartUtils';
import CategorySummary from './CategorySummary';

const POT_VALUES = ['nízký', 'střední', 'vysoký', '0'];

function getCellStyle(coJak, field, period) {
  const primary = period === 'current' ? '#2970ED' : 'grey';
  const secondary = period === 'current' ? 'lightblue' : 'lightgrey';

  if (coJak === '1-3' && ['nízký', 'střední'].includes(field)) return { backgroundColor: primary, color: 'white' };
  if (coJak === '4-7' && ['nízký', 'střední'].includes(field)) return { backgroundColor: secondary };
  if (coJak === '8-10' && field === 'nízký') return { backgroundColor: secondary };
  if (coJak === '1-3' && field === 'vysoký') return { backgroundColor: secondary };
  return {};
}

export default function ThreeGrid({ data, period = 'current' }) {
  const pivotData = useMemo(() => build3GridPivot(data, period), [data, period]);
  const summary = useMemo(
    () => calculateCategorySummary(data, (row) => categorize3Grid(row.CO, row.JAK, row.POTENCIAL)),
    [data]
  );

  return (
    <div>
      <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-500 min-w-[70px]">
                CO+JAK
              </th>
              {POT_VALUES.map((pot) => (
                <th key={pot} className="border border-gray-200 px-2 py-1.5 font-semibold text-gray-500 text-center">
                  {pot}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pivotData.map((row) => (
              <tr key={row.CO_JAK}>
                <td className="border border-gray-200 px-2 py-1.5 font-semibold bg-gray-50 text-center">
                  {row.CO_JAK}
                </td>
                {POT_VALUES.map((pot) => (
                  <td
                    key={pot}
                    style={getCellStyle(row.CO_JAK, pot, period)}
                    className="border border-gray-200 px-2 py-1.5 align-top whitespace-pre-wrap min-w-[150px]"
                  >
                    {row[pot]}
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
