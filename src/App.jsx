import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import Header from '@/components/Header';
import Tabs from '@/components/Tabs';
import EvaluationTab from '@/components/EvaluationTab';
import ReportsTab from '@/components/ReportsTab';
import FilterManagementTab from '@/components/FilterManagementTab';
import HelpTab from '@/components/HelpTab';
import { ROLES } from '@/lib/constants';

const TAB_DEFINITIONS = [
  { id: 'evaluation', label: 'Hodnocení' },
  { id: 'reports', label: 'Reporty' },
  { id: 'filters', label: 'Nastavení filtrů' },
  { id: 'help', label: 'Nápověda' },
];

export default function App() {
  const { state, dispatch, loadData, loadFilters } = useApp();
  const [activeTab, setActiveTab] = useState('evaluation');
  const [initialized, setInitialized] = useState(false);

  const [devEmail, setDevEmail] = useState('admin@csas.cz');
  const [devRole, setDevRole] = useState('DEV');
  const [devPanelOpen, setDevPanelOpen] = useState(true);

  useEffect(() => {
    if (initialized) return;
    dispatch({ type: 'SET_USER', payload: { role: 'DEV', email: devEmail || '' } });
    setInitialized(true);
  }, [initialized, dispatch, devEmail]);

  useEffect(() => {
    if (state.data.length === 0 && !state.loading) loadData();
  }, [state.data.length, state.loading, loadData]);

  useEffect(() => {
    if (state.userEmail) loadFilters(state.userEmail);
  }, [state.userEmail, loadFilters]);

  const handleDevEmailChange = useCallback((email) => {
    setDevEmail(email);
    dispatch({ type: 'SET_USER', payload: { role: devRole, email: email.toLowerCase() } });
  }, [dispatch, devRole]);

  const handleDevRoleChange = useCallback((role) => {
    setDevRole(role);
    dispatch({ type: 'SET_USER', payload: { role, email: state.userEmail || devEmail } });
  }, [dispatch, state.userEmail, devEmail]);

  if (state.loading && state.data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-500 text-sm font-medium">Načítám data...</p>
        </div>
      </div>
    );
  }

  if (state.error && state.data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken px-4">
        <div className="bg-white rounded-2xl shadow-elevated border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Chyba při načítání dat</h3>
          <p className="text-sm text-gray-500 mb-5">{state.error}</p>
          <button
            onClick={loadData}
            className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark shadow-sm transition-all"
          >
            Zkusit znovu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-5 py-4">
      <button
        onClick={() => setDevPanelOpen(!devPanelOpen)}
        className="fixed top-4 right-4 z-50 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-all"
        title="Toggle dev panel"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {devPanelOpen && (
        <div className="fixed top-16 right-4 z-50 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-popup p-4 w-56 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dev panel</span>
            </div>
            <button onClick={() => setDevPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-0.5">Email</label>
              <input
                type="text"
                value={devEmail}
                onChange={(e) => handleDevEmailChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-0.5">Role</label>
              <select
                value={devRole}
                onChange={(e) => handleDevRoleChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-gray-400 pt-1">
              Active: <span className="font-semibold text-gray-600">{state.userRole}</span> · {state.userEmail}
            </p>
          </div>
        </div>
      )}

      <Header text={`Uživatel: ${state.userEmail || ''}`} />
      <Tabs tabs={TAB_DEFINITIONS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-1">
        {activeTab === 'evaluation' && <EvaluationTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'filters' && <FilterManagementTab />}
        {activeTab === 'help' && <HelpTab />}
      </div>
    </div>
  );
}
