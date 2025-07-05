import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  // Contact Panel State
  isContactPanelOpen: boolean;
  currentContact: any | null;
  
  // Contact Actions
  openContactPanel: (contact: any | null) => void;
  closeContactPanel: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<any | null>(null);

  const openContactPanel = (contact: any | null) => {
    setCurrentContact(contact);
    setIsContactPanelOpen(true);
  };

  const closeContactPanel = () => {
    setIsContactPanelOpen(false);
    setCurrentContact(null);
  };

  return (
    <AppContext.Provider value={{
      isContactPanelOpen,
      currentContact,
      openContactPanel,
      closeContactPanel,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
