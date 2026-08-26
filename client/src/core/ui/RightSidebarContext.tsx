import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** DOM id for the plugin detail-column portal target inside AppRightSidebar. */
export const RIGHT_SIDEBAR_PLUGIN_SLOT_ID = 'right-sidebar-plugin-slot';

export const RIGHT_SIDEBAR_EXPANDED_WIDTH_PX = 280;
export const RIGHT_SIDEBAR_COLLAPSED_WIDTH_PX = 40;

interface RightSidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  /** Portal target for plugin DetailLayout `sidebar` content; null when closed or unmounted. */
  pluginSlotElement: HTMLElement | null;
  setPluginSlotElement: (el: HTMLElement | null) => void;
}

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null);

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pluginSlotElement, setPluginSlotElement] = useState<HTMLElement | null>(null);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      toggle,
      open,
      close,
      pluginSlotElement,
      setPluginSlotElement,
    }),
    [isOpen, toggle, open, close, pluginSlotElement],
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
