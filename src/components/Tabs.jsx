'use client';

export default function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 mb-5 px-1">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-5 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
