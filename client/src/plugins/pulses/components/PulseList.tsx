import React from 'react';

import { usePulses } from '../hooks/usePulses';

import { PulseHistoryView } from './PulseHistoryView';
import { PulseProvidersList } from './PulseProvidersList';

/**
 * Pulse main content: provider list is home; history and routing are secondary views.
 */
export const PulseList: React.FC = () => {
  const { pulsesContentView } = usePulses();

  if (pulsesContentView === 'history') {
    return <PulseHistoryView />;
  }

  return <PulseProvidersList />;
};
