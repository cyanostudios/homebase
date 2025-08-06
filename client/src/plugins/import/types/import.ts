// Import plugin types
export interface ImportOperation {
    id: string;
    type: 'csv_import' | 'preview' | 'validation';
    fileName: string;
    pluginType: 'contacts' | 'notes' | 'estimates';
    status: 'pending' | 'processing' | 'success' | 'error';
    totalRows?: number;
    validRows?: number;
    createdCount?: number;
    updatedCount?: number;
    errorCount?: number;
    errors?: ImportError[];
    createdAt: Date;
  }
  
  export interface ImportError {
    row?: number;
    field?: string;
    message: string;
    data?: any;
  }
  
  export interface ValidationError {
    field: string;
    message: string;
    type?: 'error' | 'warning';
  }
  
  export interface ImportPreview {
    preview: any[];
    totalRows: number;
    validation: {
      isValid: boolean;
      errors: string[];
      validRowCount: number;
    };
    headers: string[];
    pluginType: string;
  }
  
  export interface ImportTemplate {
    name: string;
    description: string;
    requiredFields: string[];
    optionalFields: string[];
    sampleData: Record<string, any>[];
  }
  
  export interface ImportState {
    // Panel state
    isImportPanelOpen: boolean;
    currentImport: ImportOperation | null;
    panelMode: 'select' | 'preview' | 'import' | 'results';
    
    // Data state
    selectedFile: File | null;
    selectedPluginType: 'contacts' | 'notes' | 'estimates';
    importPreview: ImportPreview | null;
    importHistory: ImportOperation[];
    availableTemplates: Record<string, ImportTemplate>;
    
    // UI state
    isProcessing: boolean;
    validationErrors: ValidationError[];
  }