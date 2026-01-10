import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Calculator,
  ChevronUp,
  ChevronDown,
  Copy,
} from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useEstimates } from '../hooks/useEstimates';
import { calculateEstimateTotals } from '../types/estimate';

type SortField = 'estimateNumber' | 'contactName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function EstimateList() {
  const {
    estimates,
    openEstimatePanel,
    openEstimateForEdit,
    openEstimateForView,
    deleteEstimate,
    duplicateEstimate,
  } = useEstimates();
  const { attemptNavigation } = useGlobalNavigationGuard();

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
    estimateNumber: '',
  });
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768);
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

  const sortedEstimates = useMemo(() => {
    const filtered = estimates.filter(
      (estimate) =>
        estimate.estimateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        estimate.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        estimate.notes.toLowerCase().includes(searchTerm.toLowerCase()),
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
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [estimates, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return null;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const handleDelete = (id: string, estimateNumber: string) => {
    setDeleteConfirm({
      isOpen: true,
      estimateId: id,
      estimateNumber: estimateNumber,
    });
  };

  const confirmDelete = () => {
    deleteEstimate(deleteConfirm.estimateId);
    setDeleteConfirm({
      isOpen: false,
      estimateId: '',
      estimateNumber: '',
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      estimateId: '',
      estimateNumber: '',
    });
  };

  const handleDuplicate = async (e: React.MouseEvent, estimate: any) => {
    e.stopPropagation();
    try {
      await duplicateEstimate(estimate);
    } catch (error) {
      console.error('Failed to duplicate estimate:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      sent: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
      accepted: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
      rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
    };

    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;

    return <Badge className={colorClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  // Protected navigation handlers
  const handleOpenForView = (estimate: any) => {
    attemptNavigation(() => {
      openEstimateForView(estimate);
    });
  };

  const handleOpenForEdit = (estimate: any) => {
    attemptNavigation(() => {
      openEstimateForEdit(estimate);
    });
  };

  const handleOpenPanel = () => {
    attemptNavigation(() => {
      openEstimatePanel(null);
    });
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>
            Estimates ({searchTerm ? sortedEstimates.length : estimates.length}
            {searchTerm && sortedEstimates.length !== estimates.length && ` of ${estimates.length}`}
            )
          </Heading>
          <Text variant="caption">Manage your customer estimates</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
            <Input
              type="text"
              placeholder="Search estimates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10"
            />
          </div>
          <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>
            Add Estimate
          </Button>
        </div>
      </div>

      <Card>
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent select-none"
                  onClick={() => handleSort('estimateNumber')}
                >
                  <div className="flex items-center gap-1">
                    Estimate #
                    <SortIcon field="estimateNumber" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent select-none"
                  onClick={() => handleSort('contactName')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    <SortIcon field="contactName" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Items
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-accent select-none"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center gap-1">
                    Total
                    <SortIcon field="total" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Valid To
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedEstimates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    {searchTerm
                      ? 'No estimates found matching your search.'
                      : 'No estimates yet. Click "Add Estimate" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedEstimates.map((estimate, idx) => (
                  <tr
                    key={estimate.id}
                    className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors`}
                    tabIndex={0}
                    data-list-item={JSON.stringify(estimate)}
                    data-plugin-name="estimates"
                    role="button"
                    aria-label={`Open estimate ${estimate.estimateNumber}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenForView(estimate);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        <div className="text-sm font-medium text-foreground">
                          {estimate.estimateNumber}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {estimate.contactName}
                        </div>
                        {estimate.organizationNumber && (
                          <div className="text-xs text-muted-foreground">{estimate.organizationNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {calculateEstimateTotals(
                          estimate.lineItems || [],
                          estimate.estimateDiscount || 0,
                        ).total.toFixed(2)}{' '}
                        {estimate.currency}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        VAT:{' '}
                        {calculateEstimateTotals(
                          estimate.lineItems || [],
                          estimate.estimateDiscount || 0,
                        ).totalVat.toFixed(2)}{' '}
                        {estimate.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(estimate.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(estimate.validTo).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForView(estimate);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          onClick={(e) => handleDuplicate(e, estimate)}
                          title="Duplicate estimate"
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForEdit(estimate);
                          }}
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
          <div className="divide-y divide-border">
            {sortedEstimates.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm
                  ? 'No estimates found matching your search.'
                  : 'No estimates yet. Click "Add Estimate" to get started.'}
              </div>
            ) : (
              sortedEstimates.map((estimate) => (
                <div key={estimate.id} className="p-4 hover:bg-accent transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <Calculator className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      <div className="text-xs text-muted-foreground">
                        {new Date(estimate.validTo).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">
                          {estimate.estimateNumber}
                        </h3>
                        {getStatusBadge(estimate.status)}
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">{estimate.contactName}</div>
                        {estimate.organizationNumber && (
                          <div className="text-xs text-muted-foreground">{estimate.organizationNumber}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {estimate.lineItems.length} item
                          {estimate.lineItems.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {calculateEstimateTotals(
                            estimate.lineItems || [],
                            estimate.estimateDiscount || 0,
                          ).total.toFixed(2)}{' '}
                          {estimate.currency}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => handleOpenForView(estimate)}
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
