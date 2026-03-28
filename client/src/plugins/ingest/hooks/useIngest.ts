import { useContext } from 'react';

import { IngestContext, type IngestContextType } from '../context/IngestContext';

export function useIngest(): IngestContextType {
  const ctx = useContext(IngestContext);
  if (!ctx) {
    throw new Error('useIngest must be used within IngestProvider');
  }
  return ctx;
}
