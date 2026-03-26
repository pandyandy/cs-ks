
export default function HelpTab() {
  const confluenceUrl = 'https://cnfl.csin.cz/pages/viewpage.action?pageId=1509163068';

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              Aplikace poskytuje rozhraní pro správu hodnocení zaměstnanců v rámci procesu
              Kulaté stoly. Využijte její funkce pro filtrování a editaci dat a ukládání
              provedených změn, rovněž pak dostupné vizualizace hodnocených skupin
              zaměstnanců.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-1.5">
                Potřebujete více informací?
              </h3>
              <p className="text-gray-600 text-sm">
                Podrobné instrukce a průvodce naleznete v{' '}
                <a
                  href={confluenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:text-primary-dark hover:underline transition-colors"
                >
                  plném manuálu na Confluence
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
