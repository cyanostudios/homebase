import { Calculator } from 'lucide-react';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { useApp } from '@/core/api/AppContext';
import { Badge } from '@/core/ui/Badge';

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
  saveEstimate: (estimateData: any) => Promise<boolean>;
  deleteEstimate: (id: string) => Promise<void>;
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel state
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [estimates, setEstimates] = useState<Estimate[]>([]);

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
    } catch (error) {
      console.error('Failed to load estimates:', error);
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

      return true;
    } catch (error) {
      console.error('API Error when saving estimate:', error);
      setValidationErrors([
        { field: 'general', message: 'Failed to save estimate. Please try again.' },
      ]);
      return false;
    }
  };

  const deleteEstimate = async (id: string) => {
    try {
      await estimatesApi.deleteEstimate(id);
    } catch (error) {
      console.error('Failed to delete estimate:', error);
    } finally {
      setEstimates((prev) => prev.filter((e) => e.id !== id));
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
    } catch (error) {
      console.error('Failed to duplicate estimate:', error);
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
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
          >
            @{contactName}
          </button>
        ) : (
          <span className="text-gray-600">@{contactName || 'Contact'}</span>
        );

      if (isMobileView) {
        return (
          <div>
            <div className="flex items-center gap-2">
              <span>{estimateNumber} • </span>
              {ContactChunk}
            </div>
            <div className="text-sm font-normal text-gray-600 mt-1">
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
        draft: 'bg-gray-100 text-gray-800',
        sent: 'bg-blue-100 text-blue-800',
        accepted: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
      };

      const badgeColor = statusColors[item.status] || statusColors.draft;
      const badgeText = item.status?.charAt(0).toUpperCase() + item.status?.slice(1);
      const validToText = `Valid to ${new Date(item.validTo).toLocaleDateString()}`;

      return (
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4" style={{ color: '#2563eb' }} />
          <Badge className={badgeColor}>{badgeText}</Badge>
          <span className="text-xs text-gray-600">• {validToText}</span>
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
    duplicateEstimate,
    clearValidationErrors,

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
