import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Fixed narrow rail width (desktop). Panel does not expand. */
export const RIGHT_SIDEBAR_WIDTH_PX = 48;

/** Slide-out panel width, anchored to the rail’s inner edge. */
export const RIGHT_SIDEBAR_FLYOUT_WIDTH_PX = 320;

export type RightSidebarPanelId = 'pomodoro' | 'timer' | 'user';

interface RightSidebarContextValue {
  activePanel: RightSidebarPanelId | null;
  openPanel: (id: RightSidebarPanelId) => void;
  closePanel: () => void;
  togglePanel: (id: RightSidebarPanelId) => void;
}

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null);

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<RightSidebarPanelId | null>(null);

  const openPanel = useCallback((id: RightSidebarPanelId) => {
    setActivePanel(id);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const togglePanel = useCallback((id: RightSidebarPanelId) => {
    setActivePanel((current) => (current === id ? null : id));
  }, []);

  const value = useMemo(
    () => ({
      activePanel,
      openPanel,
      closePanel,
      togglePanel,
    }),
    [activePanel, openPanel, closePanel, togglePanel],
  );

  return <RightSidebarContext.Provider value={value}>{children}</RightSidebarContext.Provider>;
}

export function useRightSidebar(): RightSidebarContextValue {
  const ctx = useContext(RightSidebarContext);
  if (!ctx) {
    throw new Error('useRightSidebar must be used within RightSidebarProvider');
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider (e.g. tests). */
export function useRightSidebarOptional(): RightSidebarContextValue | null {
  return useContext(RightSidebarContext);
}
