import React from 'react';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { useImport } from '../hooks/useImport';

interface ImportViewProps {
  item?: any;
  import?: any; // Plugin-specific prop
}

export function ImportView({ 
  item,    
  import: importProp 
}: ImportViewProps) {
  const { currentImport } = useImport(); // Get directly from context
  const actualImport = importProp || item || currentImport; // Try all sources
  
  console.log('ImportView rendering with:', { item, importProp, currentImport, actualImport });
  
  if (!actualImport) {
    console.log('ImportView: No import data, returning null');
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      default:
        return <FileText className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'pending':
      case 'processing':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <div className={`rounded-lg p-4 border ${getStatusColor(actualImport.status)}`}>
          <div className="flex items-center gap-3">
            {getStatusIcon(actualImport.status)}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {actualImport.status === 'success' ? 'Import Successful' : 
                 actualImport.status === 'error' ? 'Import Failed' : 
                 'Import In Progress'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {actualImport.fileName} • {actualImport.pluginType}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Import Results */}
      {actualImport.status === 'success' && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
            Import Results
          </Heading>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {actualImport.totalRows || 0}
              </div>
              <div className="text-xs text-blue-600 font-medium">Total Rows</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {actualImport.createdCount || 0}
              </div>
              <div className="text-xs text-green-600 font-medium">Created</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {actualImport.updatedCount || 0}
              </div>
              <div className="text-xs text-yellow-600 font-medium">Updated</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {actualImport.errorCount || 0}
              </div>
              <div className="text-xs text-red-600 font-medium">Errors</div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Details */}
      {actualImport.errors && actualImport.errors.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
            Error Details
          </Heading>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="max-h-64 overflow-y-auto">
              <ul className="space-y-2">
                {actualImport.errors.slice(0, 20).map((error: any, index: number) => (
                  <li key={index} className="text-sm text-red-700">
                    <span className="font-medium">Row {error.row || 'N/A'}:</span> {error.message}
                    {error.data && (
                      <div className="text-xs text-red-600 mt-1 pl-4">
                        Data: {JSON.stringify(error.data).substring(0, 100)}...
                      </div>
                    )}
                  </li>
                ))}
                {actualImport.errors.length > 20 && (
                  <li className="text-sm text-red-600 font-medium">
                    ... and {actualImport.errors.length - 20} more errors
                  </li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <hr className="border-gray-100" />

      {/* Import Details */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
          Import Information
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">File Name</div>
            <div className="text-sm text-gray-900">{actualImport.fileName}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Plugin Type</div>
            <div className="text-sm text-gray-900 capitalize">{actualImport.pluginType}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Import Type</div>
            <div className="text-sm text-gray-900">{actualImport.type}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Status</div>
            <div className="text-sm text-gray-900 capitalize">{actualImport.status}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created At</div>
            <div className="text-sm text-gray-900">
              {new Date(actualImport.createdAt).toLocaleString()}
            </div>
          </div>
          {actualImport.validRows && (
            <div>
              <div className="text-xs text-gray-500">Valid Rows</div>
              <div className="text-sm text-gray-900">
                {actualImport.validRows} of {actualImport.totalRows}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}