import { Download, ExternalLink, Share } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
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

interface EstimateContextType {
  // Panel State
  isEstimatePanelOpen: boolean;
  currentEstimate: Estimate | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data State
  estimates: Estimate[];

  // Actions
  openEstimatePanel: (estimate: Estimate | null) => void;
  openEstimateForEdit: (estimate: Estimate) => void;
  openEstimateForView: (estimate: Estimate) => void;
  closeEstimatePanel: () => void;
  saveEstimate: (
    estimateData: any,
    estimateId?: string,
  ) => Promise<{ success: boolean; message?: string }>;
  deleteEstimate: (id: string) => Promise<void>;
  deleteEstimates: (ids: string[]) => Promise<void>;
  duplicateEstimate: (estimate: Estimate) => Promise<Estimate | null>;
  getDuplicateConfig: (
    item: Estimate | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeDuplicate: (
    item: Estimate,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedEstimateId: string | null;
  setRecentlyDuplicatedEstimateId: (id: string | null) => void;
  clearValidationErrors: () => void;
  // Bulk selection
  selectedEstimateIds: string[];
  toggleEstimateSelected: (id: string) => void;
  selectAllEstimates: (ids: string[]) => void;
  mergeIntoEstimateSelection: (ids: string[]) => void;
  clearEstimateSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  // Panel Title helpers
  getPanelTitle: (
    mode: string,
    item: Estimate | null,
    isMobileView: boolean,
    handleEstimateContactClick: (contactId: string) => void,
  ) => any;
  getPanelSubtitle: (mode: string, item: Estimate | null) => any;
  getDeleteMessage: (item: Estimate | null) => string;

  // Footer actions (view mode) + share state for view UI
  detailFooterActions: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Estimate) => void;
    className?: string;
    disabled?: boolean;
  }>;
  estimateShareExistingShare: EstimateShare | null;
  estimateShareShowDialog: boolean;
  setEstimateShareShowDialog: (show: boolean) => void;
  estimateShareShowExpiredModal: boolean;
  setEstimateShareShowExpiredModal: (show: boolean) => void;
  estimateShareIsDownloadingPdf: boolean;
  estimateShareIsCreatingShare: boolean;
  handleEstimateCopyShareUrl: () => void;
  handleEstimateRevokeShare: () => void;

  // Quick-edit status in view mode (draft until "Update" is clicked, like tasks)
  quickEditDraft: Partial<{ status: string }> | null;
  setQuickEditField: (field: 'status', value: string) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;
  // Status modals when applying quick edit (sent confirmation / reason modal)
  estimateQuickEditShowStatusModal: boolean;
  estimateQuickEditShowSentConfirmation: boolean;
  estimateQuickEditPendingStatus: 'accepted' | 'rejected' | null;
  handleEstimateQuickEditSentConfirm: () => void;
  handleEstimateQuickEditSentCancel: () => void;
  handleEstimateQuickEditModalConfirm: (reasons: string[]) => void;
  handleEstimateQuickEditModalCancel: () => void;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;

  estimatesContentView: 'list' | 'settings';
  openEstimateSettings: () => void;
  closeEstimateSettingsView: () => void;
}

