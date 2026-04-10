import React, { createContext, useContext } from 'react';

import type { BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import type { BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import type { ExportFormat } from '@/core/utils/exportUtils';

import type { Slot, ValidationError, SlotMention } from '../types/slots';

export interface SlotsContextType {
  isSlotsPanelOpen: boolean;
  currentSlot: Slot | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  slots: Slot[];

  openSlotPanel: (slot: Slot | null) => void;
  openSlotForEdit: (slot: Slot) => void;
  openSlotForView: (slot: Slot) => void;
  openSlotSettings: () => void;
  closeSlotSettingsView: () => void;
  closeSlotPanel: () => void;
  slotsContentView: 'list' | 'settings';
  saveSlot: (data: Record<string, unknown>, slotId?: string) => Promise<boolean>;
  saveSlots: (dataArray: Record<string, unknown>[]) => Promise<boolean>;
  deleteSlot: (id: string) => Promise<void>;
  deleteSlots: (ids: string[]) => Promise<void>;
  clearValidationErrors: () => void;

  selectedSlotIds: string[];
  toggleSlotSelected: (id: string) => void;
  selectAllSlots: (ids: string[]) => void;
  mergeIntoSlotSelection: (ids: string[]) => void;
  clearSlotSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  getPanelTitle: (mode: string, item: Slot | null) => React.ReactNode;
  getPanelSubtitle: (mode: string, item: Slot | null) => React.ReactNode;
  getDeleteMessage: (item: Slot | null) => string;

  getDuplicateConfig: (item: Slot | null) => {
    defaultName: string;
    nameLabel: string;
    confirmOnly?: boolean;
  } | null;
  executeDuplicate: (
    item: Slot,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedSlotId: string | null;
  setRecentlyDuplicatedSlotId: (id: string | null) => void;

  /** Refetch slots from API (e.g. after creating a slot from match in App). */
  refreshSlots: () => Promise<void>;

  canSendMessages: boolean;
  canSendEmail: boolean;

  displayMentions: SlotMention[];
  addContactToDraft: (contact: { id: number | string; companyName?: string }) => void;
  removeContactFromDraft: (contactId: string) => void;
  /** Draft for visible/notifications/location in view mode; used by SlotView switches and inline location edit. */
  propertyDraft: Partial<Pick<Slot, 'visible' | 'notifications_enabled' | 'location'>> | null;
  setPropertyDraftField: (
    field: 'visible' | 'notifications_enabled' | 'location',
    value: boolean | string | null,
  ) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;

  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Slot) => void;

  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Slot) => void;
    className?: string;
    disabled?: boolean;
  }>;
  showSendMessageDialog: boolean;
  sendMessageRecipients: BulkMessageRecipient[];
  closeSendMessageDialog: () => void;

  showSendEmailDialog: boolean;
  sendEmailRecipients: BulkEmailRecipient[];
  sendEmailSlot: Slot | null;
  closeSendEmailDialog: () => void;
}

export const SlotsContext = createContext<SlotsContextType | undefined>(undefined);

export function useSlotsContext() {
  const ctx = useContext(SlotsContext);
  if (ctx === undefined) {
    throw new Error('useSlotsContext must be used within SlotsProvider');
  }
  return ctx;
}

const EMPTY_SLOTS_CONTEXT: SlotsContextType = {
  isSlotsPanelOpen: false,
  currentSlot: null,
  panelMode: 'create',
  validationErrors: [],
  slots: [],
  openSlotPanel: () => {},
  openSlotForEdit: () => {},
  openSlotForView: () => {},
  openSlotSettings: () => {},
  closeSlotSettingsView: () => {},
  closeSlotPanel: () => {},
  slotsContentView: 'list',
  saveSlot: async () => false,
  saveSlots: async () => false,
  deleteSlot: async () => {},
  deleteSlots: async () => {},
  clearValidationErrors: () => {},
  selectedSlotIds: [],
  toggleSlotSelected: () => {},
  selectAllSlots: () => {},
  mergeIntoSlotSelection: () => {},
  clearSlotSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getPanelTitle: () => null,
  getPanelSubtitle: () => null,
  getDeleteMessage: () => '',
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  recentlyDuplicatedSlotId: null,
  setRecentlyDuplicatedSlotId: () => {},
  refreshSlots: async () => {},
  canSendMessages: false,
  canSendEmail: false,
  displayMentions: [],
  addContactToDraft: () => {},
  removeContactFromDraft: () => {},
  propertyDraft: null,
  setPropertyDraftField: () => {},
  hasQuickEditChanges: false,
  onApplyQuickEdit: async () => {},
  showDiscardQuickEditDialog: false,
  setShowDiscardQuickEditDialog: () => {},
  getCloseHandler: (fn) => fn,
  onDiscardQuickEditAndClose: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
  exportFormats: [],
  onExportItem: () => {},
  detailFooterActions: [],
  showSendMessageDialog: false,
  sendMessageRecipients: [],
  closeSendMessageDialog: () => {},
  showSendEmailDialog: false,
  sendEmailRecipients: [],
  sendEmailSlot: null,
  closeSendEmailDialog: () => {},
};

export function SlotsNullProvider({ children }: { children: React.ReactNode }) {
  return <SlotsContext.Provider value={EMPTY_SLOTS_CONTEXT}>{children}</SlotsContext.Provider>;
}
