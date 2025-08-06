import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ImportOperation, ImportPreview, ImportTemplate, ValidationError } from '../types/import';
import { importApi } from '../api/importApi';
import { useApp } from '@/core/api/AppContext';

interface ImportContextType {
  // Panel State - Following exact ContactContext pattern
  isImportPanelOpen: boolean;
  currentImport: ImportOperation | null;
  panelMode: 'select' | 'preview' | 'import' | 'results';
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
  openImportForPreview: (file: File, pluginType: string) => void;
  openImportForResults: (operation: ImportOperation) => void;
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
  const [panelMode, setPanelMode] = useState<'select' | 'preview' | 'import' | 'results'>('select');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Data states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPluginType, setSelectedPluginType] = useState<'contacts' | 'notes' | 'estimates'>('contacts');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importHistory, setImportHistory] = useState<ImportOperation[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<Record<string, ImportTemplate>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Load templates when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadTemplates();
    } else {
      setAvailableTemplates({});
      setImportHistory([]);
    }
  }, [isAuthenticated]);

  // Register/unregister panel close function - Following ContactContext pattern
  useEffect(() => {
    registerPanelCloseFunction('import', closeImportPanel);
    return () => unregisterPanelCloseFunction('import');
  }, []);

  // Global form functions - Following ContactContext pattern (plural naming)
  useEffect(() => {
    window.submitImportForm = () => {
      const event = new CustomEvent('submitImportForm');
      window.dispatchEvent(event);
    };
    window.cancelImportForm = () => {
      const event = new CustomEvent('cancelImportForm');
      window.dispatchEvent(event);
    };
    return () => {
      delete window.submitImportForm;
      delete window.cancelImportForm;
    };
  }, []);

  // Load available templates
  const loadTemplates = async () => {
    try {
      const templates = await importApi.getTemplates();
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Error loading import templates:', error);
    }
  };

  // Panel actions - Following ContactContext pattern exactly
  const openImportPanel = (operation: ImportOperation | null) => {
    setCurrentImport(operation);
    setPanelMode(operation ? 'results' : 'select');
    setIsImportPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openImportForPreview = (file: File, pluginType: string) => {
    setSelectedFile(file);
    setSelectedPluginType(pluginType as 'contacts' | 'notes' | 'estimates');
    setCurrentImport(null);
    setPanelMode('preview');
    setIsImportPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openImportForResults = (operation: ImportOperation) => {
    setCurrentImport(operation);
    setPanelMode('results');
    setIsImportPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeImportPanel = () => {
    setIsImportPanelOpen(false);
    setCurrentImport(null);
    setPanelMode('select');
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
      setPanelMode('preview');
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
      setPanelMode('results');
      
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
    // This would be used for saving import configurations/templates
    return true;
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
    openImportForPreview,
    openImportForResults,
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

export function useImport() {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error('useImport must be used within ImportProvider');
  }
  return context;
}