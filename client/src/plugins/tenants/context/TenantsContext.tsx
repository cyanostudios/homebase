// client/src/plugins/tenants/context/TenantsContext.tsx
import React, { createContext, useContext } from 'react';

export interface TenantsContextType {
  isTenantPanelOpen: boolean;
}

const TenantsContext = createContext<TenantsContextType | undefined>(undefined);

export function useTenantsContext() {
  const context = useContext(TenantsContext);
  if (context === undefined) {
    throw new Error('useTenantsContext must be used within a TenantsProvider');
  }
  return context;
}

const EMPTY_TENANTS_CONTEXT: TenantsContextType = {
  isTenantPanelOpen: false,
};

export function TenantsNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <TenantsContext.Provider value={EMPTY_TENANTS_CONTEXT}>{children}</TenantsContext.Provider>
  );
}

export { TenantsContext };
