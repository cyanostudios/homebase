import React, { createContext, useContext } from 'react';

import type { ImportResult } from '@/core/utils/importUtils';

import type {
  Clubdesk,
  ClubdeskCategory,
  ClubdeskPayload,
  PublicationStatus,
  ValidationError,
} from '../types/clubdesk';
import type {
  ClubdeskPriceList,
  ClubdeskPriceListItemCategory,
  ClubdeskPriceListPayload,
} from '../types/priceList';
import type { ClubdeskInventoryItem, ClubdeskInventoryItemPayload } from '../types/inventory';

export type ClubdeskPanelMode = 'create' | 'edit' | 'view';
export type ClubdeskActiveDomain = 'guides' | 'priceLists' | 'inventory';

export interface ClubdeskContextType {
  isClubdeskPanelOpen: boolean;
  currentClubdesk: Clubdesk | null;
  panelMode: ClubdeskPanelMode;
  activeDomain: ClubdeskActiveDomain;
  validationErrors: ValidationError[];
  clubdesk: Clubdesk[];
  categories: ClubdeskCategory[];
  refreshCategories: () => Promise<void>;
  createClubdeskCategory: (name: string) => Promise<void>;
  reorderClubdeskCategories: (orderedIds: string[]) => Promise<void>;
  deleteClubdeskCategory: (
    categoryId: string,
    options?: { moveToCategory: string | null },
  ) => Promise<void>;
  priceLists: ClubdeskPriceList[];
  currentPriceList: ClubdeskPriceList | null;
  priceListCategories: ClubdeskPriceListItemCategory[];
  refreshPriceListCategories: (priceListId: string) => Promise<void>;
  isSaving: boolean;
  openClubdeskPanel: (clubdesk: Clubdesk | null) => void;
  openClubdeskForEdit: (clubdesk: Clubdesk) => void;
  openClubdeskForView: (clubdesk: Clubdesk) => void;
  closeClubdeskPanel: () => void;
  saveClubdesk: (data: ClubdeskPayload) => Promise<boolean>;
  deleteClubdesk: (id: string) => Promise<void>;
  deleteClubdesks: (ids: string[]) => Promise<void>;
  updateClubdeskPublicationStatus: (clubdesk: Clubdesk, status: PublicationStatus) => Promise<void>;
  updateClubdeskFeatured: (clubdesk: Clubdesk, featured: boolean) => Promise<void>;
  reorderClubdeskSteps: (clubdesk: Clubdesk, fromIndex: number, direction: -1 | 1) => Promise<void>;
  copyClubdeskStep: (clubdesk: Clubdesk, index: number) => Promise<void>;
  reorderClubdesksInCategory: (category: string | null, orderedIds: string[]) => Promise<void>;
  openPriceListPanel: (priceList: ClubdeskPriceList | null) => void;
  openPriceListForEdit: (priceList: ClubdeskPriceList) => void;
  openPriceListForView: (priceList: ClubdeskPriceList) => void;
  savePriceList: (
    data: ClubdeskPriceListPayload,
    options?: { categoryNames?: string[] },
  ) => Promise<boolean>;
  deletePriceList: (id: string) => Promise<void>;
  deletePriceLists: (ids: string[]) => Promise<void>;
  updatePriceListPublicationStatus: (
    priceList: ClubdeskPriceList,
    status: PublicationStatus,
  ) => Promise<void>;
  updatePriceListFeatured: (priceList: ClubdeskPriceList, featured: boolean) => Promise<void>;
  reorderPriceLists: (orderedIds: string[]) => Promise<void>;
  reorderPriceListItems: (
    priceList: ClubdeskPriceList,
    category: string | null,
    fromIndexInCategory: number,
    direction: -1 | 1,
  ) => Promise<void>;
  createPriceListCategory: (priceListId: string, name: string) => Promise<void>;
  reorderPriceListCategories: (priceListId: string, orderedIds: string[]) => Promise<void>;
  deletePriceListCategory: (
    priceListId: string,
    categoryId: string,
    options?: { moveToCategory: string | null },
  ) => Promise<void>;
  getDuplicateConfig: (
    item: Clubdesk | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeDuplicate: (
    item: Clubdesk,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  getPriceListDuplicateConfig: (
    item: ClubdeskPriceList | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executePriceListDuplicate: (
    item: ClubdeskPriceList,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  getInventoryDuplicateConfig: (
    item: ClubdeskInventoryItem | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeInventoryDuplicate: (
    item: ClubdeskInventoryItem,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  clearValidationErrors: () => void;
  selectedClubdeskIds: string[];
  toggleClubdeskSelected: (id: string) => void;
  selectAllClubdesks: (ids: string[]) => void;
  mergeIntoClubdeskSelection: (ids: string[]) => void;
  clearClubdeskSelection: () => void;
  selectedPriceListIds: string[];
  togglePriceListSelected: (id: string) => void;
  selectAllPriceLists: (ids: string[]) => void;
  mergeIntoPriceListSelection: (ids: string[]) => void;
  clearPriceListSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  priceListSelectedCount: number;
  isPriceListSelected: (id: string) => boolean;
  inventoryItems: ClubdeskInventoryItem[];
  currentInventoryItem: ClubdeskInventoryItem | null;
  openInventoryPanel: (item: ClubdeskInventoryItem | null) => void;
  openInventoryForEdit: (item: ClubdeskInventoryItem) => void;
  openInventoryForView: (item: ClubdeskInventoryItem) => void;
  saveInventoryItem: (data: ClubdeskInventoryItemPayload) => Promise<boolean>;
  deleteInventoryItem: (id: string) => Promise<void>;
  deleteInventoryItems: (ids: string[]) => Promise<void>;
  updateInventoryVariantQuantity: (
    itemId: string,
    variantId: string,
    quantity: number,
  ) => Promise<boolean>;
  importInventoryItems: (data: Record<string, string>[]) => Promise<ImportResult>;
  selectedInventoryIds: string[];
  toggleInventorySelected: (id: string) => void;
  selectAllInventory: (ids: string[]) => void;
  mergeIntoInventorySelection: (ids: string[]) => void;
  clearInventorySelection: () => void;
  inventorySelectedCount: number;
  isInventorySelected: (id: string) => boolean;
  getInventoryDeleteMessage: (item: ClubdeskInventoryItem | null) => string;
  recentlyDuplicatedInventoryId: string | null;
  setRecentlyDuplicatedInventoryId: (id: string | null) => void;
  getDeleteMessage: (item: Clubdesk | null) => string;
  getPriceListDeleteMessage: (item: ClubdeskPriceList | null) => string;
  getPanelTitle: (mode?: string, item?: Clubdesk | null) => React.ReactNode;
  recentlyDuplicatedClubdeskId: string | null;
  setRecentlyDuplicatedClubdeskId: (id: string | null) => void;
  recentlyDuplicatedPriceListId: string | null;
  setRecentlyDuplicatedPriceListId: (id: string | null) => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
}

const ClubdeskContext = createContext<ClubdeskContextType | undefined>(undefined);

export function useClubdeskContext() {
  const context = useContext(ClubdeskContext);
  if (context === undefined) {
    throw new Error('useClubdeskContext must be used within a ClubdeskProvider');
  }
  return context;
}

const EMPTY_CLUBDESK_CONTEXT: ClubdeskContextType = {
  isClubdeskPanelOpen: false,
  currentClubdesk: null,
  panelMode: 'create',
  activeDomain: 'guides',
  validationErrors: [],
  clubdesk: [],
  categories: [],
  refreshCategories: async () => {},
  createClubdeskCategory: async () => {},
  reorderClubdeskCategories: async () => {},
  deleteClubdeskCategory: async () => {},
  priceLists: [],
  currentPriceList: null,
  priceListCategories: [],
  refreshPriceListCategories: async () => {},
  isSaving: false,
  openClubdeskPanel: () => {},
  openClubdeskForEdit: () => {},
  openClubdeskForView: () => {},
  closeClubdeskPanel: () => {},
  saveClubdesk: async () => false,
  deleteClubdesk: async () => {},
  deleteClubdesks: async () => {},
  updateClubdeskPublicationStatus: async () => {},
  updateClubdeskFeatured: async () => {},
  reorderClubdeskSteps: async () => {},
  copyClubdeskStep: async () => {},
  reorderClubdesksInCategory: async () => {},
  openPriceListPanel: () => {},
  openPriceListForEdit: () => {},
  openPriceListForView: () => {},
  savePriceList: async () => false,
  deletePriceList: async () => {},
  deletePriceLists: async () => {},
  updatePriceListPublicationStatus: async () => {},
  updatePriceListFeatured: async () => {},
  reorderPriceLists: async () => {},
  reorderPriceListItems: async () => {},
  createPriceListCategory: async () => {},
  reorderPriceListCategories: async () => {},
  deletePriceListCategory: async () => {},
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  getPriceListDuplicateConfig: () => null,
  executePriceListDuplicate: async () => ({ closePanel: () => {} }),
  getInventoryDuplicateConfig: () => null,
  executeInventoryDuplicate: async () => ({ closePanel: () => {} }),
  clearValidationErrors: () => {},
  selectedClubdeskIds: [],
  toggleClubdeskSelected: () => {},
  selectAllClubdesks: () => {},
  mergeIntoClubdeskSelection: () => {},
  clearClubdeskSelection: () => {},
  selectedPriceListIds: [],
  togglePriceListSelected: () => {},
  selectAllPriceLists: () => {},
  mergeIntoPriceListSelection: () => {},
  clearPriceListSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  priceListSelectedCount: 0,
  isPriceListSelected: () => false,
  inventoryItems: [],
  currentInventoryItem: null,
  openInventoryPanel: () => {},
  openInventoryForEdit: () => {},
  openInventoryForView: () => {},
  saveInventoryItem: async () => false,
  deleteInventoryItem: async () => {},
  deleteInventoryItems: async () => {},
  updateInventoryVariantQuantity: async () => false,
  importInventoryItems: async () => ({ successCount: 0, failureCount: 0 }),
  selectedInventoryIds: [],
  toggleInventorySelected: () => {},
  selectAllInventory: () => {},
  mergeIntoInventorySelection: () => {},
  clearInventorySelection: () => {},
  inventorySelectedCount: 0,
  isInventorySelected: () => false,
  getInventoryDeleteMessage: () => '',
  recentlyDuplicatedInventoryId: null,
  setRecentlyDuplicatedInventoryId: () => {},
  getDeleteMessage: () => '',
  getPriceListDeleteMessage: () => '',
  getPanelTitle: () => null,
  recentlyDuplicatedClubdeskId: null,
  setRecentlyDuplicatedClubdeskId: () => {},
  recentlyDuplicatedPriceListId: null,
  setRecentlyDuplicatedPriceListId: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function ClubdeskNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClubdeskContext.Provider value={EMPTY_CLUBDESK_CONTEXT}>{children}</ClubdeskContext.Provider>
  );
}

export { ClubdeskContext };
