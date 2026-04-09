import { Receipt } from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { resolveSlug } from '@/core/utils/slugUtils';

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
  deleteInvoices: (ids: string[]) => Promise<void>;
  // Bulk selection
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
  const { t } = useTranslation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/invoices');

  // Panel
  const [isInvoicesPanelOpen, setIsInvoicesPanelOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Use core bulk selection hook
  const {
    selectedIds: selectedInvoiceIds,
    toggleSelection: toggleInvoiceSelectedCore,
    selectAll: selectAllInvoicesCore,
    mergeIntoSelection: mergeIntoInvoiceSelectionCore,
    clearSelection: clearInvoiceSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  // Load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadInvoices();
    } else {
      setInvoices([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || invoices.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'invoices' || !parts[2]) {
      return;
    }
    const item = resolveSlug(parts[2], invoices, 'invoiceNumber');
    if (item) {
      didOpenFromUrlRef.current = true;
      openInvoiceForViewRef.current(item as Invoice);
    }
  }, [invoices]);

  // Register panel close once
  useEffect(() => {
    registerPanelCloseFunction('invoices', closeInvoicesPanel);
    return () => unregisterPanelCloseFunction('invoices');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Actions (clear bulk selection when opening panel)
  const openInvoicesPanel = (item: Invoice | null) => {
    clearInvoiceSelectionCore();
    setCurrentInvoice(item);
    setPanelMode(item ? 'edit' : 'create');
    setIsInvoicesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    if (item) {
      navigateToItem(item, invoices, 'invoiceNumber');
    }
  };

  const openInvoiceForEdit = (item: Invoice) => {
    clearInvoiceSelectionCore();
    setCurrentInvoice(item);
    setPanelMode('edit');
    setIsInvoicesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(item, invoices, 'invoiceNumber');
  };

  const openInvoiceForView = useCallback(
    (item: Invoice) => {
      setCurrentInvoice(item);
      setPanelMode('view');
      setIsInvoicesPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(item, invoices, 'invoiceNumber');
    },
    [onCloseOtherPanels, navigateToItem, invoices, setValidationErrors],
  );

  const openInvoiceForViewRef = useRef(openInvoiceForView);
  useEffect(() => {
    openInvoiceForViewRef.current = openInvoiceForView;
  }, [openInvoiceForView]);

  const closeInvoicesPanel = useCallback(() => {
    setIsInvoicesPanelOpen(false);
    setCurrentInvoice(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  // ⬇️ singular alias to satisfy UniversalPanel handler name inference (close + Singular + Panel)
  const closeInvoicePanel = () => closeInvoicesPanel();

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(invoices, currentInvoice, openInvoiceForView);

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

  // Bulk delete using core bulkApi
  const deleteInvoices = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return;
    }

    try {
      await bulkApi.bulkDelete('invoices', uniqueIds);
      // Update local state - remove deleted invoices
      setInvoices((prev) => prev.filter((i) => !uniqueIds.includes(String(i.id))));
      // Clear selection after successful delete
      clearInvoiceSelectionCore();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete invoices';
      alert(errorMessage);
      throw error;
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

  const getPanelSubtitle = (mode: string, item: Invoice | null) => {
    if (mode === 'view' && item) {
      const statusColors: Record<string, string> = {
        draft: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
        sent: 'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
        paid: 'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
        overdue: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
        canceled: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
      };

      const typeColors: Record<string, string> = {
        invoice: 'bg-blue-50/30 text-blue-600 border-blue-100/30 font-medium',
        credit_note: 'bg-amber-50/30 text-amber-600 border-amber-100/30 font-medium',
        cash_invoice: 'bg-green-50/30 text-green-600 border-green-100/30 font-medium',
        receipt: 'bg-purple-50/30 text-purple-600 border-purple-100/30 font-medium',
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
      const badgeText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      const typeText = typeLabels[invoiceType] || 'Faktura';
      const dueDateText = item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : '';

      return (
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <Badge variant="outline" className={typeBadgeColor}>
            {typeText}
          </Badge>
          <Badge variant="outline" className={badgeColor}>
            {badgeText}
          </Badge>
          {dueDateText && <span className="text-xs text-muted-foreground">• {dueDateText}</span>}
        </div>
      );
    }

    switch (mode) {
      case 'edit':
        return t('invoices.subtitleEdit');
      case 'create':
        return t('invoices.subtitleCreate');
      default:
        return '';
    }
  };

  const getDeleteMessage = (item: Invoice | null) =>
    buildDeleteMessage(
      t,
      'invoices',
      item ? formatDisplayNumber('invoices', item.invoiceNumber || item.id) : undefined,
    );

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
    deleteInvoices,
    clearValidationErrors,
    // Bulk selection
    selectedInvoiceIds,
    toggleInvoiceSelected: toggleInvoiceSelectedCore,
    selectAllInvoices: selectAllInvoicesCore,
    mergeIntoInvoiceSelection: mergeIntoInvoiceSelectionCore,
    clearInvoiceSelection: clearInvoiceSelectionCore,
    selectedCount,
    isSelected,
    getPanelSubtitle,
    getDeleteMessage,

    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
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
