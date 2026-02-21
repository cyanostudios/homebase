// client/src/core/ui/ContentLayoutContext.tsx
// Context for allowing list components to inject content into ContentHeader

import React, { createContext, useContext, ReactNode, useCallback } from 'react';

interface ContentLayoutContextType {
  setHeaderTrailing: (node: ReactNode) => void;
  setHeaderTitleSuffix: (node: ReactNode) => void;
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
  onTitleSuffixChange?: (node: ReactNode) => void;
}

export function ContentLayoutProvider({
  children,
  onTrailingChange,
  onTitleSuffixChange,
}: ContentLayoutProviderProps) {
  const setHeaderTrailing = useCallback(
    (node: ReactNode) => {
      onTrailingChange(node);
    },
    [onTrailingChange],
  );
  const setHeaderTitleSuffix = useCallback(
    (node: ReactNode) => {
      onTitleSuffixChange?.(node);
    },
    [onTitleSuffixChange],
  );

  return (
    <ContentLayoutContext.Provider value={{ setHeaderTrailing, setHeaderTitleSuffix }}>
      {children}
    </ContentLayoutContext.Provider>
  );
}
