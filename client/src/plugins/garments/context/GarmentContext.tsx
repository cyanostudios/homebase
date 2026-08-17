import React, { createContext, useContext } from 'react';

import type {
  GarmentList,
  GarmentListPayload,
  GarmentPanelKind,
  GarmentPerson,
  GarmentPersonPayload,
  GarmentShare,
  GarmentsContentView,
  InventoryItem,
  InventoryItemPayload,
  PanelMode,
  ValidationError,
} from '../types/garments';

export interface GarmentContextType {
  isGarmentPanelOpen: boolean;
  currentGarment: GarmentList | null;
  currentInventoryItem: InventoryItem | null;
  panelMode: PanelMode;
  panelKind: GarmentPanelKind;
  validationErrors: ValidationError[];
  garmentLists: GarmentList[];
  inventoryItems: InventoryItem[];
  garmentsContentView: GarmentsContentView;
  isSaving: boolean;

  openGarmentPanel: (list: GarmentList | null) => void;
  openGarmentForEdit: (list: GarmentList) => void;
  openGarmentForView: (list: GarmentList) => void;
  closeGarmentPanel: () => void;

  openInventoryPanel: (item: InventoryItem | null) => void;
  openInventoryForEdit: (item: InventoryItem) => void;
  openInventoryForView: (item: InventoryItem) => void;

  openGarmentsSettings: () => void;
  closeGarmentSettingsView: () => void;
  openGarmentsInventory: () => void;
  openGarmentsLists: () => void;

  saveGarment: (data: GarmentListPayload | InventoryItemPayload) => Promise<boolean>;
  deleteGarment: (id: string) => Promise<void>;
  deleteGarments: (ids: string[]) => Promise<void>;
  saveInventoryItem: (data: InventoryItemPayload) => Promise<boolean>;
  deleteInventoryItem: (id: string) => Promise<void>;
  deleteInventoryItems: (ids: string[]) => Promise<void>;

  refreshGarmentList: (listId: string) => Promise<GarmentList | null>;
  addPerson: (listId: string, data: GarmentPersonPayload) => Promise<GarmentPerson | null>;
  updatePerson: (
    listId: string,
    personId: string,
    data: GarmentPersonPayload,
  ) => Promise<GarmentPerson | null>;
  deletePerson: (listId: string, personId: string) => Promise<void>;

  garmentShareExistingShare: GarmentShare | null;
  garmentShareShowDialog: boolean;
  setGarmentShareShowDialog: (show: boolean) => void;
  garmentShareIsCreatingShare: boolean;
  handleGarmentShareClick: (list: GarmentList) => Promise<void>;
  handleGarmentCopyShareUrl: () => void;
  handleGarmentRevokeShare: () => Promise<void>;

  getPanelTitle: (mode: string, item: GarmentList | InventoryItem | null) => React.ReactNode;
  getPanelSubtitle: (mode: string, item: GarmentList | InventoryItem | null) => React.ReactNode;
  getDeleteMessage: (item: GarmentList | InventoryItem | null) => string;
  clearValidationErrors: () => void;
}

export const GarmentContext = createContext<GarmentContextType | undefined>(undefined);

export function useGarmentContext(): GarmentContextType {
  const ctx = useContext(GarmentContext);
  if (!ctx) {
    throw new Error('useGarmentContext must be used within a GarmentProvider');
  }
  return ctx;
}

const EMPTY_GARMENT_CONTEXT: GarmentContextType = {
  isGarmentPanelOpen: false,
  currentGarment: null,
  currentInventoryItem: null,
  panelMode: 'create',
  panelKind: 'list',
  validationErrors: [],
  garmentLists: [],
  inventoryItems: [],
  garmentsContentView: 'lists',
  isSaving: false,
  openGarmentPanel: () => {},
  openGarmentForEdit: () => {},
  openGarmentForView: () => {},
  closeGarmentPanel: () => {},
  openInventoryPanel: () => {},
  openInventoryForEdit: () => {},
  openInventoryForView: () => {},
  openGarmentsSettings: () => {},
  closeGarmentSettingsView: () => {},
  openGarmentsInventory: () => {},
  openGarmentsLists: () => {},
  saveGarment: async () => false,
  deleteGarment: async () => {},
  deleteGarments: async () => {},
  saveInventoryItem: async () => false,
  deleteInventoryItem: async () => {},
  deleteInventoryItems: async () => {},
  refreshGarmentList: async () => null,
  addPerson: async () => null,
  updatePerson: async () => null,
  deletePerson: async () => {},
  garmentShareExistingShare: null,
  garmentShareShowDialog: false,
  setGarmentShareShowDialog: () => {},
  garmentShareIsCreatingShare: false,
  handleGarmentShareClick: async () => {},
  handleGarmentCopyShareUrl: () => {},
  handleGarmentRevokeShare: async () => {},
  getPanelTitle: () => null,
  getPanelSubtitle: () => null,
  getDeleteMessage: () => '',
  clearValidationErrors: () => {},
};

export function GarmentNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <GarmentContext.Provider value={EMPTY_GARMENT_CONTEXT}>{children}</GarmentContext.Provider>
  );
}
