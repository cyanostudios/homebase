import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ImportOperation, ImportPreview, ImportTemplate, ValidationError } from '../types/import';
import { importApi } from '../api/importApi';
import { useApp } from '@/core/api/AppContext';

interface ImportContextType {
  // Panel State - Following exact ContactContext pattern
  isImportPanelOpen: boolean;
  currentImport: ImportOperation | null;
  panelMode: 'create' | 'edit' | 'view'; // Generic panelMode
  validationErrors: ValidationError[];
  
  // Data State
  selectedFile: File | null;
  selectedPluginType: 'contacts' | 'notes' | 'estimates';
  importPreview: ImportPreview | null;
  importHistory: ImportOperation[];
  availableTemplates: Record<string, ImportTemplate>;
  isProcessing: boolean;
  
  // Actions - Following exact ContactContext naming pattern
  openImportPanel: (operation: ImportOperation | null) => void;
  openImportForEdit: (operation: ImportOperation) => void;
  openImportForView: (operation: ImportOperation) => void;
  closeImportPanel: () => void;
  saveImport: (data: any) => Promise<boolean>;
  deleteImport: (id: string) => Promise<void>;
  clearValidationErrors: () => void;
  
  // Import-specific actions
  selectFile: (file: File) => void;
  selectPluginType: (type: 'contacts' | 'notes' | 'estimates') => void;
  previewImport: () => Promise<void>;
  executeImport: (skipValidation?: boolean) => Promise<boolean>;
}

const ImportContext = createContext<ImportContextType | undefined>(undefined);

