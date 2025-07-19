import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Search, Calculator } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

export function EstimateList() {
  const { 
    estimates,
    openEstimatePanel,
    openEstimateForEdit,
    openEstimateForView,
    deleteEstimate 
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'estimateNumber' | 'contactName' | 'total' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [estimateToDelete, setEstimateToDelete] = useState<any>(null);

  // Mobile-first responsive design
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter and sort estimates
  const filteredAndSortedEstimates = estimates
    .filter(estimate => 
      estimate.estimateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.notes.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];
      
      if (sortBy === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortBy === 'total') {
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

  const handleDeleteClick = (estimate: any) => {
    setEstimateToDelete(estimate);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (estimateToDelete) {
      await deleteEstimate(estimateToDelete.id);
      setShowDeleteConfirm(false);
      setEstimateToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEstimateToDelete(null);
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
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Mobile card view
  if (isMobile) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Estimates</h1>
          <Button
            onClick={() => openEstimatePanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add
          </Button>
        </div>

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

        <div className="space-y-3">
          {filteredAndSortedEstimates.map((estimate) => (
            <Card key={estimate.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">{estimate.estimateNumber}</h3>
                    {getStatusBadge(estimate.status)}
                  </div>
                  <p className="text-sm text-gray-600">{estimate.contactName}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Eye}
                    onClick={() => openEstimateForView(estimate)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    onClick={() => openEstimateForEdit(estimate)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDeleteClick(estimate)}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {estimate.total.toFixed(2)} {estimate.currency}
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Valid to: {new Date(estimate.validTo).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>

        {filteredAndSortedEstimates.length === 0 && (
          <div className="text-center py-12">
            <Calculator className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No estimates</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new estimate.</p>
            <div className="mt-6">
              <Button
                onClick={() => openEstimatePanel(null)}
                variant="primary"
                icon={Plus}
              >
                New Estimate
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Estimate"
          message={`Are you sure you want to delete estimate "${estimateToDelete?.estimateNumber}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          variant="danger"
        />
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Estimates</h1>
          <p className="text-gray-600">Manage your customer estimates</p>
        </div>
        <Button
          onClick={() => openEstimatePanel(null)}
          variant="primary"
          icon={Plus}
        >
          New Estimate
        </Button>
      </div>

      {/* Search and Sort Controls */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search estimates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-');
            setSortBy(field as 'estimateNumber' | 'contactName' | 'total' | 'createdAt');
            setSortOrder(order as 'asc' | 'desc');
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="createdAt-desc">Newest First</option>
          <option value="createdAt-asc">Oldest First</option>
          <option value="estimateNumber-asc">Number A-Z</option>
          <option value="estimateNumber-desc">Number Z-A</option>
          <option value="contactName-asc">Customer A-Z</option>
          <option value="contactName-desc">Customer Z-A</option>
          <option value="total-desc">Highest Amount</option>
          <option value="total-asc">Lowest Amount</option>
        </select>
      </div>

      {/* Estimates Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estimate #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
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
              {filteredAndSortedEstimates.map((estimate) => (
                <tr key={estimate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{estimate.estimateNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{estimate.contactName}</div>
                      {estimate.organizationNumber && (
                        <div className="text-sm text-gray-500">{estimate.organizationNumber}</div>
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
                    <div className="text-sm text-gray-500">
                      VAT: {estimate.totalVat.toFixed(2)} {estimate.currency}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(estimate.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(estimate.validTo).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
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
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteClick(estimate)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedEstimates.length === 0 && (
          <div className="text-center py-12">
            <Calculator className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No estimates found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new estimate.'}
            </p>
          </div>
        )}
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Estimate"
        message={`Are you sure you want to delete estimate "${estimateToDelete?.estimateNumber}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
}