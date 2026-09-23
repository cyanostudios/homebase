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
  /** Supply / delivery date; defaults to issue date at leave-draft (server). */
  supplyDate?: Date | string | null;
  dueDate?: Date | string | null;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'partially_paid';
  invoiceType?: 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt';
  /** full | simplified — derived / server-stamped. */
  contentProfile?: 'full' | 'simplified';
  creditedInvoiceId?: string | number | null;
  creditedInvoiceNumber?: string | null;
  correctionSummary?: string | null;
  paidAt?: Date | string | null;
  amountPaid?: number;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  estimateId?: string | null;
  total?: number;
  totalVat?: number;
  subtotal?: number;
  totalDiscount?: number;
  vatBreakdown?: Array<{ rate: number; taxBase: number; vatAmount: number }>;
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
  /** Contact tax rate % — used as default line VAT on create. */
  taxRate?: string;
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
  showInvoiceShareDialog: boolean;
  setShowInvoiceShareDialog: (show: boolean) => void;
  /** Load active share for an invoice (soft preview + panel view). */
  syncInvoiceShareForInvoice: (invoiceId: string | null | undefined) => Promise<void>;
  openCreateInvoiceShare: () => void;
  /** Reuse active share or create a 30-day link — does not open the share dialog. */
  ensureInvoiceShareForItem: (invoice: Invoice) => Promise<InvoiceShare | null>;
  openInvoiceShareForItem: (invoice: Invoice) => Promise<void>;
  openInvoiceShareDialog: () => void;
  handleCopyInvoiceShareUrl: () => void;
  handleRevokeInvoiceShare: () => Promise<void>;
  /** Invoice used for share dialog when opened from list soft preview. */
  shareTargetInvoice: Invoice | null;
  getDuplicateConfig: (
    item: Invoice | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  executeDuplicate: (
    item: Invoice,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  /** Create a draft credit note (positive amounts) from a standard invoice. */
  createCreditNoteFromInvoice: (invoice: Invoice) => Promise<Invoice | null>;
  recentlyDuplicatedInvoiceId: string | null;
  setRecentlyDuplicatedInvoiceId: (id: string | null) => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
  /** Visible list order (filter/sort) for prev/next navigation. */
  setBrowseOrderIds: (ids: string[]) => void;
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
  showInvoiceShareDialog: false,
  setShowInvoiceShareDialog: () => {},
  syncInvoiceShareForInvoice: async () => {},
  openCreateInvoiceShare: () => {},
  ensureInvoiceShareForItem: async () => null,
  openInvoiceShareForItem: async () => {},
  openInvoiceShareDialog: () => {},
  handleCopyInvoiceShareUrl: () => {},
  handleRevokeInvoiceShare: async () => {},
  shareTargetInvoice: null,
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  createCreditNoteFromInvoice: async () => null,
  recentlyDuplicatedInvoiceId: null,
  setRecentlyDuplicatedInvoiceId: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
  setBrowseOrderIds: () => {},
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
