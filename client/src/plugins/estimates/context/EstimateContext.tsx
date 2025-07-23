import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Estimate, ValidationError } from '../types/estimate';
import { estimatesApi } from '../api/estimatesApi';

interface EstimateContextType {
  // Panel State - FIXED: Match App.tsx expectations
  isEstimatePanelOpen: boolean;
  currentEstimate: Estimate | null;
  estimatePanelMode: 'create' | 'edit' | 'view'; // FIXED: App.tsx expects estimatePanelMode, not panelMode
  validationErrors: ValidationError[];
  
  // Data State
  estimates: Estimate[];
  
  // Actions - FIXED: App.tsx expects these exact function names
  openEstimatePanel: (estimate: Estimate | null) => void;
  openEstimateForEdit: (estimate: Estimate) => void;
  openEstimateForView: (estimate: Estimate) => void;
  closeEstimatePanel: () => void;
  saveEstimate: (estimateData: any) => Promise<boolean>;
  deleteEstimate: (id: string) => Promise<void>;
  duplicateEstimate: (estimate: Estimate) => Promise<void>;
  clearValidationErrors: () => void;
}

const EstimateContext = createContext<EstimateContextType | undefined>(undefined);

interface EstimateProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function EstimateProvider({ children, isAuthenticated, onCloseOtherPanels }: EstimateProviderProps) {
  // Panel states - FIXED: Use estimatePanelMode to match App.tsx
  const [isEstimatePanelOpen, setIsEstimatePanelOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [estimatePanelMode, setEstimatePanelMode] = useState<'create' | 'edit' | 'view'>('create');
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

  const loadEstimates = async () => {
    try {
      const estimatesData = await estimatesApi.getEstimates();
      
      // Transform API data to match interface
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

  // Helper function to generate next estimate number
  const generateNextEstimateNumber = (): string => {
    const existingNumbers = estimates.map(estimate => {
      const match = estimate.estimateNumber.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return `EST-${nextNumber.toString().padStart(3, '0')}`;
  };

  const validateEstimate = (estimateData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!estimateData.contactId?.trim()) {
      errors.push({
        field: 'contactId',
        message: 'Customer is required'
      });
    }
    
    if (!estimateData.lineItems || estimateData.lineItems.length === 0) {
      errors.push({
        field: 'lineItems',
        message: 'At least one line item is required'
      });
    } else {
      // Validate each line item
      estimateData.lineItems.forEach((item: any, index: number) => {
        if (!item.description?.trim()) {
          errors.push({
            field: `lineItems.${index}.description`,
            message: `Line item ${index + 1}: Description is required`
          });
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push({
            field: `lineItems.${index}.quantity`,
            message: `Line item ${index + 1}: Quantity must be greater than 0`
          });
        }
        if (item.unitPrice === undefined || item.unitPrice < 0) {
          errors.push({
            field: `lineItems.${index}.unitPrice`,
            message: `Line item ${index + 1}: Unit price must be 0 or greater`
          });
        }
      });
    }
    
    if (!estimateData.validTo) {
      errors.push({
        field: 'validTo',
        message: 'Valid to date is required'
      });
    }
    
    return errors;
  };

  // Estimate functions
  const openEstimatePanel = (estimate: Estimate | null) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode(estimate ? 'edit' : 'create');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels(); // Close other plugin panels
  };

  const openEstimateForEdit = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode('edit');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openEstimateForView = (estimate: Estimate) => {
    setCurrentEstimate(estimate);
    setEstimatePanelMode('view');
    setIsEstimatePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeEstimatePanel = () => {
    setIsEstimatePanelOpen(false);
    setCurrentEstimate(null);
    setEstimatePanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveEstimate = async (estimateData: any): Promise<boolean> => {
    console.log('Validating estimate data:', estimateData);
    
    // Run validation
    const errors = validateEstimate(estimateData);
    setValidationErrors(errors);
    
    // If there are blocking errors, don't save
    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }
    
    try {
      let savedEstimate: Estimate;
      
      if (currentEstimate) {
        // Update existing estimate
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
        setEstimatePanelMode('view');
        setValidationErrors([]);
      } else {
        // Create new estimate
        savedEstimate = await estimatesApi.createEstimate(estimateData);
        setEstimates(prev => [...prev, {
          ...savedEstimate,
          validTo: new Date(savedEstimate.validTo),
          createdAt: new Date(savedEstimate.createdAt),
          updatedAt: new Date(savedEstimate.updatedAt),
        }]);
        closeEstimatePanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save estimate:', error);
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
      const duplicateData = {
        ...originalEstimate,
        estimateNumber: generateNextEstimateNumber(),
        status: 'draft' as const,
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        lineItems: originalEstimate.lineItems.map(item => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`, // New unique ID for each line item
        })),
      };
      
      // Remove fields that should not be duplicated
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

  const value: EstimateContextType = {
    // Panel State - FIXED: Match App.tsx expectations
    isEstimatePanelOpen,
    currentEstimate,
    estimatePanelMode, // FIXED: Changed from panelMode
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
  };

  return (
    <EstimateContext.Provider value={value}>
      {children}
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