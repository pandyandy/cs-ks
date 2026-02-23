'use client';

import { useState } from 'react';

export default function Expander({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-card mb-3 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50/70 transition-colors"
      >
        <span className="font-semibold text-sm text-gray-800">{title}</span>
        <div className={`flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
