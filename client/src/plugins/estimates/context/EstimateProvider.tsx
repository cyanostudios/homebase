import React, { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

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
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';

import { estimateShareApi, estimatesApi } from '../api/estimatesApi';
import { EstimateDetailHeaderMenus } from '../components/EstimateDetailHeaderMenus';
import { Estimate, EstimateShare, ValidationError } from '../types/estimate';

import { EstimateContext } from './EstimateContext';
import type { EstimateContextType } from './EstimateContext';

interface EstimateProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function EstimateProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: EstimateProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, registerEstimatesNavigation } =
    useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/estimates');

  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [estimatesContentView, setEstimatesContentView] = useState<'list' | 'settings'>('list');

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [recentlyDuplicatedEstimateId, setRecentlyDuplicatedEstimateId] = useState<string | null>(
    null,
  );

  const estimatesDeepLinkPathSyncedRef = useRef<string | null>(null);

  const [quickEditDraft, setQuickEditDraft] = useState<Partial<{ status: string }> | null>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  const [estimateQuickEditShowStatusModal, setEstimateQuickEditShowStatusModal] = useState(false);
  const [estimateQuickEditShowSentConfirmation, setEstimateQuickEditShowSentConfirmation] =
    useState(false);
  const [estimateQuickEditPendingStatus, setEstimateQuickEditPendingStatus] = useState<
    'accepted' | 'rejected' | null
  >(null);
  /** Estimate targeted by status confirm dialogs (supports list preview without panel). */
  const [estimateQuickEditTarget, setEstimateQuickEditTarget] = useState<Estimate | null>(null);

  const {
    selectedIds: selectedEstimateIds,
    toggleSelection: toggleEstimateSelectedCore,
    selectAll: selectAllEstimatesCore,
    mergeIntoSelection: mergeIntoEstimateSelectionCore,
    clearSelection: clearEstimateSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  useEffect(() => {
    if (isAuthenticated) {
      loadEstimates();
    } else {
      setEstimates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isAuthenticated gate only
  }, [isAuthenticated]);

  useEffect(() => {
    registerPanelCloseFunction('estimates', closeEstimatePanel);
    return () => unregisterPanelCloseFunction('estimates');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEstimates = async () => {
    try {
      const estimatesData = await estimatesApi.getEstimates();
      const transformed = estimatesData.map((e: any) => ({
        ...e,
        validTo: new Date(e.validTo),
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      })) as Estimate[];
      setEstimates(transformed);
    } catch (error: any) {
      console.error('Failed to load estimates:', error);
      const errorMessage = error?.message || error?.error || 'Failed to load estimates';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  };

  const generateNextEstimateNumber = useCallback(async (): Promise<string> => {
    try {
      const raw: unknown = await estimatesApi.getNextEstimateNumber();
      if (typeof raw === 'string') {
        return raw;
      }
      if (
        raw !== null &&
        typeof raw === 'object' &&
        'estimateNumber' in raw &&
        typeof (raw as { estimateNumber: unknown }).estimateNumber === 'string'
      ) {
        return (raw as { estimateNumber: string }).estimateNumber;
      }
      console.warn('Unexpected response from getNextEstimateNumber:', raw);
      return `EST-${Date.now()}`;
    } catch (error) {
      console.error('Failed to generate estimate number:', error);
      return `EST-${Date.now()}`;
    }
  }, []);

  const validateEstimate = (estimateData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!estimateData.contactId) {
      errors.push({ field: 'contactId', message: 'Contact selection is required' });
    }
    if (!estimateData.validTo) {
      errors.push({ field: 'validTo', message: 'Valid to date is required' });
    }
    if (!estimateData.lineItems || estimateData.lineItems.length === 0) {
      errors.push({ field: 'lineItems', message: 'At least one line item is required' });
    }
    return errors;
  };

  const openEstimatePanel = (estimate: Estimate | null) => {
    clearEstimateSelectionCore();
    setRecentlyDuplicatedEstimateId(null);
    setQuickEditDraft(null);
    setCurrentEstimate(estimate);
    setPanelMode(estimate ? 'edit' : 'create');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    if (estimate) {
      const slug = buildSlug(estimate, estimates, 'estimateNumber');
      estimatesDeepLinkPathSyncedRef.current = `/estimates/${slug}`;
      navigateToItem(estimate, estimates, 'estimateNumber');
    }
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    if (estimate.status === 'invoiced') {
      return;
    }
    clearEstimateSelectionCore();
    setRecentlyDuplicatedEstimateId(null);
    setQuickEditDraft(null);
    setCurrentEstimate(estimate);
    setPanelMode('edit');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    const slug = buildSlug(estimate, estimates, 'estimateNumber');
    estimatesDeepLinkPathSyncedRef.current = `/estimates/${slug}`;
    navigateToItem(estimate, estimates, 'estimateNumber');
  };

  const openEstimateForView = useCallback(
    (estimate: Estimate) => {
      // Cross-plugin: navigate only; path sync opens the panel (facit: MatchProvider).
      if (!window.location.pathname.startsWith('/estimates')) {
        navigate(`/estimates/${buildSlug(estimate, estimates, 'estimateNumber')}`);
        return;
      }
      setRecentlyDuplicatedEstimateId(null);
      setQuickEditDraft(null);
      setCurrentEstimate(estimate);
      setPanelMode('view');
      setIsEstimatePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(estimate, estimates, 'estimateNumber');
    },
    [navigate, onCloseOtherPanels, navigateToItem, estimates, setValidationErrors],
  );

  const openEstimateForViewRef = useRef(openEstimateForView);
  useEffect(() => {
    openEstimateForViewRef.current = openEstimateForView;
  }, [openEstimateForView]);

  useEffect(() => {
    if (estimates.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'estimates') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      estimatesDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (estimatesDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, estimates, 'estimateNumber');
    estimatesDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openEstimateForViewRef.current(item as Estimate);
    }
  }, [location.pathname, estimates]);

  const openEstimateForViewBridge = useCallback((estimate: Estimate) => {
    openEstimateForViewRef.current(estimate);
  }, []);

  useEffect(() => {
    registerEstimatesNavigation(openEstimateForViewBridge);
    return () => registerEstimatesNavigation(null);
  }, [registerEstimatesNavigation, openEstimateForViewBridge]);

  const [browseOrderIds, setBrowseOrderIdsState] = useState<string[]>([]);
  const setBrowseOrderIds = useCallback((ids: string[]) => {
    setBrowseOrderIdsState(ids);
  }, []);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(estimates, currentEstimate, openEstimateForView, browseOrderIds);

  const closeEstimatePanel = useCallback(() => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setPanelMode('create');
    setValidationErrors([]);
    setQuickEditDraft(null);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  const saveEstimate = useCallback(
    async (
      estimateData: any,
      estimateId?: string,
    ): Promise<{ success: boolean; message?: string }> => {
      if (!estimateId) {
        const errors = validateEstimate(estimateData);
        setValidationErrors(errors);
        if (errors.length > 0) {
          const message = errors.map((e) => e.message).join('. ');
          return { success: false, message };
        }
      }

      try {
        let saved: Estimate;
        const idToUpdate = estimateId ?? currentEstimate?.id ?? null;

        if (idToUpdate) {
          saved = await estimatesApi.updateEstimate(String(idToUpdate), estimateData);
          const normalized = {
            ...saved,
            validTo: new Date(saved.validTo),
            createdAt: new Date(saved.createdAt),
            updatedAt: new Date(saved.updatedAt),
          };
          setEstimates((prev) =>
            prev.map((e) => (String(e.id) === String(idToUpdate) ? normalized : e)),
          );
          setCurrentEstimate((prev) =>
            prev && String(prev.id) === String(idToUpdate) ? normalized : prev,
          );
          if (currentEstimate && String(currentEstimate.id) === String(idToUpdate)) {
            setPanelMode('view');
          }
          setValidationErrors([]);
        } else {
          saved = await estimatesApi.createEstimate(estimateData);
          setEstimates((prev) => [
            ...prev,
            {
              ...saved,
              validTo: new Date(saved.validTo),
              createdAt: new Date(saved.createdAt),
              updatedAt: new Date(saved.updatedAt),
            },
          ]);
          closeEstimatePanel();
        }

        return { success: true };
      } catch (error: any) {
        console.error('API Error when saving estimate:', error);

        const validationErrors: ValidationError[] = [];

        if (error?.details && Array.isArray(error.details)) {
          error.details.forEach((detail: any) => {
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
          const errorMessage =
            error?.message || error?.error || 'Failed to save estimate. Please try again.';
          validationErrors.push({ field: 'general', message: errorMessage });
        }

        setValidationErrors(validationErrors);
        const message = validationErrors.map((e) => e.message).join('. ');
        return { success: false, message };
      }
    },
    [currentEstimate, closeEstimatePanel, setValidationErrors],
  );

  const deleteEstimate = async (id: string) => {
    try {
      await estimatesApi.deleteEstimate(id);
    } catch (error: any) {
      console.error('Failed to delete estimate:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete estimate';
      alert(errorMessage);
    } finally {
      setEstimates((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const deleteEstimates = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return;
    }

    try {
      await bulkApi.bulkDelete('estimates', uniqueIds);
      setEstimates((prev) => prev.filter((e) => !uniqueIds.includes(String(e.id))));
      clearEstimateSelectionCore();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete estimates';
      alert(errorMessage);
      throw error;
    }
  };

  const duplicateEstimate = useCallback(
    async (original: Estimate): Promise<Estimate | null> => {
      try {
        const estimateNumber = await generateNextEstimateNumber();

        const duplicateData: any = {
          ...original,
          estimateNumber,
          status: 'draft' as const,
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lineItems: original.lineItems.map((item) => ({
            ...item,
            id: `${Date.now()}-${Math.random()}`,
          })),
        };

        delete duplicateData.id;
        delete duplicateData.createdAt;
        delete duplicateData.updatedAt;

        const saved = await estimatesApi.createEstimate(duplicateData);
        const newEstimate = {
          ...saved,
          validTo: new Date(saved.validTo),
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        };
        setEstimates((prev) => [newEstimate, ...prev]);
        return newEstimate;
      } catch (error: any) {
        console.error('Failed to duplicate estimate:', error);
        const errorMessage =
          error?.message || error?.error || 'Failed to duplicate estimate. Please try again.';
        alert(errorMessage);
        return null;
      }
    },
    [generateNextEstimateNumber],
  );

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Estimate) => (item.contactName ? `Copy of ${item.contactName}` : ''),
    nameLabel: 'Estimate',
    confirmOnly: true,
    createDuplicate: duplicateEstimate,
    closePanel: closeEstimatePanel,
  });

  const [estimateShareExistingShare, setEstimateShareExistingShare] =
    useState<EstimateShare | null>(null);
  const [estimateShareShowDialog, setEstimateShareShowDialog] = useState(false);
  const [estimateShareShowExpiredModal, setEstimateShareShowExpiredModal] = useState(false);
  const [estimateShareIsCreatingShare, setEstimateShareIsCreatingShare] = useState(false);
  const [isConvertingEstimateToInvoice, setIsConvertingEstimateToInvoice] = useState(false);

  const defaultEstimateShareValidUntil = useCallback((): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const syncEstimateShareForEstimate = useCallback(
    async (estimateId: string | null | undefined) => {
      if (!estimateId) {
        setEstimateShareExistingShare(null);
        return;
      }
      try {
        const shares = await estimateShareApi.getShares(String(estimateId));
        const active = shares.find((s) => new Date(s.validUntil) > new Date());
        setEstimateShareExistingShare(active || null);
      } catch {
        setEstimateShareExistingShare(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (panelMode === 'view' && currentEstimate?.id) {
      void syncEstimateShareForEstimate(currentEstimate.id);
      return;
    }
    if (!currentEstimate?.id) {
      setEstimateShareExistingShare(null);
    }
  }, [panelMode, currentEstimate?.id, syncEstimateShareForEstimate]);

  /** Tasks-style: reuse active link or create with 30-day default. */
  const openEstimateShareForItem = useCallback(
    async (estimate: Estimate) => {
      setEstimateShareIsCreatingShare(true);
      try {
        const shares = await estimateShareApi.getShares(estimate.id);
        const active = shares.find((s) => new Date(s.validUntil) > new Date());
        if (active) {
          setEstimateShareExistingShare(active);
          setEstimateShareShowDialog(true);
          return;
        }
        const share = await estimateShareApi.createShare({
          estimateId: estimate.id,
          validUntil: defaultEstimateShareValidUntil(),
        });
        setEstimateShareExistingShare(share);
        setEstimateShareShowDialog(true);
      } catch (error) {
        console.error('Failed to create share:', error);
        alert(error instanceof Error ? error.message : 'Failed to create share link');
      } finally {
        setEstimateShareIsCreatingShare(false);
      }
    },
    [defaultEstimateShareValidUntil],
  );

  const handleEstimateCopyShareUrl = useCallback(() => {
    if (!estimateShareExistingShare) {
      return;
    }
    const url = estimateShareApi.generateShareUrl(estimateShareExistingShare.shareToken);
    navigator.clipboard.writeText(url).catch(() => {});
  }, [estimateShareExistingShare]);

  const handleEstimateRevokeShare = useCallback(async () => {
    if (!estimateShareExistingShare) {
      return;
    }
    try {
      await estimateShareApi.revokeShare(estimateShareExistingShare.id);
      setEstimateShareExistingShare(null);
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke share link');
    }
  }, [estimateShareExistingShare]);

  const setQuickEditField = useCallback((field: 'status', value: string) => {
    setQuickEditDraft((prev) => (prev ? { ...prev, [field]: value } : { [field]: value }));
  }, []);

  const hasQuickEditChanges = Boolean(
    currentEstimate &&
      quickEditDraft !== null &&
      quickEditDraft?.status !== undefined &&
      quickEditDraft.status !== currentEstimate.status,
  );

  const formatValidTo = useCallback((dateValue: any): string | null => {
    if (dateValue === null || dateValue === undefined || dateValue === '') {
      return null;
    }
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().split('T')[0];
  }, []);

  const performStatusChange = useCallback(
    async (estimate: Estimate, newStatus: string, reasons: string[] = []) => {
      const validTo = formatValidTo(estimate.validTo);
      const lineItems = estimate.lineItems ?? [];
      const updatedData = {
        contactId: estimate.contactId ?? null,
        contactName: estimate.contactName ?? '',
        organizationNumber: estimate.organizationNumber ?? '',
        currency: estimate.currency ?? 'SEK',
        lineItems,
        estimateDiscount: estimate.estimateDiscount ?? 0,
        notes: estimate.notes ?? '',
        orderNumber: estimate.orderNumber ?? '',
        deliveryMethod: estimate.deliveryMethod ?? '',
        validTo,
        status: newStatus,
        acceptanceReasons: newStatus === 'accepted' ? reasons : (estimate.acceptanceReasons ?? []),
        rejectionReasons: newStatus === 'rejected' ? reasons : (estimate.rejectionReasons ?? []),
      };
      const result = await saveEstimate(updatedData, estimate.id);
      if (!result.success) {
        alert(result.message ?? 'Failed to update status. Please try again.');
      }
    },
    [formatValidTo, saveEstimate],
  );

  /** Send button + status select: confirm sent / reasons for accept|reject, else save. */
  const requestStatusChange = useCallback(
    (newStatus: string, estimate?: Estimate | null) => {
      const target = estimate ?? currentEstimate;
      if (!target) {
        return;
      }
      if (newStatus === target.status) {
        setQuickEditDraft(null);
        return;
      }
      if (newStatus === 'sent') {
        setEstimateQuickEditTarget(target);
        setEstimateQuickEditShowSentConfirmation(true);
        return;
      }
      if (newStatus === 'accepted' || newStatus === 'rejected') {
        setEstimateQuickEditTarget(target);
        setEstimateQuickEditPendingStatus(newStatus);
        setEstimateQuickEditShowStatusModal(true);
        return;
      }
      void performStatusChange(target, newStatus, []).then(() => {
        setQuickEditDraft(null);
      });
    },
    [currentEstimate, performStatusChange],
  );

  const onApplyQuickEdit = useCallback(async () => {
    if (!currentEstimate || !quickEditDraft?.status) {
      return;
    }
    const draftStatus = quickEditDraft.status;

    if (draftStatus === 'sent' && currentEstimate.status !== 'sent') {
      setEstimateQuickEditTarget(currentEstimate);
      setEstimateQuickEditShowSentConfirmation(true);
      return;
    }
    if (
      (draftStatus === 'accepted' || draftStatus === 'rejected') &&
      currentEstimate.status !== draftStatus
    ) {
      setEstimateQuickEditTarget(currentEstimate);
      setEstimateQuickEditPendingStatus(draftStatus);
      setEstimateQuickEditShowStatusModal(true);
      return;
    }

    await performStatusChange(currentEstimate, draftStatus, []);
    setQuickEditDraft(null);
  }, [currentEstimate, quickEditDraft?.status, performStatusChange]);

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasQuickEditChanges) {
          pendingCloseRef.current = defaultClose;
          setShowDiscardQuickEditDialog(true);
        } else {
          defaultClose();
        }
      };
    },
    [hasQuickEditChanges],
  );

  const onDiscardQuickEditAndClose = useCallback(() => {
    setQuickEditDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, []);

  const handleEstimateQuickEditSentConfirm = useCallback(async () => {
    const target = estimateQuickEditTarget ?? currentEstimate;
    if (!target) {
      return;
    }
    await performStatusChange(target, 'sent', []);
    setEstimateQuickEditShowSentConfirmation(false);
    setEstimateQuickEditTarget(null);
    setQuickEditDraft(null);
  }, [currentEstimate, estimateQuickEditTarget, performStatusChange]);

  const handleEstimateQuickEditSentCancel = useCallback(() => {
    setEstimateQuickEditShowSentConfirmation(false);
    setEstimateQuickEditTarget(null);
  }, []);

  const handleEstimateQuickEditModalConfirm = useCallback(
    async (reasons: string[]) => {
      const target = estimateQuickEditTarget ?? currentEstimate;
      if (!target || !estimateQuickEditPendingStatus) {
        return;
      }
      await performStatusChange(target, estimateQuickEditPendingStatus, reasons);
      setEstimateQuickEditShowStatusModal(false);
      setEstimateQuickEditPendingStatus(null);
      setEstimateQuickEditTarget(null);
      setQuickEditDraft(null);
    },
    [currentEstimate, estimateQuickEditPendingStatus, estimateQuickEditTarget, performStatusChange],
  );

  const handleEstimateQuickEditModalCancel = useCallback(() => {
    setEstimateQuickEditShowStatusModal(false);
    setEstimateQuickEditPendingStatus(null);
    setEstimateQuickEditTarget(null);
  }, []);

  const convertEstimateToInvoice = useCallback(
    async (estimate: Estimate) => {
      setIsConvertingEstimateToInvoice(true);
      try {
        const result = await estimatesApi.convertToInvoice(estimate.id);
        const updated = {
          ...result.estimate,
          validTo: new Date(result.estimate.validTo),
          createdAt: new Date(result.estimate.createdAt),
          updatedAt: new Date(result.estimate.updatedAt),
        } as Estimate;
        setEstimates((prev) =>
          prev.map((e) => (String(e.id) === String(updated.id) ? updated : e)),
        );
        if (currentEstimate?.id === updated.id) {
          setCurrentEstimate(updated);
        }
        const invoice = result.invoice;
        if (invoice?.id) {
          const slug = buildSlug(
            { id: invoice.id, invoiceNumber: invoice.invoiceNumber || invoice.id },
            [],
            'invoiceNumber',
          );
          navigate(`/invoices/${slug}`);
        }
      } catch (error: any) {
        if (error?.status === 409 && error.existingInvoiceId) {
          const slug = buildSlug(
            { id: error.existingInvoiceId, invoiceNumber: error.existingInvoiceId },
            [],
            'invoiceNumber',
          );
          navigate(`/invoices/${slug}`);
          return;
        }
        alert(
          error?.message || t('estimates.convertFailed', { defaultValue: 'Conversion failed.' }),
        );
      } finally {
        setIsConvertingEstimateToInvoice(false);
      }
    },
    [currentEstimate?.id, navigate, t],
  );

  /** Export lives in EstimateDetailHeaderMenus (always, including soft preview). */
  const detailFooterActions = useMemo(() => [], []);

  const getPanelTitle = (
    mode: string,
    item: Estimate | null,
    _isMobileView: boolean,
    _handleEstimateContactClick: (contactId: string) => void,
  ) => {
    if (mode === 'view' && item) {
      return <EstimateDetailHeaderMenus key={String(item.id)} estimate={item} />;
    }

    switch (mode) {
      case 'edit':
        return t('panel.editItem', { item: t('nav.estimate') });
      case 'create':
        return t('panel.createItem', { item: t('nav.estimate') });
      default:
        return t('nav.estimate');
    }
  };

  const getPanelSubtitle = (mode: string, item: Estimate | null) => {
    if (mode === 'view' && item) {
      const statusColors: Record<string, string> = {
        draft: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
        sent: 'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
        accepted:
          'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
        rejected: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
        invoiced:
          'bg-violet-50/50 text-violet-700 dark:text-violet-300 border-violet-100/50 font-medium',
      };

      const badgeColor = statusColors[item.status] || statusColors.draft;
      const badgeText = item.status?.charAt(0).toUpperCase() + item.status?.slice(1).toLowerCase();
      const validToText = t('estimates.validTo', {
        date: new Date(item.validTo).toLocaleDateString(),
      });

      return (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 h-5 font-extrabold', badgeColor)}
          >
            {badgeText}
          </Badge>
          <span className="text-xs text-muted-foreground">• {validToText}</span>
        </div>
      );
    }

    switch (mode) {
      case 'edit':
        return t('estimates.subtitleEdit');
      case 'create':
        return t('estimates.subtitleCreate');
      default:
        return '';
    }
  };

  const getDeleteMessage = (item: Estimate | null) =>
    buildDeleteMessage(
      t,
      'estimates',
      item ? formatDisplayNumber('estimates', item.estimateNumber || item.id) : undefined,
    );

  const value: EstimateContextType = {
    isEstimatePanelOpen,
    currentEstimate,
    panelMode,
    validationErrors,
    estimates,
    openEstimatePanel,
    openEstimateForEdit,
    openEstimateForView,
    closeEstimatePanel,
    saveEstimate,
    deleteEstimate,
    deleteEstimates,
    duplicateEstimate,
    getDuplicateConfig,
    executeDuplicate,
    recentlyDuplicatedEstimateId,
    setRecentlyDuplicatedEstimateId,
    clearValidationErrors,
    selectedEstimateIds,
    toggleEstimateSelected: toggleEstimateSelectedCore,
    selectAllEstimates: selectAllEstimatesCore,
    mergeIntoEstimateSelection: mergeIntoEstimateSelectionCore,
    clearEstimateSelection: clearEstimateSelectionCore,
    selectedCount,
    isSelected,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    detailFooterActions,
    estimateShareExistingShare,
    estimateShareShowDialog,
    setEstimateShareShowDialog,
    estimateShareShowExpiredModal,
    setEstimateShareShowExpiredModal,
    estimateShareIsCreatingShare,
    syncEstimateShareForEstimate,
    openEstimateShareForItem,
    handleEstimateCopyShareUrl,
    handleEstimateRevokeShare,
    quickEditDraft,
    setQuickEditField,
    requestStatusChange,
    hasQuickEditChanges,
    onApplyQuickEdit,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    getCloseHandler,
    onDiscardQuickEditAndClose,
    estimateQuickEditShowStatusModal,
    estimateQuickEditShowSentConfirmation,
    estimateQuickEditPendingStatus,
    handleEstimateQuickEditSentConfirm,
    handleEstimateQuickEditSentCancel,
    handleEstimateQuickEditModalConfirm,
    handleEstimateQuickEditModalCancel,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
    setBrowseOrderIds,
    estimatesContentView,
    openEstimateSettings: () => setEstimatesContentView('settings'),
    closeEstimateSettingsView: () => setEstimatesContentView('list'),
    convertEstimateToInvoice,
    isConvertingEstimateToInvoice,
  };

  return <EstimateContext.Provider value={value}>{children}</EstimateContext.Provider>;
}
