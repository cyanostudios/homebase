import React, { createContext, useContext } from 'react';

import type { Guide, GuidePayload, GuideValidationError } from '../types/guides';

export type GuidePanelMode = 'create' | 'edit' | 'view';

export interface GuidesContextType {
  isGuidePanelOpen: boolean;
  currentGuide: Guide | null;
  panelMode: GuidePanelMode;
  validationErrors: GuideValidationError[];
  guides: Guide[];
  isSaving: boolean;
  openGuidePanel: (item: Guide | null) => void;
  openGuideForEdit: (item: Guide) => void;
  openGuideForView: (item: Guide) => void;
  closeGuidePanel: () => void;
  saveGuide: (data: GuidePayload) => Promise<boolean>;
  deleteGuide: (id: string) => Promise<void>;
  clearValidationErrors: () => void;
}

export const GuidesContext = createContext<GuidesContextType | undefined>(undefined);

export function useGuidesContext(): GuidesContextType {
  const ctx = useContext(GuidesContext);
  if (!ctx) {
    throw new Error('useGuidesContext must be used within a GuidesProvider');
  }
  return ctx;
}

export function GuideNullProvider({ children }: { children: React.ReactNode }) {
  const empty: GuidesContextType = {
    isGuidePanelOpen: false,
    currentGuide: null,
    panelMode: 'create',
    validationErrors: [],
    guides: [],
    isSaving: false,
    openGuidePanel: () => {},
    openGuideForEdit: () => {},
    openGuideForView: () => {},
    closeGuidePanel: () => {},
    saveGuide: async () => false,
    deleteGuide: async () => {},
    clearValidationErrors: () => {},
  };
  return <GuidesContext.Provider value={empty}>{children}</GuidesContext.Provider>;
}
