import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
  LEFT_SIDEBAR_COLLAPSED_WIDTH_PX,
  LEFT_SIDEBAR_EXPANDED_WIDTH_PX,
  readLeftSidebarCollapsed,
  writeLeftSidebarCollapsed,
} from '@/core/ui/sidebar/leftSidebarLayout';

type LeftSidebarContextValue = {
  collapsed: boolean;
  widthPx: number;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
};

const LeftSidebarContext = createContext<LeftSidebarContextValue | null>(null);

export function LeftSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(readLeftSidebarCollapsed);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    writeLeftSidebarCollapsed(next);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeLeftSidebarCollapsed(next);
      return next;
    });
  }, []);

  const value = useMemo<LeftSidebarContextValue>(
    () => ({
      collapsed,
      widthPx: collapsed ? LEFT_SIDEBAR_COLLAPSED_WIDTH_PX : LEFT_SIDEBAR_EXPANDED_WIDTH_PX,
      setCollapsed,
      toggleCollapsed,
    }),
    [collapsed, setCollapsed, toggleCollapsed],
  );

  return <LeftSidebarContext.Provider value={value}>{children}</LeftSidebarContext.Provider>;
}

export function useLeftSidebar(): LeftSidebarContextValue {
  const ctx = useContext(LeftSidebarContext);
  if (!ctx) {
    throw new Error('useLeftSidebar must be used within LeftSidebarProvider');
  }
  return ctx;
}
