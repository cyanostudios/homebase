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
  getPanelSubtitle: (mode: string, item: Invoice | null) => any;
  getDeleteMessage: (item: Invoice | null) => string;
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
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
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
