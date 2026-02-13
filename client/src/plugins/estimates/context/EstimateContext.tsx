import { Calculator } from 'lucide-react';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { cn } from '@/lib/utils';

import { estimatesApi } from '../api/estimatesApi';
import { PublicRouteHandler } from '../components/PublicRouteHandler';
import { Estimate, ValidationError, calculateEstimateTotals } from '../types/estimate';

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
  duplicateEstimate: (estimate: Estimate) => Promise<void>;
  clearValidationErrors: () => void;
  // Bulk selection
  selectedEstimateIds: string[];
  toggleEstimateSelected: (id: string) => void;
  selectAllEstimates: (ids: string[]) => void;
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
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    registerEstimatesNavigation,
  } = useApp();

  // Panel state
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  // Use core bulk selection hook
  const {
    selectedIds: selectedEstimateIds,
    toggleSelection: toggleEstimateSelectedCore,
    selectAll: selectAllEstimatesCore,
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

  // Register panel close function once
  useEffect(() => {
    registerPanelCloseFunction('estimates', closeEstimatePanel);
    return () => unregisterPanelCloseFunction('estimates');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global submit/cancel hooks (optional integration points)
  useEffect(() => {
    (window as any).submitEstimatesForm = () => {
      const event = new CustomEvent('submitEstimateForm');
      window.dispatchEvent(event);
    };
    (window as any).cancelEstimatesForm = () => {
      const event = new CustomEvent('cancelEstimateForm');
      window.dispatchEvent(event);
    };
    return () => {
      delete (window as any).submitEstimatesForm;
      delete (window as any).cancelEstimatesForm;
    };
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
  const generateNextEstimateNumber = async (): Promise<string> => {
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
  };

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

  // CRUD
  const openEstimatePanel = (estimate: Estimate | null) => {
    setCurrentEstimate(estimate);
    setPanelMode(estimate ? 'edit' : 'create');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setPanelMode('edit');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForView = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setPanelMode('view');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

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

  const closeEstimatePanel = () => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const saveEstimate = async (
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
  };

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

  const duplicateEstimate = async (original: Estimate) => {
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
      setEstimates((prev) => [
        ...prev,
        {
          ...saved,
          validTo: new Date(saved.validTo),
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        },
      ]);
    } catch (error: any) {
      console.error('Failed to duplicate estimate:', error);
      // V2: Handle standardized error format
      const errorMessage =
        error?.message || error?.error || 'Failed to duplicate estimate. Please try again.';
      alert(errorMessage);
    }
  };

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
          <span className="text-gray-600 dark:text-gray-400">@{contactName || 'Contact'}</span>
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
      const validToText = `valid to ${new Date(item.validTo).toLocaleDateString()}`;

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
        return 'Update estimate information';
      case 'create':
        return 'Enter new estimate details';
      default:
        return '';
    }
  };

  const getDeleteMessage = (item: Estimate | null) => {
    if (!item) {
      return 'Are you sure you want to delete this estimate?';
    }
    const itemName = formatDisplayNumber('estimates', item.estimateNumber || item.id);
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

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
    clearValidationErrors,

    // Bulk selection
    selectedEstimateIds,
    toggleEstimateSelected: toggleEstimateSelectedCore,
    selectAllEstimates: selectAllEstimatesCore,
    clearEstimateSelection: clearEstimateSelectionCore,
    selectedCount,
    isSelected,

    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
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
