import { Plus, Search, Calculator } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { GroupedList } from '@/core/ui/GroupedList';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useEstimates } from '../hooks/useEstimates';
import { calculateEstimateTotals } from '../types/estimate';

type SortField = 'estimateNumber' | 'contactName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function EstimateList() {
  const { estimates, openEstimatePanel, openEstimateForView, deleteEstimate } = useEstimates();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField] = useState<SortField>('createdAt');
  const [sortOrder] = useState<SortOrder>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    estimateId: string;
    estimateNumber: string;
  }>({
    isOpen: false,
    estimateId: '',
    estimateNumber: '',
  });

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

  const _handleDelete = (id: string, estimateNumber: string) => {
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
        <GroupedList
          items={sortedEstimates}
          groupConfig={null}
          emptyMessage={
            searchTerm
              ? 'No estimates found matching your search.'
              : 'No estimates yet. Click "Add Estimate" to get started.'
          }
          renderItem={(estimate, idx) => (
            <div
              key={estimate.id}
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
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
              {/* Rad 1: Icon + Estimate Number + Status Badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <Calculator className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                  {estimate.estimateNumber}
                </div>
                <div className="flex-shrink-0">{getStatusBadge(estimate.status)}</div>
              </div>

              {/* Rad 2: Contact + Total + Valid To */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 min-w-0 truncate">
                  {estimate.contactName}
                  {estimate.organizationNumber && (
                    <span className="ml-1">• {estimate.organizationNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium text-foreground">
                    {calculateEstimateTotals(
                      estimate.lineItems || [],
                      estimate.estimateDiscount || 0,
                    ).total.toFixed(2)}{' '}
                    {estimate.currency}
                  </span>
                  <span>• Valid to {new Date(estimate.validTo).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Rad 3: Items + VAT (optional) */}
              <div className="mt-1 text-xs text-muted-foreground">
                {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                {calculateEstimateTotals(estimate.lineItems || [], estimate.estimateDiscount || 0)
                  .totalVat > 0 && (
                  <span>
                    {' '}
                    • VAT:{' '}
                    {calculateEstimateTotals(
                      estimate.lineItems || [],
                      estimate.estimateDiscount || 0,
                    ).totalVat.toFixed(2)}{' '}
                    {estimate.currency}
                  </span>
                )}
              </div>
            </div>
          )}
        />
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