const EstimateContext = createContext<EstimateContextType | undefined>(undefined);

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

  // Panel state
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [estimatesContentView, setEstimatesContentView] = useState<'list' | 'settings'>('list');

  // Data state
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [recentlyDuplicatedEstimateId, setRecentlyDuplicatedEstimateId] = useState<string | null>(
    null,
  );

  // Quick-edit status draft (view mode)
  const [quickEditDraft, setQuickEditDraft] = useState<Partial<{ status: string }> | null>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  // Status modals when applying quick edit
  const [estimateQuickEditShowStatusModal, setEstimateQuickEditShowStatusModal] = useState(false);
  const [estimateQuickEditShowSentConfirmation, setEstimateQuickEditShowSentConfirmation] =
    useState(false);
  const [estimateQuickEditPendingStatus, setEstimateQuickEditPendingStatus] = useState<
    'accepted' | 'rejected' | null
  >(null);

  // Use core bulk selection hook
  const {
    selectedIds: selectedEstimateIds,
    toggleSelection: toggleEstimateSelectedCore,
    selectAll: selectAllEstimatesCore,
    mergeIntoSelection: mergeIntoEstimateSelectionCore,
    clearSelection: clearEstimateSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  // Load on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadEstimates();
    } else {
      setEstimates([]);
    }
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

  // Register panel close function once
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
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to load estimates';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  };

  // ---- FIXED: robust parsing for both string and { estimateNumber } ----
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

  // ---- VALIDATION kept in module scope so it's always in scope where used ----
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

  // CRUD (clear bulk selection when opening panel)
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
    [onCloseOtherPanels, navigateToItem, estimates],
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

  const currentItemIndex = currentEstimate
    ? estimates.findIndex((e) => e.id === currentEstimate.id)
    : -1;
  const totalItems = estimates.length;
  const hasPrevItem = currentItemIndex > 0;
  const hasNextItem = currentItemIndex >= 0 && currentItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || currentItemIndex <= 0) {
      return;
    }
    const prev = estimates[currentItemIndex - 1];
    if (prev) {
      openEstimateForView(prev);
    }
  }, [hasPrevItem, currentItemIndex, estimates, openEstimateForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || currentItemIndex < 0 || currentItemIndex >= estimates.length - 1) {
      return;
    }
    const next = estimates[currentItemIndex + 1];
    if (next) {
      openEstimateForView(next);
    }
  }, [hasNextItem, currentItemIndex, estimates, openEstimateForView]);

  const closeEstimatePanel = useCallback(() => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setPanelMode('create');
    setValidationErrors([]);
    setQuickEditDraft(null);
    navigateToBase();
  }, [navigateToBase]);

  const clearValidationErrors = () => setValidationErrors([]);

  const saveEstimate = useCallback(
    async (
      estimateData: any,
      estimateId?: string,
    ): Promise<{ success: boolean; message?: string }> => {
      // When estimateId is provided we're updating an existing estimate (e.g. quick action status change).
      // Skip create-style validation so we don't block on contact/validTo/lineItems.
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

        // V2: Handle standardized error format from backend
        const validationErrors: ValidationError[] = [];

        // Check if backend returned validation errors in details array
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

        // If no validation errors from backend, use error message
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
    [currentEstimate, closeEstimatePanel],
  );

  const deleteEstimate = async (id: string) => {
    try {
      await estimatesApi.deleteEstimate(id);
    } catch (error: any) {
      console.error('Failed to delete estimate:', error);
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to delete estimate';
      alert(errorMessage);
    } finally {
      setEstimates((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Bulk delete using core bulkApi
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
      // Update local state - remove deleted estimates
      setEstimates((prev) => prev.filter((e) => !uniqueIds.includes(String(e.id))));
      // Clear selection after successful delete
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

  const getDuplicateConfig = useCallback((item: Estimate | null) => {
    if (!item) {
      return null;
    }
    return {
      defaultName: item.contactName ? `Copy of ${item.contactName}` : '',
      nameLabel: 'Estimate',
      confirmOnly: true,
    };
  }, []);

  const executeDuplicate = useCallback(
    async (
      item: Estimate,
      _newName: string,
    ): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const newEstimate = await duplicateEstimate(item);
      const highlightId = (newEstimate?.id ?? null) !== null ? String(newEstimate.id) : undefined;
      return { closePanel: closeEstimatePanel, highlightId };
    },
    [duplicateEstimate, closeEstimatePanel],
  );

  // Share state (for view mode footer + share URL box in view)
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

  // ---- Quick-edit status (view mode): draft until "Update" is clicked ----
  const setQuickEditField = useCallback((field: 'status', value: string) => {
    setQuickEditDraft((prev) => (prev ? { ...prev, [field]: value } : { [field]: value }));
  }, []);

  const hasQuickEditChanges = Boolean(
    currentEstimate &&
      (quickEditDraft?.status ?? null) !== null &&
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
        onClick: () => window.open(shareUrl, '_blank', 'noopener,noreferrer'),
        className: 'h-9 text-xs px-3',
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

  // Titles / subtitles
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

    if (t) {
      switch (mode) {
        case 'edit':
          return t('panel.editItem', { item: t('nav.estimate') });
        case 'create':
          return t('panel.createItem', { item: t('nav.estimate') });
        default:
          return t('nav.estimate');
      }
    }
    switch (mode) {
      case 'edit':
        return 'Edit Estimate';
      case 'create':
        return 'Create Estimate';
      default:
        return 'Estimate';
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

    // Bulk selection
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
    currentItemIndex: currentItemIndex === -1 ? 0 : currentItemIndex + 1,
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

export function useEstimateContext() {
  const context = useContext(EstimateContext);
  if (context === undefined) {
    throw new Error('useEstimateContext must be used within an EstimateProvider');
  }
  return context;
}
