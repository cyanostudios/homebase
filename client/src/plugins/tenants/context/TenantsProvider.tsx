// client/src/plugins/tenants/context/TenantsProvider.tsx
import React from 'react';

import { TenantsContext, type TenantsContextType } from './TenantsContext';

export function TenantsProvider({
  children,
  isAuthenticated: _isAuthenticated,
  onCloseOtherPanels: _onCloseOtherPanels,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}) {
  const value: TenantsContextType = {
    isTenantPanelOpen: false,
  };

  return <TenantsContext.Provider value={value}>{children}</TenantsContext.Provider>;
}
