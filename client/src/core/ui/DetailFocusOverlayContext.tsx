import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type DetailFocusOverlayContextValue = {
  active: boolean;
  setActive: (active: boolean) => void;
};

const DetailFocusOverlayContext = createContext<DetailFocusOverlayContextValue>({
  active: false,
  setActive: () => {},
});

/** Lets detail views dim chrome while keeping DetailPanel header actions above the overlay. */
export function DetailFocusOverlayProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState(false);
  const setActive = useCallback((next: boolean) => {
    setActiveState(next);
  }, []);
  const value = useMemo(() => ({ active, setActive }), [active, setActive]);
  return (
    <DetailFocusOverlayContext.Provider value={value}>
      {children}
    </DetailFocusOverlayContext.Provider>
  );
}

export function useDetailFocusOverlay(): DetailFocusOverlayContextValue {
  return useContext(DetailFocusOverlayContext);
}
