import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

type ViewMode = 'club' | 'contact';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  currentContactId: number | null;
  setCurrentContactId: (id: number | null) => void;
  isAuthenticated: boolean;
  contactUser: {
    id: number | null;
    name: string | null;
  };
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available
  const storedViewMode = localStorage.getItem('viewMode') as ViewMode;
  const storedContactId = localStorage.getItem('contactId');
  const storedContactName = localStorage.getItem('contactName');
  
  const [viewMode, setViewMode] = useState<ViewMode>(storedViewMode || 'club');
  const [currentContactId, setCurrentContactId] = useState<number | null>(
    storedContactId ? parseInt(storedContactId, 10) : null
  );
  const [, setLocation] = useLocation();

  // Update localStorage when viewMode changes
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
    
    // If switching to contact view and no contact is logged in,
    // redirect to the login page
    if (viewMode === 'contact' && !currentContactId) {
      setLocation('/contact/login');
    }
  }, [viewMode, currentContactId, setLocation]);

  const toggleViewMode = () => {
    const newMode = viewMode === 'club' ? 'contact' : 'club';
    setViewMode(newMode);
    
    // If switching to contact view and no contact is logged in, redirect to login
    if (newMode === 'contact' && !currentContactId) {
      setLocation('/contact/login');
    } else if (newMode === 'contact' && currentContactId) {
      setLocation('/contact/dashboard');
    } else if (newMode === 'club') {
      setLocation('/');
    }
  };

  // Create contactUser object from localStorage
  const contactUser = {
    id: currentContactId,
    name: storedContactName
  };

  // Determine if a contact is authenticated
  const isAuthenticated = !!currentContactId;

  return (
    <ViewModeContext.Provider 
      value={{ 
        viewMode, 
        setViewMode, 
        toggleViewMode, 
        currentContactId, 
        setCurrentContactId,
        isAuthenticated,
        contactUser
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