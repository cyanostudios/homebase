import React, { useState, useEffect } from 'react';
import { Plus, Upload, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useImport } from '../hooks/useImport';
import { Heading, Text } from '@/core/ui/Typography';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';

export const ImportList: React.FC = () => {
  const { 
    importHistory, 
    openImportPanel, 
    openImportForView 
  } = useImport();
  
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isMobileView) {
    // Mobile card layout
    return (
      <div className="p-4">
        {/* Header */}
        <div className="mb-6">
          <Heading level={1}>Import</Heading>
          <Text variant="caption">Import data from CSV files</Text>
        </div>

        {/* Add Import */}
        <div className="mb-6">
          <Button
            onClick={() => openImportPanel(null)}
            variant="primary"
            icon={Plus}
            className="w-full"
          >
            New Import
          </Button>
        </div>

        {/* Import History */}
        <div className="space-y-3">
          {importHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No imports yet. Click "New Import" to get started.
            </div>
          ) : (
            importHistory.map((importOp) => (
              <div
                key={importOp.id}
                className="bg-white p-4 rounded-lg border hover:bg-gray-50 cursor-pointer"
                onClick={() => openImportForView(importOp)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(importOp.status)}
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {importOp.fileName}
                      </h3>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-600">
                        Plugin: {importOp.pluginType}
                      </div>
                      <div className="text-xs text-gray-600">
                        {importOp.totalRows} rows • {importOp.createdCount || 0} created • {importOp.updatedCount || 0} updated
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(importOp.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(importOp.status)}`}>
                        {importOp.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Import</Heading>
          <Text variant="caption">Import data from CSV files</Text>
        </div>
        <Button
          onClick={() => openImportPanel(null)}
          variant="primary"
          icon={Plus}
        >
          New Import
        </Button>
      </div>

      {/* Table */}
      <Card>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plugin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Results
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {importHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No imports yet. Click "New Import" to get started.
                </td>
              </tr>
            ) : (
              importHistory.map((importOp, idx) => (
                <tr 
                  key={importOp.id} 
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                  tabIndex={0}
                  data-list-item={JSON.stringify(importOp)}
                  data-plugin-name="imports"
                  role="button"
                  aria-label={`Open import ${importOp.fileName}`}
                  onClick={() => openImportForView(importOp)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(importOp.status)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(importOp.status)}`}>
                        {importOp.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{importOp.fileName}</div>
                    <div className="text-xs text-gray-500">{importOp.type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 capitalize">{importOp.pluginType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {importOp.totalRows} rows
                    </div>
                    <div className="text-xs text-gray-500">
                      {importOp.createdCount || 0} created, {importOp.updatedCount || 0} updated
                      {importOp.errorCount && importOp.errorCount > 0 && (
                        <span className="text-red-600"> • {importOp.errorCount} errors</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(importOp.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};