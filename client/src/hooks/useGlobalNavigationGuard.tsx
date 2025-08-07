/**
 * Global Navigation Guard - Protects against unsaved changes during navigation
 * 
 * This hook provides system-wide protection against data loss when users navigate
 * away from forms with unsaved changes. All forms register their dirty state here,
 * and all navigation goes through the attemptNavigation function.
 * 
 * Used by: All form components, App.tsx, Sidebar.tsx, and any navigation triggers
 */

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

interface GlobalNavigationGuardContextType {
  // Check if any form has unsaved changes
  hasUnsavedChanges: () => boolean;
  // Register a form's unsaved changes checker
  registerUnsavedChangesChecker: (key: string, checker: () => boolean) => void;
  // Unregister a form's unsaved changes checker
  unregisterUnsavedChangesChecker: (key: string) => void;
  // Attempt navigation - shows warning if unsaved changes exist
  attemptNavigation: (action: () => void) => void;
  // Global warning dialog state
  showWarning: boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
  warningMessage: string;
}

const GlobalNavigationGuardContext = createContext<GlobalNavigationGuardContextType | undefined>(undefined);

interface GlobalNavigationGuardProviderProps {
  children: ReactNode;
}

export function GlobalNavigationGuardProvider({ children }: GlobalNavigationGuardProviderProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const pendingActionRef = useRef<(() => void) | null>(null);
  const unsavedChangesCheckersRef = useRef<Map<string, () => boolean>>(new Map());

  const hasUnsavedChanges = useCallback((): boolean => {
    const checkers = Array.from(unsavedChangesCheckersRef.current.values());
    return checkers.some(checker => checker());
  }, []);

  const registerUnsavedChangesChecker = useCallback((key: string, checker: () => boolean) => {
    unsavedChangesCheckersRef.current.set(key, checker);
  }, []);

  const unregisterUnsavedChangesChecker = useCallback((key: string) => {
    unsavedChangesCheckersRef.current.delete(key);
  }, []);

  const attemptNavigation = useCallback((action: () => void) => {
    if (hasUnsavedChanges()) {
      pendingActionRef.current = action;
      setWarningMessage("You have unsaved changes. Do you want to discard your changes and continue?");
      setShowWarning(true);
    } else {
      action();
    }
  }, [hasUnsavedChanges]);

  const confirmDiscard = useCallback(() => {
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
    setShowWarning(false);
  }, []);

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    setShowWarning(false);
  }, []);

  const value: GlobalNavigationGuardContextType = {
    hasUnsavedChanges,
    registerUnsavedChangesChecker,
    unregisterUnsavedChangesChecker,
    attemptNavigation,
    showWarning,
    confirmDiscard,
    cancelDiscard,
    warningMessage
  };

  return (
    <GlobalNavigationGuardContext.Provider value={value}>
      {children}
    </GlobalNavigationGuardContext.Provider>
  );
}

export function useGlobalNavigationGuard() {
  const context = useContext(GlobalNavigationGuardContext);
  if (context === undefined) {
    throw new Error('useGlobalNavigationGuard must be used within a GlobalNavigationGuardProvider');
  }
  return context;
}