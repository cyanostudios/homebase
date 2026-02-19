import { useContext } from 'react';

import { PulseContext } from '../context/PulseContext';

export function usePulses() {
  const context = useContext(PulseContext);
  if (context === undefined) {
    throw new Error('usePulses must be used within PulseProvider');
  }
  return context;
}
