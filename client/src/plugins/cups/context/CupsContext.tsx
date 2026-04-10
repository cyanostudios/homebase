import React, { createContext, useContext } from 'react';

import type { Cup, CupValidationError } from '../types/cups';

export type CupsContextType = {
  isCupPanelOpen: boolean;
  currentCup: Cup | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: CupValidationError[];
  cups: Cup[];
  cupsContentView: 'list' | 'settings';
  isSaving: boolean;
  refreshCups: () => Promise<void>;

  openCupPanel: (cup: Cup | null) => void;
  openCupForEdit: (cup: Cup) => void;
  openCupForView: (cup: Cup) => void;
  openCupSettings: () => void;
  closeCupSettingsView: () => void;
  closeCupPanel: () => void;
  saveCup: (data: Partial<Cup> & { name: string }, cupId?: string) => Promise<boolean>;
  deleteCup: (id: string) => Promise<void>;
  deleteCups: (ids: string[]) => Promise<void>;
  importFromIngestSource: (sourceId: string) => Promise<{
    sourceId: string;
    fetched: boolean;
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }>;

  selectedCupIds: string[];
  toggleCupSelected: (id: string) => void;
  selectAllCups: (ids: string[]) => void;
  mergeIntoCupSelection: (ids: string[]) => void;
  clearCupSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  clearValidationErrors: () => void;
  getDeleteMessage: (item: Cup | null) => string;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
};

export const CupsContext = createContext<CupsContextType | undefined>(undefined);

export function useCupsContext() {
  const context = useContext(CupsContext);
  if (!context) {
    throw new Error('useCupsContext must be used within CupsProvider');
  }
  return context;
}

const EMPTY_CUPS_CONTEXT: CupsContextType = {
  isCupPanelOpen: false,
  currentCup: null,
  panelMode: 'create',
  validationErrors: [],
  cups: [],
  cupsContentView: 'list',
  isSaving: false,
  refreshCups: async () => {},
  openCupPanel: () => {},
  openCupForEdit: () => {},
  openCupForView: () => {},
  openCupSettings: () => {},
  closeCupSettingsView: () => {},
  closeCupPanel: () => {},
  saveCup: async () => false,
  deleteCup: async () => {},
  deleteCups: async () => {},
  importFromIngestSource: async () => ({
    sourceId: '',
    fetched: false,
    parsed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }),
  selectedCupIds: [],
  toggleCupSelected: () => {},
  selectAllCups: () => {},
  mergeIntoCupSelection: () => {},
  clearCupSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  clearValidationErrors: () => {},
  getDeleteMessage: () => '',
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function CupsNullProvider({ children }: { children: React.ReactNode }) {
  return <CupsContext.Provider value={EMPTY_CUPS_CONTEXT}>{children}</CupsContext.Provider>;
}
