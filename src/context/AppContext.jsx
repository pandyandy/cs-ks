
import { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);
const API_BASE = '';

const STORAGE_KEYS = {
  EMPLOYEES: 'cs-ks-employees',
  FILTERS: 'cs-ks-filters',
};

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

function processRow(row) {
  const evaluation = row.EVALUATION != null ? parseInt(row.EVALUATION, 10) : null;
  const yearEval = evaluation != null ? `${row.YEAR}-${evaluation}` : `${row.YEAR}-NA`;
  return {
    ...row,
    YEAR_EVALUATION: yearEval,
    DIRECT_MANAGER_EMAIL: (row.DIRECT_MANAGER_EMAIL || '').toLowerCase(),
    EMAIL_ADDRESS: (row.EMAIL_ADDRESS || '').toLowerCase(),
  };
}

function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function apiAvailable() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/health`, {}, 5000);
    return res.ok;
  } catch {
    return false;
  }
}

function getStored(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setStored(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage full */ }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const loadData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const hasApi = await apiAvailable();
      let data;

      if (hasApi) {
        const res = await fetchWithTimeout(`${API_BASE}/api/data`, {}, 60000);
        if (!res.ok) throw new Error('Failed to load data from API');
        ({ data } = await res.json());
      } else {
        const stored = getStored(STORAGE_KEYS.EMPLOYEES);
        let rows;
        if (stored && stored.length > 0) {
          rows = stored;
        } else {
          const res = await fetch('/data/employees.json');
          if (!res.ok) throw new Error('Failed to load data');
          rows = await res.json();
          setStored(STORAGE_KEYS.EMPLOYEES, rows);
        }
        data = rows.map(processRow);
        data.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
      }

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
      const hasApi = await apiAvailable();
      let data;

      if (hasApi) {
        const res = await fetchWithTimeout(`${API_BASE}/api/data`, {}, 60000);
        if (!res.ok) throw new Error('Failed to reload data');
        ({ data } = await res.json());
      } else {
        const stored = getStored(STORAGE_KEYS.EMPLOYEES);
        const rows = stored && stored.length > 0 ? stored : [];
        data = rows.map(processRow);
        data.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
      }

      dispatch({ type: 'RELOAD_DATA', payload: data });
      return data;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      return [];
    }
  }, []);

  const loadFilters = useCallback(async (email) => {
    try {
      const hasApi = await apiAvailable();

      if (hasApi) {
        const res = await fetchWithTimeout(
          `${API_BASE}/api/filters?email=${encodeURIComponent(email)}`,
          {},
          30000
        );
        if (!res.ok) throw new Error('Failed to load filters');
        const { filters, filterNames } = await res.json();
        dispatch({ type: 'SET_FILTERS', payload: { filters, filterNames } });
        return { filters, filterNames };
      }

      let allFilters = getStored(STORAGE_KEYS.FILTERS);
      if (!allFilters) {
        const res = await fetch('/data/filters.json');
        if (!res.ok) throw new Error('Failed to load filters');
        allFilters = await res.json();
        setStored(STORAGE_KEYS.FILTERS, allFilters);
      }

      const userFilters = allFilters.filter((f) => f.FILTER_CREATOR === email);
      const filterNames = userFilters.map((f) => f.FILTER_NAME);
      dispatch({ type: 'SET_FILTERS', payload: { filters: userFilters, filterNames } });
      return { filters: userFilters, filterNames };
    } catch {
      dispatch({ type: 'SET_FILTERS', payload: { filters: [], filterNames: [] } });
      return { filters: [], filterNames: [] };
    }
  }, []);

  const saveFilter = useCallback(async (email, filterName, filterModel) => {
    try {
      const hasApi = await apiAvailable();

      if (hasApi) {
        const res = await fetchWithTimeout(`${API_BASE}/api/filters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: email, filterName, filterModel }),
        }, 30000);
        if (!res.ok) throw new Error('Failed to save filter');
        await loadFilters(email);
        return true;
      }

      let allFilters = getStored(STORAGE_KEYS.FILTERS) || [];
      const existingIdx = allFilters.findIndex(
        (f) => f.FILTER_NAME === filterName && f.FILTER_CREATOR === email
      );
      const filterRecord = {
        FILTER_NAME: filterName,
        FILTER_CREATOR: email,
        FILTERED_VALUES: JSON.stringify(filterModel || {}),
      };
      if (existingIdx >= 0) {
        allFilters[existingIdx] = filterRecord;
      } else {
        allFilters.push(filterRecord);
      }
      setStored(STORAGE_KEYS.FILTERS, allFilters);
      await loadFilters(email);
      return true;
    } catch {
      return false;
    }
  }, [loadFilters]);

  const saveChanges = useCallback(async (changedRows, originalData, userEmail) => {
    try {
      const hasApi = await apiAvailable();

      if (hasApi) {
        const res = await fetchWithTimeout(`${API_BASE}/api/data/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changedRows, originalData, userEmail }),
        }, 120000);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save');
        }
        dispatch({ type: 'CLEAR_CHANGES' });
        await reloadData();
        return true;
      }

      const PK_COLUMNS = ['USER_ID', 'YEAR', 'EVALUATION'];
      const COLUMNS_TO_UPDATE = [
        'HODNOTY', 'VYKON', 'POTENCIAL', 'POZNAMKY', 'NASTUPCE',
        'PRAVDEPODOBNOST_ODCHODU', 'IS_LOCKED', 'MOZNY_KARIERNI_POSUN',
        'LOCKED_TIMESTAMP', 'HIST_DATA_MODIFIED_BY', 'HIST_DATA_MODIFIED_WHEN',
      ];

      const stored = getStored(STORAGE_KEYS.EMPLOYEES);
      if (!stored) throw new Error('No data in storage');

      const now = new Date().toISOString().replace('T', ' ').slice(0, 23);
      const indexMap = new Map();
      for (let i = 0; i < stored.length; i++) {
        const key = `${stored[i].USER_ID}_${stored[i].YEAR}_${stored[i].EVALUATION}`;
        indexMap.set(key, i);
      }

      for (const changed of changedRows) {
        const key = PK_COLUMNS.map((c) => changed[c]).join('_');
        const idx = indexMap.get(key);
        if (idx == null) continue;
        const row = stored[idx];
        for (const col of COLUMNS_TO_UPDATE) {
          if (changed[col] !== undefined) row[col] = changed[col];
        }
        row.HIST_DATA_MODIFIED_BY = userEmail;
        row.HIST_DATA_MODIFIED_WHEN = now;
        for (const col of ['IS_LOCKED', 'HODNOTY', 'VYKON']) {
          row[col] = parseInt(row[col], 10) || 0;
        }
        if (
          row.IS_LOCKED === 1 &&
          (!row.LOCKED_TIMESTAMP ||
            row.LOCKED_TIMESTAMP === '1970-01-01 00:00:00.000' ||
            row.LOCKED_TIMESTAMP === '')
        ) {
          row.LOCKED_TIMESTAMP = now;
        }
      }

      setStored(STORAGE_KEYS.EMPLOYEES, stored);
      dispatch({ type: 'CLEAR_CHANGES' });

      const data = stored.map(processRow);
      data.sort((a, b) => (a.FULL_NAME || '').localeCompare(b.FULL_NAME || ''));
      dispatch({ type: 'RELOAD_DATA', payload: data });
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
