import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Search, Calculator, ChevronUp, ChevronDown } from 'lucide-react';
import { useEstimates } from '../hooks/useEstimates';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

type SortField = 'estimateNumber' | 'contactName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function EstimateList() {
  const { 
    estimates,
    openEstimatePanel,
    openEstimateForEdit,
    openEstimateForView,
    deleteEstimate 
  } = useEstimates();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    estimateId: string;
    estimateNumber: string;
  }>({
    isOpen: false,
    estimateId: '',
    estimateNumber: ''
  });
  const [isMobileView, setIsMobileView] = useState(false);

  // Check screen size for responsive view
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768); // md breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter and sort estimates
  const sortedEstimates = useMemo(() => {
    const filtered = estimates.filter(estimate => 
      estimate.estimateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.notes.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      if (sortField === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortField === 'total') {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }
      
      if (typeof aValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [estimates, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const handleDelete = (id: string, estimateNumber: string) => {
    setDeleteConfirm({
      isOpen: true,
      estimateId: id,
      estimateNumber: estimateNumber
    });
  };

  const confirmDelete = () => {
    deleteEstimate(deleteConfirm.estimateId);
    setDeleteConfirm({
      isOpen: false,
      estimateId: '',
      estimateNumber: ''
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      estimateId: '',
      estimateNumber: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Estimates</Heading>
          <Text variant="caption">Manage your customer estimates</Text>
        </div>
        <div className="flex sm:block">
          <Button
            onClick={() => openEstimatePanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add Estimate
          </Button>
        </div>
      </div>

      {/* Search Controls */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search estimates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('estimateNumber')}
                >
                  <div className="flex items-center gap-1">
                    Estimate #
                    <SortIcon field="estimateNumber" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('contactName')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    <SortIcon field="contactName" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center gap-1">
                    Total
                    <SortIcon field="total" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valid To
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedEstimates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm ? 'No estimates found matching your search.' : 'No estimates yet. Click "Add Estimate" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedEstimates.map((estimate, idx) => (
                  <tr key={estimate.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-500" />
                        <div className="text-sm font-medium text-gray-900">{estimate.estimateNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{estimate.contactName}</div>
                        {estimate.organizationNumber && (
                          <div className="text-xs text-gray-500">{estimate.organizationNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {estimate.total.toFixed(2)} {estimate.currency}
                      </div>
                      <div className="text-xs text-gray-500">
                        VAT: {estimate.totalVat.toFixed(2)} {estimate.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(estimate.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(estimate.validTo).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => openEstimateForView(estimate)}
                        >
                          View
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit}
                          onClick={() => openEstimateForEdit(estimate)}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Mobile Card View */
          <div className="divide-y divide-gray-200">
            {sortedEstimates.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchTerm ? 'No estimates found matching your search.' : 'No estimates yet. Click "Add Estimate" to get started.'}
              </div>
            ) : (
              sortedEstimates.map((estimate) => (
                <div key={estimate.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <Calculator className="w-5 h-5 text-blue-500" />
                      <div className="text-xs text-gray-500">
                        {new Date(estimate.validTo).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900">{estimate.estimateNumber}</h3>
                        {getStatusBadge(estimate.status)}
                      </div>
                      
                      {/* Estimate details in mobile */}
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">{estimate.contactName}</div>
                        {estimate.organizationNumber && (
                          <div className="text-xs text-gray-500">{estimate.organizationNumber}</div>
                        )}
                        <div className="text-xs text-gray-600">
                          {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {estimate.total.toFixed(2)} {estimate.currency}
                        </div>
                      </div>
                    </div>
                    {/* View button in top right */}
                    <div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Eye}
                        onClick={() => openEstimateForView(estimate)}
                        className="h-8 px-3"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Estimate"
        message={`Are you sure you want to delete estimate "${deleteConfirm.estimateNumber}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
}