
import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';

export default function LockDialog({ rows, onClose }) {
  const { state, saveChanges } = useApp();
  const [locking, setLocking] = useState(false);

  const handleLock = useCallback(async () => {
    setLocking(true);
    try {
      const lockedRows = rows.map((row) => ({
        USER_ID: row.USER_ID,
        YEAR: row.YEAR,
        EVALUATION: row.EVALUATION,
        IS_LOCKED: 1,
      }));
      await saveChanges(lockedRows, state.data, state.userEmail);
      onClose();
    } finally {
      setLocking(false);
    }
  }, [rows, state.data, state.userEmail, saveChanges, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-popup p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Potvrdit uzamčení</h3>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-5">
          Kliknutím na <strong>Ano</strong> uzamknete hodnocení všech aktuálně
          vyfiltrovaných záznamů ({rows.length}). Manažer nebude mít po uzamčení
          možnost editace. Business Partner bude mít možnost editovat po dobu
          30 dní od uzamčení.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleLock}
            disabled={locking}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {locking ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Zamykání...
              </span>
            ) : 'Ano, uzamknout'}
          </button>
          <button
            onClick={onClose}
            disabled={locking}
            className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
