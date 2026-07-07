import { createContext, useContext } from 'react';

import type { YourItem, YourItemPayload, ValidationError } from '../types/your-items';

export type YourItemsPanelMode = 'create' | 'edit' | 'view';

export interface YourItemsContextType {
  isYourItemsPanelOpen: boolean;
  currentYourItem: YourItem | null;
  panelMode: YourItemsPanelMode;
  validationErrors: ValidationError[];
  yourItems: YourItem[];
  yourItemsContentView: 'list' | 'settings';
  isSaving: boolean;
  openYourItemsPanel: (item: YourItem | null) => void;
  openYourItemForEdit: (item: YourItem) => void;
  openYourItemForView: (item: YourItem) => void;
  openYourItemsSettings: () => void;
  closeYourItemsSettingsView: () => void;
  closeYourItemsPanel: () => void;
  saveYourItem: (data: YourItemPayload) => Promise<boolean>;
  deleteYourItem: (id: string) => Promise<void>;
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
