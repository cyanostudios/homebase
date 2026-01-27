import { Receipt } from 'lucide-react';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';

import { InvoicesApi, invoicesApi } from '../api/invoicesApi';

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

interface InvoicesContextType {
  // Panel state (exact naming pattern)
  isInvoicesPanelOpen: boolean;
  currentInvoice: Invoice | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  invoices: Invoice[];

  // Actions (exact naming pattern)
  openInvoicesPanel: (item: Invoice | null) => void;
  openInvoiceForEdit: (item: Invoice) => void;
  openInvoiceForView: (item: Invoice) => void;
  closeInvoicesPanel: () => void;
  closeInvoicePanel: () => void; // ⬅️ singular alias for UniversalPanel handlers
  saveInvoice: (data: any) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<void>;
  clearValidationErrors: () => void;

  // Panel Title Functions
  getPanelTitle: (mode: string, item: Invoice | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Invoice | null) => any;
  getDeleteMessage: (item: Invoice | null) => string;
}

const InvoicesContext = createContext<InvoicesContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: (except?: string) => void;
  api?: InvoicesApi;
}

export function InvoicesProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
  api = invoicesApi,
}: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel
  const [isInvoicesPanelOpen, setIsInvoicesPanelOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadInvoices();
    } else {
      setInvoices([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Register panel close once
  useEffect(() => {
    registerPanelCloseFunction('invoices', closeInvoicesPanel);
    return () => unregisterPanelCloseFunction('invoices');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global submit/cancel (PLURAL function names)
  useEffect(() => {
    (window as any).submitInvoicesForm = () => {
      const event = new CustomEvent('submitInvoiceForm');
      window.dispatchEvent(event);
    };
    (window as any).cancelInvoicesForm = () => {
      const event = new CustomEvent('cancelInvoiceForm');
      window.dispatchEvent(event);
    };
    return () => {
      delete (window as any).submitInvoicesForm;
      delete (window as any).cancelInvoicesForm;
    };
  }, []);

  const loadInvoices = async () => {
    try {
      const items = await api.getItems();
      const normalized = items.map((it: any) => ({
        ...it,
        createdAt: it.createdAt ? new Date(it.createdAt) : null,
        updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
        issueDate: it.issueDate ? new Date(it.issueDate) : null,
        dueDate: it.dueDate ? new Date(it.dueDate) : null,
      }));
      setInvoices(normalized);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    }
  };

  // Domain validation (extend later)
  const validate = (_data: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    // Example: if (!(_data.contactId)) errors.push({ field: 'contactId', message: 'Contact is required' });
    return errors;
  };

  // Actions
  const openInvoicesPanel = (item: Invoice | null) => {
    setCurrentInvoice(item);
    setPanelMode(item ? 'edit' : 'create');
    setIsInvoicesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openInvoiceForEdit = (item: Invoice) => {
    setCurrentInvoice(item);
    setPanelMode('edit');
    setIsInvoicesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openInvoiceForView = (item: Invoice) => {
    setCurrentInvoice(item);
    setPanelMode('view');
    setIsInvoicesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeInvoicesPanel = () => {
    setIsInvoicesPanelOpen(false);
    setCurrentInvoice(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  // ⬇️ singular alias to satisfy UniversalPanel handler name inference (close + Singular + Panel)
  const closeInvoicePanel = () => closeInvoicesPanel();

  const clearValidationErrors = () => setValidationErrors([]);

  const saveInvoice = async (raw: any): Promise<boolean> => {
    const errors = validate(raw);
    setValidationErrors(errors);
    const blocking = errors.filter((e) => !e.message.includes('Warning'));
    if (blocking.length > 0) {
      return false;
    }

    try {
      // Format dates for API (convert Date objects to ISO strings)
      const formattedData = {
        ...raw,
        issueDate:
          raw.issueDate instanceof Date ? raw.issueDate.toISOString() : raw.issueDate || null,
        dueDate: raw.dueDate instanceof Date ? raw.dueDate.toISOString() : raw.dueDate || null,
      };

      if (currentInvoice) {
        const saved = await api.updateItem((currentInvoice as any).id, formattedData);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
          issueDate: saved.issueDate ? new Date(saved.issueDate) : null,
          dueDate: saved.dueDate ? new Date(saved.dueDate) : null,
        };
        setInvoices((prev) =>
          prev.map((i) => (i.id === (currentInvoice as any).id ? normalized : i)),
        );
        setCurrentInvoice(normalized as any);
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        const saved = await api.createItem(formattedData);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
          issueDate: saved.issueDate ? new Date(saved.issueDate) : null,
          dueDate: saved.dueDate ? new Date(saved.dueDate) : null,
        };
        setInvoices((prev) => [...prev, normalized]);
        closeInvoicesPanel();
      }
      return true;
    } catch (err: any) {
      console.error('Failed to save invoice:', err);

      // V2: Handle standardized error format from backend
      const validationErrors: ValidationError[] = [];

      // Check for field-level errors (409 conflicts)
      if (err?.status === 409 && Array.isArray(err.errors)) {
        validationErrors.push(...err.errors);
      }
      // Check if backend returned validation errors in details array
      else if (err?.details && Array.isArray(err.details)) {
        err.details.forEach((detail: any) => {
          if (typeof detail === 'string') {
            validationErrors.push({ field: 'general', message: detail });
          } else if (detail?.field && detail?.message) {
            validationErrors.push({ field: detail.field, message: detail.message });
          } else if (detail?.msg) {
            validationErrors.push({ field: detail.param || 'general', message: detail.msg });
          }
        });
      }

      // If no validation errors from backend, use error message
      if (validationErrors.length === 0) {
        const errorMessage = err?.message || err?.error || 'Failed to save. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }

      setValidationErrors(validationErrors);
      return false;
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      await api.deleteItem(id);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
      // V2: Handle standardized error format
      const errorMessage = err?.message || err?.error || 'Failed to delete invoice';
      alert(errorMessage);
    }
  };

  // Panel Title Functions
  const getPanelTitle = (mode: string, item: Invoice | null, isMobileView: boolean) => {
    if (mode === 'view' && item) {
      const invoiceNumber = item.invoiceNumber || `DRAFT-${item.id}`;
      const total = (item.total || 0).toFixed(2);
      const currency = item.currency || 'SEK';
      const contactName = item.contactName || 'Customer';

      if (isMobileView) {
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-foreground">
                {invoiceNumber} • @{contactName}
              </span>
            </div>
            <div className="text-sm font-normal text-muted-foreground mt-1">
              {total} {currency}
            </div>
          </div>
        );
      }
      return `${invoiceNumber} • @${contactName} • ${total} ${currency}`;
    }

    switch (mode) {
      case 'edit':
        return 'Edit Invoice';
      case 'create':
        return 'Create Invoice';
      default:
        return 'Invoice';
    }
  };

  const getPanelSubtitle = (mode: string, item: Invoice | null) => {
    if (mode === 'view' && item) {
      const statusColors: Record<string, string> = {
        draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
        sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        overdue: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        canceled: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      };

      const typeColors: Record<string, string> = {
        invoice: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        credit_note: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        cash_invoice: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300',
        receipt: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      };

      const typeLabels: Record<string, string> = {
        invoice: 'Faktura',
        credit_note: 'Kreditfaktura',
        cash_invoice: 'Kontantfaktura',
        receipt: 'Kvitto',
      };

      const status = item.status || 'draft';
      const invoiceType = item.invoiceType || 'invoice';
      const badgeColor = statusColors[status] || statusColors.draft;
      const typeBadgeColor = typeColors[invoiceType] || typeColors.invoice;
      const badgeText = status.charAt(0).toUpperCase() + status.slice(1);
      const typeText = typeLabels[invoiceType] || 'Faktura';
      const dueDateText = item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : '';

      return (
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <Badge className={typeBadgeColor}>{typeText}</Badge>
          <Badge className={badgeColor}>{badgeText}</Badge>
          {dueDateText && <span className="text-xs text-muted-foreground">• {dueDateText}</span>}
        </div>
      );
    }

    switch (mode) {
      case 'edit':
        return 'Update invoice information';
      case 'create':
        return 'Enter new invoice details';
      default:
        return '';
    }
  };

  const getDeleteMessage = (item: Invoice | null) => {
    if (!item) {
      return 'Are you sure you want to delete this invoice?';
    }
    const itemName = item.invoiceNumber || 'this invoice';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const value: InvoicesContextType = {
    isInvoicesPanelOpen,
    currentInvoice,
    panelMode,
    validationErrors,
    invoices,
    openInvoicesPanel,
    openInvoiceForEdit,
    openInvoiceForView,
    closeInvoicesPanel,
    closeInvoicePanel, // ⬅️ include alias in context value
    saveInvoice,
    deleteInvoice,
    clearValidationErrors,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>;
}

export function useInvoicesContext() {
  const ctx = useContext(InvoicesContext);
  if (!ctx) {
    throw new Error('useInvoicesContext must be used within an InvoicesProvider');
  }
  return ctx;
}
