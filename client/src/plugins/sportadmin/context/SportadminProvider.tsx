// client/src/plugins/sportadmin/context/SportadminProvider.tsx
import React from 'react';

import { SportadminContext, type SportadminContextType } from './SportadminContext';

export function SportadminProvider({
  children,
  isAuthenticated: _isAuthenticated,
  onCloseOtherPanels: _onCloseOtherPanels,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}) {
  const value: SportadminContextType = {
    isSportadminPanelOpen: false,
  };

  return <SportadminContext.Provider value={value}>{children}</SportadminContext.Provider>;
}
