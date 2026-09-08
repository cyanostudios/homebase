import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isRegisteredCompanionPlugin } from '@/core/companion/getCompanionCandidates';
import type { NavPage } from '@/core/navigation/navTypes';

const COMPANION_SESSION_KEY = 'homebase.companionPlugin';

function readStoredCompanion(): NavPage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(COMPANION_SESSION_KEY);
    if (!raw || raw.length === 0) {
      return null;
    }
    if (!isRegisteredCompanionPlugin(raw)) {
      window.sessionStorage.removeItem(COMPANION_SESSION_KEY);
      return null;
    }
    return raw as NavPage;
  } catch {
    return null;
  }
}

function writeStoredCompanion(plugin: NavPage | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (plugin && isRegisteredCompanionPlugin(plugin)) {
      window.sessionStorage.setItem(COMPANION_SESSION_KEY, plugin);
    } else {
      window.sessionStorage.removeItem(COMPANION_SESSION_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export type CompanionPanelContextType = {
  companionPlugin: NavPage | null;
  openCompanionPanel: (plugin: NavPage) => void;
  closeCompanionPanel: () => void;
  toggleCompanionPanel: (plugin: NavPage) => void;
};

const CompanionPanelContext = createContext<CompanionPanelContextType | null>(null);

export function CompanionPanelProvider({ children }: { children: ReactNode }) {
  const [companionPlugin, setCompanionPlugin] = useState<NavPage | null>(() =>
    readStoredCompanion(),
  );

  useEffect(() => {
    writeStoredCompanion(companionPlugin);
  }, [companionPlugin]);

  const openCompanionPanel = useCallback((plugin: NavPage) => {
    if (!isRegisteredCompanionPlugin(plugin)) {
      return;
    }
    setCompanionPlugin(plugin);
  }, []);

  const closeCompanionPanel = useCallback(() => {
    setCompanionPlugin(null);
  }, []);

  const toggleCompanionPanel = useCallback((plugin: NavPage) => {
    if (!isRegisteredCompanionPlugin(plugin)) {
      return;
    }
    setCompanionPlugin((current) => (current === plugin ? null : plugin));
  }, []);

  const value = useMemo(
    () => ({
      companionPlugin,
      openCompanionPanel,
      closeCompanionPanel,
      toggleCompanionPanel,
    }),
    [companionPlugin, openCompanionPanel, closeCompanionPanel, toggleCompanionPanel],
  );

  return <CompanionPanelContext.Provider value={value}>{children}</CompanionPanelContext.Provider>;
}

export function useCompanionPanel(): CompanionPanelContextType {
  const ctx = useContext(CompanionPanelContext);
  if (!ctx) {
    throw new Error('useCompanionPanel must be used within CompanionPanelProvider');
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider. */
export function useCompanionPanelOptional(): CompanionPanelContextType | null {
  return useContext(CompanionPanelContext);
}
