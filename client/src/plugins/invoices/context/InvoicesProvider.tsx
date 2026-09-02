import { Receipt } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { resolveSlug } from '@/core/utils/slugUtils';

import { InvoicesApi, invoicesApi } from '../api/invoicesApi';
import { InvoiceDetailHeaderMenus } from '../components/InvoiceDetailHeaderMenus';
import { computeDueDateFromPaymentTerms } from '../utils/invoiceDueDate';

import { InvoicesContext } from './InvoicesContext';
import type {
  Invoice,
  InvoiceShare,
  InvoicesContextType,
  ValidationError,
} from './InvoicesContext';

function defaultShareValidUntilDate(): string {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return thirtyDaysFromNow.toISOString().split('T')[0];
}

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
  const [invoicesContentView, setInvoicesContentView] = useState<'list' | 'settings'>('list');
  const [recentlyDuplicatedInvoiceId, setRecentlyDuplicatedInvoiceId] = useState<string | null>(
    null,
  );

  const [invoiceShare, setInvoiceShare] = useState<InvoiceShare | null>(null);
  const [isCreatingInvoiceShare, setIsCreatingInvoiceShare] = useState(false);
  const [showCreateInvoiceShareModal, setShowCreateInvoiceShareModal] = useState(false);
  const [showInvoiceShareDialog, setShowInvoiceShareDialog] = useState(false);
  const [shareValidUntil, setShareValidUntil] = useState(defaultShareValidUntilDate);
  const [shareTargetInvoice, setShareTargetInvoice] = useState<Invoice | null>(null);

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
    setRecentlyDuplicatedInvoiceId(null);
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
    setRecentlyDuplicatedInvoiceId(null);
    setCurrentInvoice(item);
    setPanelMode('edit');
    setIsInvoicesPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(item, invoices, 'invoiceNumber');
  };

  const openInvoiceForView = useCallback(
    (item: Invoice) => {
      setRecentlyDuplicatedInvoiceId(null);
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

  useEffect(() => {
    if (!currentInvoice?.id) {
      setInvoiceShare(null);
      return;
    }
    let cancelled = false;
    api
      .getShares(currentInvoice.id)
      .then((shares: InvoiceShare[]) => {
        if (cancelled) {
          return;
        }
        const activeShare = shares.find((share) => new Date(share.validUntil) > new Date());
        setInvoiceShare(activeShare || null);
      })
      .catch((error: unknown) => {
        console.error('Failed to load existing shares:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [api, currentInvoice?.id]);

  const openInvoiceShareForItem = useCallback(
    async (invoice: Invoice) => {
      setShareTargetInvoice(invoice);
      setIsCreatingInvoiceShare(true);
      try {
        const shares = await api.getShares(invoice.id);
        const activeShare = (shares as InvoiceShare[]).find(
          (share) => new Date(share.validUntil) > new Date(),
        );
        if (activeShare) {
          setInvoiceShare(activeShare);
          setShowInvoiceShareDialog(true);
          return;
        }
        setShareValidUntil(defaultShareValidUntilDate());
        setShowCreateInvoiceShareModal(true);
      } catch (error) {
        console.error('Failed to open invoice share:', error);
        alert(error instanceof Error ? error.message : 'Failed to open share');
      } finally {
        setIsCreatingInvoiceShare(false);
      }
    },
    [api],
  );

  const openCreateInvoiceShare = useCallback(() => {
    if (!currentInvoice) {
      return;
    }
    void openInvoiceShareForItem(currentInvoice);
  }, [currentInvoice, openInvoiceShareForItem]);

  const openInvoiceShareDialog = useCallback(() => {
    if (invoiceShare) {
      setShowInvoiceShareDialog(true);
    }
  }, [invoiceShare]);

  const handleCreateInvoiceShare = useCallback(async () => {
    const invoiceId = shareTargetInvoice?.id ?? currentInvoice?.id;
    if (!invoiceId || !shareValidUntil) {
      return;
    }
    try {
      setIsCreatingInvoiceShare(true);
      const share = await api.createShare(invoiceId, shareValidUntil);
      setInvoiceShare(share);
      setShowCreateInvoiceShareModal(false);
      setShowInvoiceShareDialog(true);
    } catch (error) {
      console.error('Failed to create share:', error);
      alert(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setIsCreatingInvoiceShare(false);
    }
  }, [api, currentInvoice?.id, shareTargetInvoice?.id, shareValidUntil]);

  const handleCopyInvoiceShareUrl = useCallback(() => {
    if (!invoiceShare) {
      return;
    }
    const url = `${window.location.origin}/public/invoice/${invoiceShare.shareToken}`;
    void navigator.clipboard.writeText(url);
  }, [invoiceShare]);

  const handleRevokeInvoiceShare = useCallback(async () => {
    if (!invoiceShare) {
      return;
    }
    try {
      await api.revokeShare(invoiceShare.id);
      setInvoiceShare(null);
      setShowInvoiceShareDialog(false);
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke share link');
    }
  }, [api, invoiceShare]);

  const getPanelTitle = useCallback((mode: string, item: Invoice | null) => {
    if (mode === 'view' && item) {
      return <InvoiceDetailHeaderMenus key={String(item.id)} invoice={item} />;
    }
    return null;
  }, []);

  const duplicateInvoice = useCallback(
    async (original: Invoice, _newName: string): Promise<Invoice | null> => {
      try {
        const { invoiceNumber } = await api.getNextNumber();
        const issueDate = new Date();
        const paymentTerms = original.paymentTerms || '30';
        const dueDate =
          computeDueDateFromPaymentTerms(issueDate, paymentTerms) ??
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const duplicateData: any = {
          ...original,
          invoiceNumber,
          status: 'draft',
          paidAt: null,
          paymentTerms,
          lineItems: (original.lineItems || []).map((item: any) => ({
            ...item,
            id: `${Date.now()}-${Math.random()}`,
          })),
          issueDate,
          dueDate,
        };
        delete duplicateData.id;
        delete duplicateData.createdAt;
        delete duplicateData.updatedAt;
        delete duplicateData.estimateId;

        const saved = await api.createItem({
          ...duplicateData,
          issueDate: duplicateData.issueDate.toISOString(),
          dueDate: duplicateData.dueDate.toISOString(),
        });
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
          issueDate: saved.issueDate ? new Date(saved.issueDate) : null,
          dueDate: saved.dueDate ? new Date(saved.dueDate) : null,
        };
        setInvoices((prev) => [normalized, ...prev]);
        return normalized as Invoice;
      } catch (err) {
        console.error('Failed to duplicate invoice:', err);
        return null;
      }
    },
    [api],
  );

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Invoice) =>
      item.contactName
        ? `Copy of ${item.contactName}`
        : `Copy of ${formatDisplayNumber('invoices', item.invoiceNumber || item.id)}`,
    nameLabel: t('nav.invoice'),
    confirmOnly: true,
    createDuplicate: duplicateInvoice,
    closePanel: closeInvoicesPanel,
  });

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
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    invoiceShare,
    isCreatingInvoiceShare,
    showCreateInvoiceShareModal,
    setShowCreateInvoiceShareModal,
    showInvoiceShareDialog,
    setShowInvoiceShareDialog,
    shareValidUntil,
    setShareValidUntil,
    openCreateInvoiceShare,
    openInvoiceShareForItem,
    openInvoiceShareDialog,
    handleCreateInvoiceShare,
    handleCopyInvoiceShareUrl,
    handleRevokeInvoiceShare,
    shareTargetInvoice,
    getDuplicateConfig,
    executeDuplicate,
    recentlyDuplicatedInvoiceId,
    setRecentlyDuplicatedInvoiceId,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
    invoicesContentView,
    openInvoiceSettings: () => setInvoicesContentView('settings'),
    closeInvoiceSettingsView: () => setInvoicesContentView('list'),
  };

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>;
}
