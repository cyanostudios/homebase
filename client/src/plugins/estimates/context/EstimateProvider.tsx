import { Download, ExternalLink, Share } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

import { estimateShareApi, estimatesApi } from '../api/estimatesApi';
import { PublicRouteHandler } from '../components/PublicRouteHandler';
import {
  Estimate,
  EstimateShare,
  ValidationError,
  calculateEstimateTotals,
} from '../types/estimate';

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

  const [quickEditDraft, setQuickEditDraft] = useState<Partial<{ status: string }> | null>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  const [estimateQuickEditShowStatusModal, setEstimateQuickEditShowStatusModal] = useState(false);
  const [estimateQuickEditShowSentConfirmation, setEstimateQuickEditShowSentConfirmation] =
    useState(false);
  const [estimateQuickEditPendingStatus, setEstimateQuickEditPendingStatus] = useState<
    'accepted' | 'rejected' | null
  >(null);

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

  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || estimates.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'estimates' || !parts[2]) {
      return;
    }
    const item = resolveSlug(parts[2], estimates, 'estimateNumber');
    if (item) {
      didOpenFromUrlRef.current = true;
      openEstimateForViewRef.current(item as Estimate);
    }
  }, [estimates]);

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
      navigateToItem(estimate, estimates, 'estimateNumber');
    }
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    clearEstimateSelectionCore();
    setRecentlyDuplicatedEstimateId(null);
    setQuickEditDraft(null);
    setCurrentEstimate(estimate);
    setPanelMode('edit');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(estimate, estimates, 'estimateNumber');
  };

  const openEstimateForView = useCallback(
    (estimate: Estimate) => {
      setRecentlyDuplicatedEstimateId(null);
      setQuickEditDraft(null);
      setCurrentEstimate(estimate);
      setPanelMode('view');
      setIsEstimatePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(estimate, estimates, 'estimateNumber');
    },
    [onCloseOtherPanels, navigateToItem, estimates, setValidationErrors],
  );

  const openEstimateForViewRef = useRef(openEstimateForView);
  useEffect(() => {
    openEstimateForViewRef.current = openEstimateForView;
  }, [openEstimateForView]);

  const openEstimateForViewBridge = useCallback((estimate: Estimate) => {
    openEstimateForViewRef.current(estimate);
  }, []);

  useEffect(() => {
    registerEstimatesNavigation(openEstimateForViewBridge);
    return () => registerEstimatesNavigation(null);
  }, [registerEstimatesNavigation, openEstimateForViewBridge]);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(estimates, currentEstimate, openEstimateForView);

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
          saved = await estimatesApi.updateEstimate(idToUpdate, estimateData);
          setEstimates((prev) =>
            prev.map((e) =>
              e.id === idToUpdate
                ? {
                    ...saved,
                    validTo: new Date(saved.validTo),
                    createdAt: new Date(saved.createdAt),
                    updatedAt: new Date(saved.updatedAt),
                  }
                : e,
            ),
          );
          if (currentEstimate?.id === idToUpdate) {
            setCurrentEstimate({
              ...saved,
              validTo: new Date(saved.validTo),
              createdAt: new Date(saved.createdAt),
              updatedAt: new Date(saved.updatedAt),
            });
          }
          setPanelMode('view');
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
  const [estimateShareIsDownloadingPdf, setEstimateShareIsDownloadingPdf] = useState(false);
  const [estimateShareIsCreatingShare, setEstimateShareIsCreatingShare] = useState(false);

  useEffect(() => {
    if (panelMode === 'view' && currentEstimate?.id) {
      let cancelled = false;
      estimateShareApi
        .getShares(currentEstimate.id)
        .then((shares) => {
          if (cancelled) {
            return;
          }
          const active = shares.find((s) => new Date(s.validUntil) > new Date());
          setEstimateShareExistingShare(active || null);
        })
        .catch(() => {
          if (!cancelled) {
            setEstimateShareExistingShare(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    setEstimateShareExistingShare(null);
  }, [panelMode, currentEstimate?.id]);

  const handleDownloadPdf = useCallback(async (estimate: Estimate) => {
    setEstimateShareIsDownloadingPdf(true);
    try {
      await estimatesApi.downloadPDF(estimate.id);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setEstimateShareIsDownloadingPdf(false);
    }
  }, []);

  const handleShareClick = useCallback(
    async (estimate: Estimate) => {
      if (new Date(estimate.validTo) <= new Date()) {
        setEstimateShareShowExpiredModal(true);
        return;
      }
      if (estimateShareExistingShare) {
        setEstimateShareShowDialog(true);
        return;
      }
      setEstimateShareIsCreatingShare(true);
      try {
        const share = await estimateShareApi.createShare({
          estimateId: estimate.id,
          validUntil: estimate.validTo,
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
    [estimateShareExistingShare],
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

  const onApplyQuickEdit = useCallback(async () => {
    if (!currentEstimate || !quickEditDraft?.status) {
      return;
    }
    const draftStatus = quickEditDraft.status;

    if (draftStatus === 'sent' && currentEstimate.status !== 'sent') {
      setEstimateQuickEditShowSentConfirmation(true);
      return;
    }
    if (
      (draftStatus === 'accepted' || draftStatus === 'rejected') &&
      currentEstimate.status !== draftStatus
    ) {
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
    if (!currentEstimate) {
      return;
    }
    await performStatusChange(currentEstimate, 'sent', []);
    setEstimateQuickEditShowSentConfirmation(false);
    setQuickEditDraft(null);
  }, [currentEstimate, performStatusChange]);

  const handleEstimateQuickEditSentCancel = useCallback(() => {
    setEstimateQuickEditShowSentConfirmation(false);
  }, []);

  const handleEstimateQuickEditModalConfirm = useCallback(
    async (reasons: string[]) => {
      if (!currentEstimate || !estimateQuickEditPendingStatus) {
        return;
      }
      await performStatusChange(currentEstimate, estimateQuickEditPendingStatus, reasons);
      setEstimateQuickEditShowStatusModal(false);
      setEstimateQuickEditPendingStatus(null);
      setQuickEditDraft(null);
    },
    [currentEstimate, estimateQuickEditPendingStatus, performStatusChange],
  );

  const handleEstimateQuickEditModalCancel = useCallback(() => {
    setEstimateQuickEditShowStatusModal(false);
    setEstimateQuickEditPendingStatus(null);
  }, []);

  const detailFooterActions = useMemo(() => {
    if (panelMode !== 'view' || !currentEstimate) {
      return [];
    }
    const hasActiveShare =
      estimateShareExistingShare && new Date(estimateShareExistingShare.validUntil) > new Date();
    const actions = [
      {
        id: 'download-pdf',
        label: estimateShareIsDownloadingPdf ? 'Generating PDF…' : 'Download PDF',
        icon: Download,
        onClick: (item: Estimate) => handleDownloadPdf(item),
        className: 'h-9 text-xs px-3',
        disabled: estimateShareIsDownloadingPdf,
      },
    ];
    if (hasActiveShare && estimateShareExistingShare) {
      const shareUrl = estimateShareApi.generateShareUrl(estimateShareExistingShare.shareToken);
      actions.push({
        id: 'view-share',
        label: 'View',
        icon: ExternalLink,
        onClick: async (_item: Estimate) => {
          window.open(shareUrl, '_blank', 'noopener,noreferrer');
        },
        className: 'h-9 text-xs px-3',
        disabled: false,
      });
    } else {
      actions.push({
        id: 'share',
        label: estimateShareIsCreatingShare ? 'Creating Share…' : 'Share estimate',
        icon: Share,
        onClick: (item: Estimate) => handleShareClick(item),
        className: 'h-9 text-xs px-3',
        disabled: estimateShareIsCreatingShare,
      });
    }
    return actions;
  }, [
    panelMode,
    currentEstimate,
    estimateShareIsDownloadingPdf,
    estimateShareIsCreatingShare,
    estimateShareExistingShare,
    handleDownloadPdf,
    handleShareClick,
  ]);

  const getPanelTitle = (
    mode: string,
    item: Estimate | null,
    isMobileView: boolean,
    handleEstimateContactClick: (contactId: string) => void,
  ) => {
    if (mode === 'view' && item) {
      const totals = calculateEstimateTotals(item.lineItems || [], item.estimateDiscount || 0);
      const estimateNumber = formatDisplayNumber('estimates', item.estimateNumber || item.id);
      const total = totals.total.toFixed(2);
      const currency = item.currency || 'SEK';
      const contactId = item.contactId;
      const contactName = item.contactName;

      const ContactChunk =
        typeof contactId === 'string' && contactId ? (
          <Button
            variant="link"
            size="sm"
            onClick={() => handleEstimateContactClick(contactId)}
            className="h-auto p-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            @{contactName}
          </Button>
        ) : (
          <span className="text-gray-600 dark:text-gray-400">
            @{contactName || t('nav.contact')}
          </span>
        );

      if (isMobileView) {
        return (
          <div>
            <div className="flex items-center gap-2">
              <span>{estimateNumber} • </span>
              {ContactChunk}
            </div>
            <div className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-1">
              {total} {currency}
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
          <span>{estimateNumber}</span>
          <span className="text-muted-foreground/30 font-light mx-1">|</span>
          {ContactChunk}
          <span className="text-muted-foreground/30 font-light mx-1">|</span>
          <span className="text-muted-foreground whitespace-nowrap">
            {total} {currency}
          </span>
        </div>
      );
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
      };

      const badgeColor = statusColors[item.status] || statusColors.draft;
      const badgeText = item.status?.charAt(0).toUpperCase() + item.status?.slice(1).toLowerCase();
      const validToText = t('estimates.validTo', {
        date: new Date(item.validTo).toLocaleDateString(),
      });

      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 h-5', badgeColor)}>
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
    estimateShareIsDownloadingPdf,
    estimateShareIsCreatingShare,
    handleEstimateCopyShareUrl,
    handleEstimateRevokeShare,
    quickEditDraft,
    setQuickEditField,
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
    estimatesContentView,
    openEstimateSettings: () => setEstimatesContentView('settings'),
    closeEstimateSettingsView: () => setEstimatesContentView('list'),
  };

  return (
    <EstimateContext.Provider value={value}>
      <PublicRouteHandler>{children}</PublicRouteHandler>
    </EstimateContext.Provider>
  );
}
