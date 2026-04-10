import { Receipt } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
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

import { InvoicesContext } from './InvoicesContext';
import type { Invoice, InvoicesContextType, ValidationError } from './InvoicesContext';

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

  const [isInvoicesPanelOpen, setIsInvoicesPanelOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const {
    selectedIds: selectedInvoiceIds,
    toggleSelection: toggleInvoiceSelectedCore,
    selectAll: selectAllInvoicesCore,
    mergeIntoSelection: mergeIntoInvoiceSelectionCore,
    clearSelection: clearInvoiceSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

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

  const validate = (_data: any): ValidationError[] => {
    return [];
  };

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

      const validationErrors: ValidationError[] = [];

      if (err?.status === 409 && Array.isArray(err.errors)) {
        validationErrors.push(...err.errors);
      } else if (err?.details && Array.isArray(err.details)) {
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

      if (validationErrors.length === 0) {
        const errorMessage = err?.message || err?.error || 'Failed to save. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }

      setValidationErrors(validationErrors);
      return false;
    }
  };

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
      setInvoices((prev) => prev.filter((i) => !uniqueIds.includes(String(i.id))));
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
    closeInvoicePanel,
    saveInvoice,
    deleteInvoice,
    deleteInvoices,
    clearValidationErrors,
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
