// client/src/plugins/sportadmin/context/SportadminContext.tsx
import React, { createContext, useContext } from 'react';

export interface SportadminContextType {
  isSportadminPanelOpen: boolean;
}

const SportadminContext = createContext<SportadminContextType | undefined>(undefined);

export function useSportadminContext() {
  const context = useContext(SportadminContext);
  if (context === undefined) {
    throw new Error('useSportadminContext must be used within a SportadminProvider');
  }
  return context;
}

const EMPTY_SPORTADMIN_CONTEXT: SportadminContextType = {
  isSportadminPanelOpen: false,
};

export function SportadminNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <SportadminContext.Provider value={EMPTY_SPORTADMIN_CONTEXT}>
      {children}
    </SportadminContext.Provider>
  );
}

export { SportadminContext };
