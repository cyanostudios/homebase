import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { NavPage } from '@/core/navigation/navTypes';

export type CompanionPanelContextType = {
  companionPlugin: NavPage | null;
  openCompanionPanel: (plugin: NavPage) => void;
  closeCompanionPanel: () => void;
  toggleCompanionPanel: (plugin: NavPage) => void;
};

const CompanionPanelContext = createContext<CompanionPanelContextType | null>(null);

export function CompanionPanelProvider({ children }: { children: ReactNode }) {
  const [companionPlugin, setCompanionPlugin] = useState<NavPage | null>(null);

  const openCompanionPanel = useCallback((plugin: NavPage) => {
    setCompanionPlugin(plugin);
  }, []);

  const closeCompanionPanel = useCallback(() => {
    setCompanionPlugin(null);
  }, []);

  const toggleCompanionPanel = useCallback((plugin: NavPage) => {
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
