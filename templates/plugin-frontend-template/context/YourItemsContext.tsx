import React, { createContext, useContext } from 'react';

import type { YourItem, YourItemPayload, ValidationError } from '../types/your-items';

export type YourItemsPanelMode = 'create' | 'edit' | 'view';

export interface YourItemsContextType {
  isYourItemPanelOpen: boolean;
  currentYourItem: YourItem | null;
  panelMode: YourItemsPanelMode;
  validationErrors: ValidationError[];
  yourItems: YourItem[];
  yourItemsContentView: 'list' | 'settings';
  isSaving: boolean;
  openYourItemPanel: (item: YourItem | null) => void;
  openYourItemForEdit: (item: YourItem) => void;
  openYourItemForView: (item: YourItem) => void;
  openYourItemsSettings: () => void;
  closeYourItemsSettingsView: () => void;
  closeYourItemPanel: () => void;
  saveYourItem: (data: YourItemPayload) => Promise<boolean>;
  deleteYourItem: (id: string) => Promise<void>;
  deleteYourItems: (ids: string[]) => Promise<void>;
  getDeleteMessage: (item: YourItem | null) => string;
  clearValidationErrors: () => void;
}

export const YourItemsContext = createContext<YourItemsContextType | undefined>(undefined);

export function useYourItemsContext(): YourItemsContextType {
  const ctx = useContext(YourItemsContext);
  if (!ctx) {
    throw new Error('useYourItemsContext must be used within a YourItemsProvider');
  }
  return ctx;
}

const EMPTY_YOUR_ITEMS_CONTEXT: YourItemsContextType = {
  isYourItemPanelOpen: false,
  currentYourItem: null,
  panelMode: 'create',
  validationErrors: [],
  yourItems: [],
  yourItemsContentView: 'list',
  isSaving: false,
  openYourItemPanel: () => {},
  openYourItemForEdit: () => {},
  openYourItemForView: () => {},
  openYourItemsSettings: () => {},
  closeYourItemsSettingsView: () => {},
  closeYourItemPanel: () => {},
  saveYourItem: async () => false,
  deleteYourItem: async () => {},
  deleteYourItems: async () => {},
  getDeleteMessage: () => '',
  clearValidationErrors: () => {},
};

export function YourItemsNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <YourItemsContext.Provider value={EMPTY_YOUR_ITEMS_CONTEXT}>
      {children}
    </YourItemsContext.Provider>
  );
}
