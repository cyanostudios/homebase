import { useContext } from 'react';

import { AIProvidersContext } from '../context/AIProvidersContext';

export function useAIProviders() {
  const context = useContext(AIProvidersContext);
  if (context === undefined) {
    throw new Error('useAIProviders must be used within AIProvidersProvider');
  }
  return context;
}
