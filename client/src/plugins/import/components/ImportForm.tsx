import React, { useState, useRef, useEffect } from 'react';
import { useImport } from '../hooks/useImport';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';

interface ImportFormProps {
  currentImport?: any;
  currentItem?: any;
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export function ImportForm({ onSave, onCancel }: ImportFormProps) {
  const {
    panelMode,
    selectedPluginType,
    validationErrors,
    selectPluginType,
    clearValidationErrors,
    saveImport  // Add direct access to context function
  } = useImport();

  const [textData, setTextData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle global form events
  useEffect(() => {
    const handleSubmit = async () => {
      if (textData.trim()) {
        console.log('Submitting text data:', textData);
        console.log('About to call saveImport directly...');
        setIsProcessing(true);
        const success = await saveImport({ textData, pluginType: selectedPluginType });
        console.log('saveImport returned:', success);
        setIsProcessing(false);
        return success;
      }
      console.log('No text data to submit');
      return false;
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
  }, [textData, selectedPluginType, onSave, onCancel]);

  const exampleData = {
    contacts: `companyName,contactType,email,phone,organizationNumber
Test Company AB,company,test@company.se,08-123456,556123-4567
John Doe,private,john@example.com,070-1234567,`
  };

  return (
    <div className="space-y-6">
      {/* Show validation errors */}
      {validationErrors.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
            <ul className="mt-2 text-sm text-red-700">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error.message}</li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800">Processing import...</div>
          </div>
        </Card>
      )}

      {/* Plugin Type Selection */}
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

      {/* Text Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Import Data (CSV Format)
        </label>
        <textarea
          value={textData}
          onChange={(e) => {
            setTextData(e.target.value);
            clearValidationErrors();
          }}
          rows={10}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          placeholder={exampleData[selectedPluginType] || 'Enter CSV data here...'}
        />
        <div className="text-xs text-gray-500 mt-1">
          Enter data in CSV format with headers in the first row.
        </div>
      </div>

      {/* Example */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
          Example Format for {selectedPluginType}
        </Heading>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {exampleData[selectedPluginType] || 'No example available'}
          </pre>
        </div>
      </Card>
    </div>
  );
}