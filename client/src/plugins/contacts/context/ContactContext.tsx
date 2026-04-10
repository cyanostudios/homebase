import React, { createContext, useContext } from 'react';

import type { BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import type { BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import type { ExportFormat } from '@/core/utils/exportUtils';

import type { Contact, ValidationError } from '../types/contacts';

export interface ContactContextType {
  isContactPanelOpen: boolean;
  currentContact: Contact | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  contacts: Contact[];
  openContactPanel: (contact: Contact | null) => void;
  openContactForEdit: (contact: Contact) => void;
  openContactForView: (contact: Contact) => void;
  openContactSettings: () => void;
  closeContactSettingsView: () => void;
  closeContactPanel: () => void;
  contactsContentView: 'list' | 'settings';
  saveContact: (contactData: any) => Promise<boolean>;
  deleteContact: (id: string) => Promise<void>;
  deleteContacts: (ids: string[]) => Promise<void>;
  clearValidationErrors: () => void;
  selectedContactIds: string[];
  toggleContactSelected: (id: string) => void;
  selectAllContacts: (ids: string[]) => void;
  mergeIntoContactSelection: (ids: string[]) => void;
  clearContactSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  getPanelSubtitle: (mode: string, item: Contact | null) => any;
  getDeleteMessage: (item: Contact | null) => string;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Contact) => void;
  importContacts: (data: any[]) => Promise<void>;
  displayTags: string[];
  addTagToDraft: (tag: string) => void;
  removeTagFromDraft: (tag: string) => void;
  hasTagsChanges: boolean;
  onApplyTagsEdit: () => Promise<void>;
  showDiscardTagsDialog: boolean;
  setShowDiscardTagsDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardTagsAndClose: () => void;
  tagError: string | null;
  recentlyDuplicatedContactId: string | null;
  setRecentlyDuplicatedContactId: React.Dispatch<React.SetStateAction<string | null>>;
  getDuplicateConfig: (
    item: Contact | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  executeDuplicate: (
    item: Contact,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Contact) => void;
    className?: string;
    disabled?: boolean;
  }>;
  showSendMessageDialog: boolean;
  sendMessageRecipients: BulkMessageRecipient[];
  closeSendMessageDialog: () => void;
  showSendEmailDialog: boolean;
  sendEmailRecipients: BulkEmailRecipient[];
  closeSendEmailDialog: () => void;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

export function useContactContext() {
  const context = useContext(ContactContext);
  if (context === undefined) {
    throw new Error('useContactContext must be used within a ContactProvider');
  }
  return context;
}

const EMPTY_CONTACT_CONTEXT: ContactContextType = {
  isContactPanelOpen: false,
  currentContact: null,
  panelMode: 'create',
  validationErrors: [],
  contacts: [],
  openContactPanel: () => {},
  openContactForEdit: () => {},
  openContactForView: () => {},
  openContactSettings: () => {},
  closeContactSettingsView: () => {},
  closeContactPanel: () => {},
  contactsContentView: 'list',
  saveContact: async () => false,
  deleteContact: async () => {},
  deleteContacts: async () => {},
  clearValidationErrors: () => {},
  selectedContactIds: [],
  toggleContactSelected: () => {},
  selectAllContacts: () => {},
  mergeIntoContactSelection: () => {},
  clearContactSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
  exportFormats: [],
  onExportItem: () => {},
  importContacts: async () => {},
  displayTags: [],
  addTagToDraft: () => {},
  removeTagFromDraft: () => {},
  hasTagsChanges: false,
  onApplyTagsEdit: async () => {},
  showDiscardTagsDialog: false,
  setShowDiscardTagsDialog: () => {},
  getCloseHandler: (fn) => fn,
  onDiscardTagsAndClose: () => {},
  tagError: null,
  recentlyDuplicatedContactId: null,
  setRecentlyDuplicatedContactId: () => {},
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
  detailFooterActions: [],
  showSendMessageDialog: false,
  sendMessageRecipients: [],
  closeSendMessageDialog: () => {},
  showSendEmailDialog: false,
  sendEmailRecipients: [],
  closeSendEmailDialog: () => {},
};

export function ContactNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <ContactContext.Provider value={EMPTY_CONTACT_CONTEXT}>{children}</ContactContext.Provider>
  );
}

export { ContactContext };
