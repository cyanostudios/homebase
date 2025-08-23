import { PublicRouteHandler } from '../components/PublicRouteHandler';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Calculator } from 'lucide-react';
import { Badge } from '@/core/ui/Badge';
import { Estimate, ValidationError, calculateEstimateTotals } from '../types/estimate';
import { estimatesApi } from '../api/estimatesApi';
import { useApp } from '@/core/api/AppContext';

interface EstimateContextType {
  // Panel State - STANDARDIZED: Using generic panelMode convention
  isEstimatePanelOpen: boolean;
  currentEstimate: Estimate | null;
  panelMode: 'create' | 'edit' | 'view'; // CHANGED: From estimatePanelMode to panelMode
  validationErrors: ValidationError[];
  
  // Data State
  estimates: Estimate[];
  
  // Actions - STANDARDIZED: Consistent function naming
  openEstimatePanel: (estimate: Estimate | null) => void;
  openEstimateForEdit: (estimate: Estimate) => void;
  openEstimateForView: (estimate: Estimate) => void;
  closeEstimatePanel: () => void;
  saveEstimate: (estimateData: any) => Promise<boolean>;
  deleteEstimate: (id: string) => Promise<void>;
  duplicateEstimate: (estimate: Estimate) => Promise<void>;
  clearValidationErrors: () => void;
  
  // NEW: Panel Title Functions
  getPanelTitle: (mode: string, item: Estimate | null, isMobileView: boolean, handleEstimateContactClick: (contactId: string) => void) => any;
  getPanelSubtitle: (mode: string, item: Estimate | null) => any;
  getDeleteMessage: (item: Estimate | null) => string;
}

const EstimateContext = createContext<EstimateContextType | undefined>(undefined);

