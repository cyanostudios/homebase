import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

type ViewMode = 'club';

interface ViewModeContextType {
  viewMode: ViewMode;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode] = useState<ViewMode>('club');
  const [, setLocation] = useLocation();

  useEffect(() => {
    localStorage.removeItem('contactId');
    localStorage.removeItem('contactName');
    localStorage.setItem('viewMode', 'club');
    setLocation('/');
  }, [setLocation]);

  return (
    <ViewModeContext.Provider 
      value={{ 
        viewMode
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}