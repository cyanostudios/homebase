import React, { useState, useRef, useEffect } from 'react';
import { useImport } from '../hooks/useImport';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';

interface ImportPanelProps {
  currentItem?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function ImportPanel({ onSave, onCancel }: ImportPanelProps) {
  const {
    panelMode,
    selectedFile,
    selectedPluginType,
    importPreview,
    currentImport,
    availableTemplates,
    isProcessing,
    validationErrors,
    selectFile,
    selectPluginType,
    previewImport,
    executeImport,
    clearValidationErrors
  } = useImport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle global form events
  useEffect(() => {
    const handleSubmit = () => {
      if (panelMode === 'preview') {
        handleImport();
      } else if (panelMode === 'select' && selectedFile) {
        handlePreview();
      }
    };

    const handleCancel = () => {
      onCancel();
    };

    window.addEventListener('submitImportForm', handleSubmit);
    window.addEventListener('cancelImportForm', handleCancel);

    return () => {
      window.removeEventListener('submitImportForm', handleSubmit);
      window.removeEventListener('cancelImportForm', handleCancel);
    };
  }, [panelMode, selectedFile, onCancel]);

  // File selection handlers
  const handleFileSelect = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }
    selectFile(file);
    clearValidationErrors();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Preview and import handlers
  const handlePreview = async () => {
    await previewImport();
  };

  const handleImport = async () => {
    const success = await executeImport();
    if (success) {
      onSave({ success: true });
    }
  };

  // Render different modes
  const renderFileSelection = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plugin Type
          </label>
          <select
            value={selectedPluginType}
            onChange={(e) => selectPluginType(e.target.value as 'contacts' | 'notes' | 'estimates')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="contacts">Contacts</option>
            <option value="notes">Notes</option>
            <option value="estimates">Estimates</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CSV File
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">{selectedFile.name}</div>
                <div className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change File
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-gray-500">
                  Drop your CSV file here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    browse
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  Maximum file size: 10MB
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template info */}
      {availableTemplates[selectedPluginType] && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
            Expected Format
          </Heading>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Required:</span>{' '}
                {availableTemplates[selectedPluginType].requiredFields.join(', ')}
              </div>
              <div className="text-sm">
                <span className="font-medium">Optional:</span>{' '}
                {availableTemplates[selectedPluginType].optionalFields.join(', ')}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level={3} className="text-lg font-semibold text-gray-900">
            Import Preview
          </Heading>
          <p className="text-sm text-gray-500 mt-1">
            {selectedFile?.name} • {importPreview?.totalRows} rows • {selectedPluginType}
          </p>
        </div>
      </div>

      {importPreview && (
        <div className="space-y-4">
          {/* Validation summary */}
          <Card padding="sm" className="shadow-none px-0">
            <div className={`rounded-lg p-4 ${
              importPreview.validation.isValid
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <h4 className="text-sm font-medium">
                    {importPreview.validation.isValid ? 'Ready to Import' : 'Validation Warnings'}
                  </h4>
                  <div className="text-sm mt-1">
                    {importPreview.validation.validRowCount} of {importPreview.totalRows} rows valid
                  </div>
                </div>
              </div>
              {!importPreview.validation.isValid && importPreview.validation.errors.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-yellow-800 mb-1">Issues:</div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {importPreview.validation.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                    {importPreview.validation.errors.length > 5 && (
                      <li>• ... and {importPreview.validation.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          {/* Data preview */}
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={4} className="mb-3 text-sm font-semibold text-gray-900">
              Data Preview (first 5 rows)
            </Heading>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    {importPreview.headers.map((header, index) => (
                      <th key={index} className="text-left py-2 px-3 font-medium text-gray-900">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.preview.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-gray-200">
                      {importPreview.headers.map((header, colIndex) => (
                        <td key={colIndex} className="py-2 px-3 text-gray-700">
                          {row[header] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  const renderResults = () => (
    <div className="space-y-6">
      <div>
        <Heading level={3} className="text-lg font-semibold text-gray-900">
          Import Results
        </Heading>
        <p className="text-sm text-gray-500 mt-1">
          {currentImport?.fileName} • {currentImport?.pluginType}
        </p>
      </div>

      {currentImport && (
        <Card padding="sm" className="shadow-none px-0">
          <div className={`rounded-lg p-4 ${
            currentImport.status === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="space-y-3">
              <div className="flex items-center">
                <h4 className="text-sm font-medium">
                  {currentImport.status === 'success' ? 'Import Successful' : 'Import Failed'}
                </h4>
              </div>
              
              {currentImport.status === 'success' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Created</div>
                    <div>{currentImport.createdCount || 0}</div>
                  </div>
                  <div>
                    <div className="font-medium">Updated</div>
                    <div>{currentImport.updatedCount || 0}</div>
                  </div>
                  <div>
                    <div className="font-medium">Errors</div>
                    <div>{currentImport.errorCount || 0}</div>
                  </div>
                </div>
              )}

              {currentImport.errors && currentImport.errors.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Errors:</div>
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {currentImport.errors.slice(0, 10).map((error, index) => (
                      <li key={index}>• {error.message}</li>
                    ))}
                    {currentImport.errors.length > 10 && (
                      <li>• ... and {currentImport.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  // Show validation errors
  const hasErrors = validationErrors.length > 0;

  return (
    <div className="space-y-4">
      {hasErrors && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                <ul className="mt-2 text-sm text-red-700">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isProcessing && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-sm text-blue-800">
                {panelMode === 'select' ? 'Processing file...' : 'Importing data...'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {panelMode === 'select' && renderFileSelection()}
      {panelMode === 'preview' && renderPreview()}
      {panelMode === 'results' && renderResults()}
    </div>
  );
}