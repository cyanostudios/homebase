// client/src/core/ui/ContentLayoutContext.tsx
// Context for allowing list components to inject content into ContentHeader

import React, { createContext, useContext, ReactNode, useCallback } from 'react';

interface ContentLayoutContextType {
  setHeaderTrailing: (node: ReactNode) => void;
  setHeaderTitleExtra: (node: ReactNode) => void;
}

const ContentLayoutContext = createContext<ContentLayoutContextType | undefined>(undefined);

export function useContentLayout() {
  const context = useContext(ContentLayoutContext);
  if (!context) {
    throw new Error('useContentLayout must be used within ContentLayoutProvider');
  }
  return context;
}

interface ContentLayoutProviderProps {
  children: ReactNode;
  onTrailingChange: (node: ReactNode) => void;
  onTitleExtraChange?: (node: ReactNode) => void;
}

export function ContentLayoutProvider({
  children,
  onTrailingChange,
  onTitleExtraChange,
}: ContentLayoutProviderProps) {
  const setHeaderTrailing = useCallback(
    (node: ReactNode) => {
      onTrailingChange(node);
    },
    [onTrailingChange],
  );

  const setHeaderTitleExtra = useCallback(
    (node: ReactNode) => {
      onTitleExtraChange?.(node);
    },
    [onTitleExtraChange],
  );

  return (
    <ContentLayoutContext.Provider value={{ setHeaderTrailing, setHeaderTitleExtra }}>
      {children}
    </ContentLayoutContext.Provider>
  );
}