interface EstimateProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function EstimateProvider({ children, isAuthenticated, onCloseOtherPanels }: EstimateProviderProps) {
  // Get panel registration functions from AppContext
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  
  // Panel states - STANDARDIZED: Using generic panelMode
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create'); // CHANGED: From estimatePanelMode
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Data state
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadEstimates();
    } else {
      setEstimates([]);
    }
  }, [isAuthenticated]);

  // Panel registration
  useEffect(() => {
    registerPanelCloseFunction('estimates', closeEstimatePanel);
    return () => unregisterPanelCloseFunction('estimates');
  }, []);

  // Global functions for form submission
  useEffect(() => {
    window.submitEstimatesForm = () => {
      const event = new CustomEvent('submitEstimateForm');
      window.dispatchEvent(event);
    };

    window.cancelEstimatesForm = () => {
      const event = new CustomEvent('cancelEstimateForm');
      window.dispatchEvent(event);
    };

    return () => {
      delete window.submitEstimatesForm;
      delete window.cancelEstimatesForm;
    };
  }, []);

  const loadEstimates = async () => {
    try {
      const estimatesData = await estimatesApi.getEstimates();
      const transformedEstimates = estimatesData.map((estimate: any) => ({
        ...estimate,
        validTo: new Date(estimate.validTo),
        createdAt: new Date(estimate.createdAt),
        updatedAt: new Date(estimate.updatedAt),
      }));
      setEstimates(transformedEstimates);
    } catch (error) {
      console.error('Failed to load estimates:', error);
    }
  };

  const generateNextEstimateNumber = async (): Promise<string> => {
    try {
      const response = await estimatesApi.getNextEstimateNumber();
      return response.estimateNumber;
    } catch (error) {
      console.error('Failed to generate estimate number:', error);
      return `EST-${Date.now()}`;
    }
  };

  const validateEstimate = (estimateData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (!estimateData.contactId) {
      errors.push({
        field: 'contactId',
        message: 'Contact selection is required'
      });
    }
    
    if (!estimateData.validTo) {
      errors.push({
        field: 'validTo',
        message: 'Valid to date is required'
      });
    }
    
    if (!estimateData.lineItems || estimateData.lineItems.length === 0) {
      errors.push({
        field: 'lineItems',
        message: 'At least one line item is required'
      });
    }
    
    return errors;
  };

  // CRUD Functions - STANDARDIZED naming
  const openEstimatePanel = (estimate: Estimate | null) => {
    setCurrentEstimate(estimate);
    setPanelMode(estimate ? 'edit' : 'create'); // UPDATED: Using setPanelMode
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setPanelMode('edit'); // UPDATED: Using setPanelMode
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForView = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setPanelMode('view'); // UPDATED: Using setPanelMode
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeEstimatePanel = () => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setPanelMode('create'); // UPDATED: Using setPanelMode
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveEstimate = async (estimateData: any): Promise<boolean> => {
    console.log('EstimateContext saveEstimate called with:', estimateData);
    
    const errors = validateEstimate(estimateData);
    console.log('Validation errors:', errors);
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      console.log('Validation failed:', errors);
      return false;
    }
    
    console.log('Validation passed, attempting to save...');
    
    try {
      let savedEstimate: Estimate;
      
      if (currentEstimate) {
        console.log('Updating existing estimate:', currentEstimate.id);
        savedEstimate = await estimatesApi.updateEstimate(currentEstimate.id, estimateData);
        setEstimates(prev => prev.map(estimate => 
          estimate.id === currentEstimate.id ? {
            ...savedEstimate,
            validTo: new Date(savedEstimate.validTo),
            createdAt: new Date(savedEstimate.createdAt),
            updatedAt: new Date(savedEstimate.updatedAt),
          } : estimate
        ));
        setCurrentEstimate({
          ...savedEstimate,
          validTo: new Date(savedEstimate.validTo),
          createdAt: new Date(savedEstimate.createdAt),
          updatedAt: new Date(savedEstimate.updatedAt),
        });
        setPanelMode('view'); // UPDATED: Using setPanelMode
        setValidationErrors([]);
      } else {
        console.log('Creating new estimate...');
        savedEstimate = await estimatesApi.createEstimate(estimateData);
        console.log('Estimate created successfully:', savedEstimate);
        setEstimates(prev => [...prev, {
          ...savedEstimate,
          validTo: new Date(savedEstimate.validTo),
          createdAt: new Date(savedEstimate.createdAt),
          updatedAt: new Date(savedEstimate.updatedAt),
        }]);
        closeEstimatePanel();
      }
      
      console.log('Estimate saved successfully');
      return true;
    } catch (error) {
      console.error('API Error when saving estimate:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save estimate. Please try again.' }]);
      return false;
    }
  };

  const deleteEstimate = async (id: string) => {
    console.log("Deleting estimate with id:", id);
    try {
      await estimatesApi.deleteEstimate(id);
      setEstimates(prev => {
        const newEstimates = prev.filter(estimate => estimate.id !== id);
        console.log("Estimates after delete:", newEstimates);
        return newEstimates;
      });
    } catch (error) {
      console.error('Failed to delete estimate:', error);
    }
  };

  const duplicateEstimate = async (originalEstimate: Estimate) => {
    try {
      const estimateNumber = await generateNextEstimateNumber();
      
      const duplicateData = {
        ...originalEstimate,
        estimateNumber,
        status: 'draft' as const,
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: originalEstimate.lineItems.map(item => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`,
        })),
      };
      
      delete (duplicateData as any).id;
      delete (duplicateData as any).createdAt;
      delete (duplicateData as any).updatedAt;
      
      const savedEstimate = await estimatesApi.createEstimate(duplicateData);
      setEstimates(prev => [...prev, {
        ...savedEstimate,
        validTo: new Date(savedEstimate.validTo),
        createdAt: new Date(savedEstimate.createdAt),
        updatedAt: new Date(savedEstimate.updatedAt),
      }]);
    } catch (error) {
      console.error('Failed to duplicate estimate:', error);
    }
  };

  // NEW: Panel Title Functions (moved from PanelTitles.tsx)
  const getPanelTitle = (mode: string, item: Estimate | null, isMobileView: boolean, handleEstimateContactClick: (contactId: string) => void) => {
    // View mode with item
    if (mode === 'view' && item) {
      const totals = calculateEstimateTotals(item.lineItems || [], item.estimateDiscount || 0);
      const estimateNumber = item.estimateNumber || `#${item.id}`;
      const total = totals.total.toFixed(2);
      const currency = item.currency || 'SEK';
      const contactId = item.contactId;
      const contactName = item.contactName;
      
      if (isMobileView) {
        return (
          <div>
            <div className="flex items-center gap-2">
              <span>{estimateNumber} • </span>
              <button
                onClick={() => handleEstimateContactClick(contactId)}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
              >
                @{contactName}
              </button>
            </div>
            <div className="text-sm font-normal text-gray-600 mt-1">{total} {currency}</div>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <span>{estimateNumber} • </span>
          <button
            onClick={() => handleEstimateContactClick(contactId)}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
          >
            @{contactName}
          </button>
          <span> • {total} {currency}</span>
        </div>
      );
    }

    // Non-view modes (create/edit)
    switch (mode) {
      case 'edit': return 'Edit Estimate';
      case 'create': return 'Create Estimate';
      default: return 'Estimate';
    }
  };

  const getPanelSubtitle = (mode: string, item: Estimate | null) => {
    // View mode with item
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

    // Non-view modes
    switch (mode) {
      case 'edit': return 'Update estimate information';
      case 'create': return 'Enter new estimate details';
      default: return '';
    }
  };

  const getDeleteMessage = (item: Estimate | null) => {
    if (!item) return 'Are you sure you want to delete this estimate?';
    
    const itemName = item.estimateNumber || 'this estimate';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const value: EstimateContextType = {
    // Panel State - STANDARDIZED
    isEstimatePanelOpen,
    currentEstimate,
    panelMode, // CHANGED: From estimatePanelMode to panelMode
    validationErrors,
    
    // Data State
    estimates,
    
    // Actions
    openEstimatePanel,
    openEstimateForEdit,
    openEstimateForView,
    closeEstimatePanel,
    saveEstimate,
    deleteEstimate,
    duplicateEstimate,
    clearValidationErrors,
    
    // NEW: Panel Title Functions
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return (
    <EstimateContext.Provider value={value}>
      <PublicRouteHandler>
        {children}
      </PublicRouteHandler>
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