'use client';

import { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

const initialState = {
  data: [],
  originalData: [],
  lastSavedData: [],
  filteredData: [],
  changedRows: [],
  userRole: null,
  userEmail: null,
  loading: false,
  error: null,
  userFilters: [],
  filterNames: [],
  selectedFilterName: '',
  selectedYear: null,
  directReportsOnly: false,
  unsavedWarning: false,
  gridRefreshTimestamp: 0,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_DATA':
      return {
        ...state,
        data: action.payload,
        originalData: action.payload,
        lastSavedData: action.payload,
        loading: false,
        error: null,
      };
    case 'SET_FILTERED_DATA':
      return { ...state, filteredData: action.payload };
    case 'SET_CHANGED_ROWS':
      return {
        ...state,
        changedRows: action.payload,
        unsavedWarning: action.payload.length > 0,
      };
    case 'SET_USER':
      return {
        ...state,
        userRole: action.payload.role,
        userEmail: action.payload.email,
      };
    case 'SET_FILTERS':
      return {
        ...state,
        userFilters: action.payload.filters,
        filterNames: action.payload.filterNames,
      };
    case 'SET_SELECTED_FILTER':
      return { ...state, selectedFilterName: action.payload };
    case 'SET_SELECTED_YEAR':
      return { ...state, selectedYear: action.payload };
    case 'SET_DIRECT_REPORTS_ONLY':
      return { ...state, directReportsOnly: action.payload };
    case 'CLEAR_CHANGES':
      return { ...state, changedRows: [], unsavedWarning: false };
    case 'RELOAD_DATA':
      return {
        ...state,
        data: action.payload,
        originalData: action.payload,
        lastSavedData: action.payload,
        changedRows: [],
        unsavedWarning: false,
        gridRefreshTimestamp: Date.now(),
      };
    case 'SET_LAST_SAVED':
      return { ...state, lastSavedData: action.payload };
    case 'SET_GRID_REFRESH':
      return { ...state, gridRefreshTimestamp: Date.now() };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const loadData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load data');
      const { data } = await res.json();
      dispatch({ type: 'SET_DATA', payload: data });
      return data;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      return [];
    }
  }, []);

  const reloadData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to reload data');
      const { data } = await res.json();
      dispatch({ type: 'RELOAD_DATA', payload: data });
      return data;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      return [];
    }
  }, []);

  const loadFilters = useCallback(async (email) => {
    try {
      const res = await fetch(`/api/filters?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Failed to load filters');
      const { filters, filterNames } = await res.json();
      dispatch({ type: 'SET_FILTERS', payload: { filters, filterNames } });
      return { filters, filterNames };
    } catch {
      dispatch({ type: 'SET_FILTERS', payload: { filters: [], filterNames: [] } });
      return { filters: [], filterNames: [] };
    }
  }, []);

  const saveFilter = useCallback(async (email, filterName, filterModel) => {
    try {
      const res = await fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email, filterName, filterModel }),
      });
      if (!res.ok) throw new Error('Failed to save filter');
      await loadFilters(email);
      return true;
    } catch {
      return false;
    }
  }, [loadFilters]);

  const saveChanges = useCallback(async (changedRows, originalData, userEmail) => {
    try {
      const res = await fetch('/api/data/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changedRows, originalData, userEmail }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      dispatch({ type: 'CLEAR_CHANGES' });
      await reloadData();
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      return false;
    }
  }, [reloadData]);

  const value = {
    state,
    dispatch,
    loadData,
    reloadData,
    loadFilters,
    saveFilter,
    saveChanges,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
