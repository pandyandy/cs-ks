
const CATEGORY_COLORS = {
  Top: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100' },
  Middle: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  Low: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100' },
  'Nehodnocení': { bg: 'bg-gray-50', text: 'text-gray-500', badge: 'bg-gray-100' },
};

export default function CategorySummary({ items }) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      {items.map(({ name, count, percentage }) => {
        const colors = CATEGORY_COLORS[name] || CATEGORY_COLORS['Nehodnocení'];
        return (
          <div
            key={name}
            className={`${colors.bg} rounded-xl p-3 text-center`}
          >
            <p className={`text-xs font-semibold ${colors.text} uppercase tracking-wider mb-1`}>
              {name}
            </p>
            <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{percentage}%</p>
          </div>
        );
      })}
    </div>
  );
}