interface ImportProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ImportProvider({ children, isAuthenticated, onCloseOtherPanels }: ImportProviderProps) {
  // Get panel registration functions from AppContext
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  
  // Panel states - Following ContactContext pattern exactly
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [currentImport, setCurrentImport] = useState<ImportOperation | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create'); // Generic panelMode
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Data states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPluginType, setSelectedPluginType] = useState<'contacts' | 'notes' | 'estimates'>('contacts');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importHistory, setImportHistory] = useState<ImportOperation[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<Record<string, ImportTemplate>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Register/unregister panel close function - Following ContactContext pattern
  useEffect(() => {
    registerPanelCloseFunction('import', closeImportPanel); // Match plugin name
    return () => unregisterPanelCloseFunction('import');
  }, []);

  // Global form functions - Following ContactContext pattern (plural naming)
  useEffect(() => {
    window.submitImportsForm = () => {
      const event = new CustomEvent('submitImportForm');
      window.dispatchEvent(event);
    };
    window.cancelImportsForm = () => {
      const event = new CustomEvent('cancelImportForm');
      window.dispatchEvent(event);
    };
    return () => {
      delete window.submitImportsForm;
      delete window.cancelImportsForm;
    };
  }, []);

  // Load templates when needed (lazy loading)
  const loadTemplates = async () => {
    if (!isAuthenticated) return;
    
    try {
      const templates = await importApi.getTemplates();
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Error loading import templates:', error);
      // Don't show error to user - templates are not critical for basic functionality
      setAvailableTemplates({});
    }
  };

  // Panel actions - Following ContactContext pattern exactly
  const openImportPanel = (operation: ImportOperation | null) => {
    setCurrentImport(operation);
    setPanelMode(operation ? 'view' : 'create'); // View results or create new import
    setIsImportPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    
    // Load templates when panel opens (lazy loading)
    if (isAuthenticated && Object.keys(availableTemplates).length === 0) {
      loadTemplates();
    }
  };

  const openImportForEdit = (operation: ImportOperation) => {
    setCurrentImport(operation);
    setPanelMode('edit'); // Preview/configure import
    setIsImportPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openImportForView = (operation: ImportOperation) => {
    setCurrentImport(operation);
    setPanelMode('view'); // View import results
    setIsImportPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeImportPanel = () => {
    setIsImportPanelOpen(false);
    setCurrentImport(null);
    setPanelMode('create');
    setSelectedFile(null);
    setImportPreview(null);
    setValidationErrors([]);
    setIsProcessing(false);
  };

  // Import-specific actions
  const selectFile = (file: File) => {
    setSelectedFile(file);
  };

  const selectPluginType = (type: 'contacts' | 'notes' | 'estimates') => {
    setSelectedPluginType(type);
  };

  const previewImport = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    setValidationErrors([]);
    
    try {
      const preview = await importApi.previewCsv(selectedFile, selectedPluginType);
      setImportPreview(preview);
      setPanelMode('edit'); // Switch to preview/edit mode
    } catch (error: any) {
      setValidationErrors([{
        field: 'file',
        message: error.message || 'Failed to preview file'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeImport = async (skipValidation: boolean = false): Promise<boolean> => {
    if (!selectedFile) return false;
    
    setIsProcessing(true);
    setValidationErrors([]);
    
    try {
      const result = await importApi.importCsv(selectedFile, selectedPluginType, skipValidation);
      
      // Create import operation record
      const importOperation: ImportOperation = {
        id: Date.now().toString(),
        type: 'csv_import',
        fileName: selectedFile.name,
        pluginType: selectedPluginType,
        status: result.success ? 'success' : 'error',
        totalRows: result.totalProcessed || 0,
        validRows: result.totalProcessed || 0,
        createdCount: result.created || 0,
        updatedCount: result.updated || 0,
        errorCount: result.errors?.length || 0,
        errors: result.errors || [],
        createdAt: new Date()
      };
      
      setCurrentImport(importOperation);
      setImportHistory(prev => [importOperation, ...prev]);
      setPanelMode('view'); // Switch to results view
      
      return true;
    } catch (error: any) {
      setValidationErrors([{
        field: 'import',
        message: error.message || 'Import failed'
      }]);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Following ContactContext pattern for consistency
  const saveImport = async (data: any): Promise<boolean> => {
    console.log('saveImport called with data:', data);
    
    if (data.textData) {
      console.log('Processing text import:', data);
      
      try {
        // Parse CSV text data
        const lines = data.textData.trim().split('\n');
        console.log('Parsed lines:', lines);
        
        if (lines.length < 2) {
          console.log('Not enough lines:', lines.length);
          setValidationErrors([{ field: 'textData', message: 'Need at least header row and one data row' }]);
          return false;
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        
        console.log('Parsed data:', { headers, rows });
        
        // Simple validation for contacts
        if (data.pluginType === 'contacts') {
          const required = ['companyName', 'contactType', 'email'];
          const missingFields = required.filter(field => !headers.includes(field));
          
          if (missingFields.length > 0) {
            setValidationErrors([{ 
              field: 'textData', 
              message: `Missing required fields: ${missingFields.join(', ')}` 
            }]);
            return false;
          }
          
          // FIXED: Actually call the backend to import contacts
          console.log('Importing contacts to backend...');
          try {
            const results = await importContacts(rows);
            console.log('Backend import results:', results);
            
            // Create import operation with real results
            const importOperation: ImportOperation = {
              id: Date.now().toString(),
              type: 'csv_import',
              fileName: 'text-import.csv',
              pluginType: data.pluginType,
              status: 'success',
              totalRows: rows.length,
              validRows: rows.length,
              createdCount: results.created || 0,
              updatedCount: results.updated || 0,
              errorCount: results.errors?.length || 0,
              errors: results.errors || [],
              createdAt: new Date()
            };
            
            setCurrentImport(importOperation);
            setImportHistory(prev => [importOperation, ...prev]);
            setPanelMode('view');
            
            console.log('Import successful:', importOperation);
            console.log('Panel mode set to:', 'view');
            console.log('Current import set to:', importOperation);
            return true;
            
          } catch (error: any) {
            console.error('Backend import failed:', error);
            setValidationErrors([{ field: 'textData', message: 'Failed to import to backend' }]);
            return false;
          }
        }
        
      } catch (error: any) {
        console.error('Import error:', error);
        setValidationErrors([{ field: 'textData', message: 'Failed to parse CSV data' }]);
        return false;
      }
    } else {
      console.log('No textData in data object:', data);
    }
    
    return false;
  };

  // Helper function to import contacts to backend
  const importContacts = async (contactsData: any[]) => {
    // For now, create contacts one by one using the contacts API
    let created = 0;
    let updated = 0;
    let errors = [];
    
    for (const contactData of contactsData) {
      try {
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            contactNumber: Date.now().toString(), // Generate unique contact number
            contactType: contactData.contactType,
            companyName: contactData.companyName,
            email: contactData.email,
            phone: contactData.phone || '',
            organizationNumber: contactData.organizationNumber || '',
            personalNumber: contactData.personalNumber || '',
            website: contactData.website || '',
            notes: contactData.notes || '',
            // Add default values
            companyType: '',
            vatNumber: '',
            taxRate: '25',
            paymentTerms: '30', 
            currency: 'SEK',
            fTax: 'no',
            contactPersons: [],
            addresses: []
          })
        });
        
        if (response.ok) {
          created++;
          console.log('Created contact:', contactData.companyName);
        } else {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          errors.push({ data: contactData, error: error.error });
        }
      } catch (error: any) {
        errors.push({ data: contactData, error: error.message });
      }
    }
    
    return { created, updated, errors };
  };

  const deleteImport = async (id: string): Promise<void> => {
    setImportHistory(prev => prev.filter(imp => imp.id !== id));
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const contextValue: ImportContextType = {
    // Panel state
    isImportPanelOpen,
    currentImport,
    panelMode,
    validationErrors,
    
    // Data state
    selectedFile,
    selectedPluginType,
    importPreview,
    importHistory,
    availableTemplates,
    isProcessing,
    
    // Actions
    openImportPanel,
    openImportForEdit,
    openImportForView,
    closeImportPanel,
    saveImport,
    deleteImport,
    clearValidationErrors,
    
    // Import-specific actions
    selectFile,
    selectPluginType,
    previewImport,
    executeImport
  };

  return (
    <ImportContext.Provider value={contextValue}>
      {children}
    </ImportContext.Provider>
  );
}

export function useImportContext() {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error('useImportContext must be used within an ImportProvider');
  }
  return context;
}