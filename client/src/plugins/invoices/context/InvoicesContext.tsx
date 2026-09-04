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
  orderNumber?: string;
  deliveryMethod?: string;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'partially_paid';
  invoiceType?: 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt';
  paidAt?: Date | string | null;
  amountPaid?: number;
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

/** Prefill when opening create (e.g. contact → new invoice). */
export type InvoiceCreatePrefill = {
  contactId: string;
  contactName?: string;
  organizationNumber?: string;
  currency?: string;
  paymentTerms?: string;
};

export interface InvoicesContextType {
  isInvoicesPanelOpen: boolean;
  currentInvoice: Invoice | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  invoices: Invoice[];
  /** Contact (etc.) defaults applied while the create form is open. */
  invoiceCreatePrefill: InvoiceCreatePrefill | null;
  openInvoicesPanel: (item: Invoice | null) => void;
  /** Open create form; optionally prefill customer and navigate to /invoices. */
  openInvoiceForCreate: (prefill?: InvoiceCreatePrefill | null) => void;
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
  invoicesContentView: 'list' | 'settings' | 'statistics';
  openInvoiceSettings: () => void;
  closeInvoiceSettingsView: () => void;
  openInvoiceStatistics: () => void;
  closeInvoiceStatisticsView: () => void;
  refreshInvoices: () => Promise<void>;
  /** Merge a server invoice into list + open panel item (e.g. after recording a payment). */
  applyInvoiceSnapshot: (invoice: Invoice) => void;
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
  invoiceCreatePrefill: null,
  openInvoicesPanel: () => {},
  openInvoiceForCreate: () => {},
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
  invoicesContentView: 'list',
  openInvoiceSettings: () => {},
  closeInvoiceSettingsView: () => {},
  openInvoiceStatistics: () => {},
  closeInvoiceStatisticsView: () => {},
  refreshInvoices: async () => {},
  applyInvoiceSnapshot: () => {},
};

export function InvoicesNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <InvoicesContext.Provider value={EMPTY_INVOICES_CONTEXT}>{children}</InvoicesContext.Provider>
  );
}
