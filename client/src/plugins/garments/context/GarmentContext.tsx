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

  openGarmentsInventory: () => void;
  openGarmentsLists: () => void;

  assignInventoryItemToList: (listId: string, itemId: string) => Promise<boolean>;
  unassignInventoryItemFromList: (listId: string, itemId: string) => Promise<boolean>;
  updatePersonCtSizes: (
    listId: string,
    personId: string,
    patch: { ctSizes?: Record<string, string>; ctAudiences?: Record<string, string> },
  ) => Promise<GarmentPerson | null>;

  saveGarment: (data: GarmentListPayload | InventoryItemPayload) => Promise<boolean>;
  deleteGarment: (id: string) => Promise<void>;
  deleteGarments: (ids: string[]) => Promise<void>;
  saveInventoryItem: (data: InventoryItemPayload) => Promise<boolean>;
  /** Update a single variant quantity without opening the form panel. */
  updateInventoryVariantQuantity: (
    itemId: string,
    variantId: string,
    quantity: number,
  ) => Promise<boolean>;
  deleteInventoryItem: (id: string) => Promise<void>;
  deleteInventoryItems: (ids: string[]) => Promise<void>;

  getDuplicateConfig: (
    item: GarmentList | InventoryItem | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  executeDuplicate: (
    item: GarmentList | InventoryItem,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedInventoryId: string | null;
  setRecentlyDuplicatedInventoryId: (id: string | null) => void;
  recentlyDuplicatedListId: string | null;
  setRecentlyDuplicatedListId: (id: string | null) => void;

  refreshGarmentList: (listId: string) => Promise<GarmentList | null>;
  addPerson: (listId: string, data: GarmentPersonPayload) => Promise<GarmentPerson | null>;
  updatePerson: (
    listId: string,
    personId: string,
    data: GarmentPersonPayload,
  ) => Promise<GarmentPerson | null>;
  deletePerson: (listId: string, personId: string) => Promise<void>;
  /** Import person names into an existing list (platform ImportWizard). */
  importPersons: (
    listId: string,
    data: Record<string, string>[],
  ) => Promise<{ successCount: number; failureCount: number }>;

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

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
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
  openGarmentsInventory: () => {},
  openGarmentsLists: () => {},
  assignInventoryItemToList: async () => false,
  unassignInventoryItemFromList: async () => false,
  updatePersonCtSizes: async () => null,
  saveGarment: async () => false,
  deleteGarment: async () => {},
  deleteGarments: async () => {},
  saveInventoryItem: async () => false,
  updateInventoryVariantQuantity: async () => false,
  deleteInventoryItem: async () => {},
  deleteInventoryItems: async () => {},
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  recentlyDuplicatedInventoryId: null,
  setRecentlyDuplicatedInventoryId: () => {},
  recentlyDuplicatedListId: null,
  setRecentlyDuplicatedListId: () => {},
  refreshGarmentList: async () => null,
  addPerson: async () => null,
  updatePerson: async () => null,
  deletePerson: async () => {},
  importPersons: async () => ({ successCount: 0, failureCount: 0 }),
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
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function GarmentNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <GarmentContext.Provider value={EMPTY_GARMENT_CONTEXT}>{children}</GarmentContext.Provider>
  );
}
