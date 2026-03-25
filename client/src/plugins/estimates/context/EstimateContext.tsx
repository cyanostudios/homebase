import { Calculator } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import {
  getAppCurrentPage,
  isEstimatesBootstrapPage,
  subscribeAppCurrentPage,
} from '@/core/navigation/appCurrentPageStore';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';

import { estimatesApi } from '../api/estimatesApi';
import { PublicRouteHandler } from '../components/PublicRouteHandler';
import { Estimate, ValidationError, calculateEstimateTotals } from '../types/estimate';
import { estimateExportConfig, getEstimateExportBaseFilename } from '../utils/estimateExportConfig';

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
  saveEstimate: (estimateData: any) => Promise<boolean>;
  deleteEstimate: (id: string) => Promise<void>;
  deleteEstimates: (ids: string[]) => Promise<void>;
  duplicateEstimate: (estimate: Estimate) => Promise<void>;
  clearValidationErrors: () => void;

  // Panel Title helpers
  getPanelTitle: (
    mode: string,
    item: Estimate | null,
    isMobileView: boolean,
    handleEstimateContactClick: (contactId: string) => void,
  ) => any;
  getPanelSubtitle: (mode: string, item: Estimate | null) => any;
  getDeleteMessage: (item: Estimate | null) => string;

  // Detail footer export
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Estimate) => void;
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, refreshData } = useApp();
  const activePage = useSyncExternalStore(
    subscribeAppCurrentPage,
    getAppCurrentPage,
    getAppCurrentPage,
  );
  const shouldBootstrapEstimates = isAuthenticated && isEstimatesBootstrapPage(activePage);

  // Panel state
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [estimates, setEstimates] = useState<Estimate[]>([]);

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

  const loadEstimates = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setEstimates([]);
      return;
    }
    if (!shouldBootstrapEstimates) {
      return;
    }
    void loadEstimates();
  }, [isAuthenticated, shouldBootstrapEstimates, loadEstimates]);

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
    void loadEstimates();
    setCurrentEstimate(estimate);
    setPanelMode(estimate ? 'edit' : 'create');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    void loadEstimates();
    setCurrentEstimate(estimate);
    setPanelMode('edit');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForView = (estimate: Estimate) => {
    void loadEstimates();
    setCurrentEstimate(estimate);
    setPanelMode('view');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeEstimatePanel = () => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const saveEstimate = async (estimateData: any): Promise<boolean> => {
    const errors = validateEstimate(estimateData);
    setValidationErrors(errors);
    if (errors.length > 0) {
      return false;
    }

    try {
      let saved: Estimate;

      if (currentEstimate) {
        saved = await estimatesApi.updateEstimate(currentEstimate.id, estimateData);
        setEstimates((prev) =>
          prev.map((e) =>
            e.id === currentEstimate.id
              ? {
                  ...saved,
                  validTo: new Date(saved.validTo),
                  createdAt: new Date(saved.createdAt),
                  updatedAt: new Date(saved.updatedAt),
                }
              : e,
          ),
        );
        setCurrentEstimate({
          ...saved,
          validTo: new Date(saved.validTo),
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        });
        setPanelMode('view');
        setValidationErrors([]);
        await refreshData();
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
        await refreshData();
      }

      return true;
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
      return false;
    }
  };

  const deleteEstimate = async (id: string) => {
    try {
      await estimatesApi.deleteEstimate(id);
      setEstimates((prev) => prev.filter((e) => e.id !== id));
      await refreshData();
    } catch (error: any) {
      console.error('Failed to delete estimate:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete estimate';
      alert(errorMessage);
    }
  };

  const deleteEstimates = async (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    try {
      await estimatesApi.bulkDelete(ids);
      await loadEstimates();
      await refreshData();
    } catch (error: any) {
      console.error('Failed to bulk delete estimates:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete estimates';
      alert(errorMessage);
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
      await refreshData();
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
      const estimateNumber = item.estimateNumber || `#${item.id}`;
      const total = totals.total.toFixed(2);
      const currency = item.currency || 'SEK';
      const contactId = item.contactId;
      const contactName = item.contactName;

      const ContactChunk =
        typeof contactId === 'string' && contactId ? (
          <button
            onClick={() => handleEstimateContactClick(contactId)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium px-1 rounded"
          >
            @{contactName}
          </button>
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
          <span>{estimateNumber} • </span>
          {ContactChunk}
          <span>
            {' '}
            • {total} {currency}
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
        draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
        sent: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
        accepted: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
        rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
      };

      const badgeColor = statusColors[item.status] || statusColors.draft;
      const badgeText = item.status?.charAt(0).toUpperCase() + item.status?.slice(1);
      const validToText = `Valid to ${new Date(item.validTo).toLocaleDateString()}`;

      return (
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4" style={{ color: '#2563eb' }} />
          <Badge className={badgeColor}>{badgeText}</Badge>
          <span className="text-xs text-gray-600 dark:text-gray-400">• {validToText}</span>
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
    const itemName = item.estimateNumber || 'this estimate';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const exportFormats: ExportFormat[] = ['csv', 'pdf'];

  const onExportItem = useCallback((format: ExportFormat, item: Estimate) => {
    const result = exportItems({
      items: [item],
      format,
      config: estimateExportConfig,
      filename: getEstimateExportBaseFilename(item),
      title: 'Estimates Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch((err) => {
        console.error('Export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  }, []);

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

    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,

    exportFormats,
    onExportItem,
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
