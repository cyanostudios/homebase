import React, { createContext, useContext } from 'react';

export type ValidationError = { field: string; message: string };

export interface Invoice {
  id: string;
  invoiceNumber?: string | null;
  contactId?: string | null;
  contactName?: string;
  organizationNumber?: string;
  currency?: string;
  lineItems?: any[];
  invoiceDiscount?: number;
  notes?: string;
  paymentTerms?: string;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';
  invoiceType?: 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt';
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  estimateId?: string | null;
  total?: number;
  totalVat?: number;
  subtotal?: number;
  totalDiscount?: number;
}

export interface InvoiceShare {
  id: string;
  invoiceId: string;
  shareToken: string;
  validUntil: string;
  createdAt: string;
  accessedCount: number;
  lastAccessedAt?: string;
}

export interface InvoicesContextType {
  isInvoicesPanelOpen: boolean;
  currentInvoice: Invoice | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  invoices: Invoice[];
  openInvoicesPanel: (item: Invoice | null) => void;
  openInvoiceForEdit: (item: Invoice) => void;
  openInvoiceForView: (item: Invoice) => void;
  closeInvoicesPanel: () => void;
  closeInvoicePanel: () => void;
  saveInvoice: (data: any) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<void>;
  deleteInvoices: (ids: string[]) => Promise<void>;
  selectedInvoiceIds: string[];
  toggleInvoiceSelected: (id: string) => void;
  selectAllInvoices: (ids: string[]) => void;
  mergeIntoInvoiceSelection: (ids: string[]) => void;
  clearInvoiceSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  clearValidationErrors: () => void;
  getPanelTitle: (mode: string, item: Invoice | null) => React.ReactNode;
  getPanelSubtitle: (mode: string, item: Invoice | null) => any;
  getDeleteMessage: (item: Invoice | null) => string;
  invoiceShare: InvoiceShare | null;
  isCreatingInvoiceShare: boolean;
  showCreateInvoiceShareModal: boolean;
  setShowCreateInvoiceShareModal: (show: boolean) => void;
  showInvoiceShareDialog: boolean;
  setShowInvoiceShareDialog: (show: boolean) => void;
  shareValidUntil: string;
  setShareValidUntil: (value: string) => void;
  openCreateInvoiceShare: () => void;
  openInvoiceShareForItem: (invoice: Invoice) => Promise<void>;
  openInvoiceShareDialog: () => void;
  handleCreateInvoiceShare: () => Promise<void>;
  handleCopyInvoiceShareUrl: () => void;
  handleRevokeInvoiceShare: () => Promise<void>;
  /** Invoice used for share create/dialog when opened from list quick context. */
  shareTargetInvoice: Invoice | null;
  getDuplicateConfig: (
    item: Invoice | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  executeDuplicate: (
    item: Invoice,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedInvoiceId: string | null;
  setRecentlyDuplicatedInvoiceId: (id: string | null) => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
}

export const InvoicesContext = createContext<InvoicesContextType | undefined>(undefined);

export function useInvoicesContext() {
  const ctx = useContext(InvoicesContext);
  if (!ctx) {
    throw new Error('useInvoicesContext must be used within an InvoicesProvider');
  }
  return ctx;
}

const EMPTY_INVOICES_CONTEXT: InvoicesContextType = {
  isInvoicesPanelOpen: false,
  currentInvoice: null,
  panelMode: 'create',
  validationErrors: [],
  invoices: [],
  openInvoicesPanel: () => {},
  openInvoiceForEdit: () => {},
  openInvoiceForView: () => {},
  closeInvoicesPanel: () => {},
  closeInvoicePanel: () => {},
  saveInvoice: async () => false,
  deleteInvoice: async () => {},
  deleteInvoices: async () => {},
  selectedInvoiceIds: [],
  toggleInvoiceSelected: () => {},
  selectAllInvoices: () => {},
  mergeIntoInvoiceSelection: () => {},
  clearInvoiceSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  clearValidationErrors: () => {},
  getPanelTitle: () => null,
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
  invoiceShare: null,
  isCreatingInvoiceShare: false,
  showCreateInvoiceShareModal: false,
  setShowCreateInvoiceShareModal: () => {},
  showInvoiceShareDialog: false,
  setShowInvoiceShareDialog: () => {},
  shareValidUntil: '',
  setShareValidUntil: () => {},
  openCreateInvoiceShare: () => {},
  openInvoiceShareForItem: async () => {},
  openInvoiceShareDialog: () => {},
  handleCreateInvoiceShare: async () => {},
  handleCopyInvoiceShareUrl: () => {},
  handleRevokeInvoiceShare: async () => {},
  shareTargetInvoice: null,
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  recentlyDuplicatedInvoiceId: null,
  setRecentlyDuplicatedInvoiceId: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function InvoicesNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <InvoicesContext.Provider value={EMPTY_INVOICES_CONTEXT}>{children}</InvoicesContext.Provider>
  );
}
