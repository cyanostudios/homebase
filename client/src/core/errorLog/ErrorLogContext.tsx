import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { clearApiErrors, getApiErrorEntries, subscribe, type ApiErrorEntry } from './apiErrorStore';
import { installApiErrorCapture } from './installFetchWrapper';

interface ErrorLogContextValue {
  entries: ApiErrorEntry[];
  count: number;
  clear: () => void;
}

const ErrorLogContext = createContext<ErrorLogContextValue | undefined>(undefined);

export function ErrorLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ApiErrorEntry[]>([]);

  useEffect(() => {
    installApiErrorCapture();
    setEntries(getApiErrorEntries());
    const unsub = subscribe(() => setEntries(getApiErrorEntries()));
    return unsub;
  }, []);

  const clear = useCallback(() => {
    clearApiErrors();
    setEntries([]);
  }, []);

  const value: ErrorLogContextValue = {
    entries,
    count: entries.length,
    clear,
  };

  return (
    <ErrorLogContext.Provider value={value}>{children}</ErrorLogContext.Provider>
  );
}

export function useErrorLog(): ErrorLogContextValue {
  const ctx = useContext(ErrorLogContext);
  if (!ctx) {
    throw new Error('useErrorLog must be used within ErrorLogProvider');
  }
  return ctx;
}
