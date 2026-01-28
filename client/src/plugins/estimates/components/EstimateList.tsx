import { Calculator, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useEstimates } from '../hooks/useEstimates';
import { calculateEstimateTotals } from '../types/estimate';

type SortField = 'estimateNumber' | 'contactName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function EstimateList() {
  const {
    estimates,
    openEstimateForView,
    deleteEstimate,
    deleteEstimates,
    selectedEstimateIds,
    toggleEstimateSelected,
    selectAllEstimates,
    clearEstimateSelection,
    selectedCount,
    isSelected,
  } = useEstimates();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    estimateId: string;
    estimateNumber: string;
  }>({
    isOpen: false,
    estimateId: '',
    estimateNumber: '',
  });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Visible estimate IDs for selection
  const visibleEstimateIds = useMemo(
    () => sortedEstimates.map((estimate) => String(estimate.id)),
    [sortedEstimates],
  );

  // Selection helpers
  const allVisibleSelected = useMemo(
    () => visibleEstimateIds.length > 0 && visibleEstimateIds.every((id) => isSelected(id)),
    [visibleEstimateIds, isSelected],
  );

  const someVisibleSelected = useMemo(
    () => visibleEstimateIds.some((id) => isSelected(id)),
    [visibleEstimateIds, isSelected],
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearEstimateSelection();
    } else {
      selectAllEstimates(visibleEstimateIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEstimateIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteEstimates(selectedEstimateIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Protected navigation handlers
  const handleOpenForView = (estimate: any) => {
    attemptNavigation(() => {
      openEstimateForView(estimate);
    });
  };

  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search estimates..."
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearEstimateSelection}
        actions={[
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setShowBulkDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none">
        {sortedEstimates.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No estimates found matching your search.'
              : 'No estimates yet. Click "Add Estimate" to get started.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleHeaderCheckboxChange}
                    className="cursor-pointer"
                    aria-label={
                      allVisibleSelected ? 'Deselect all estimates' : 'Select all estimates'
                    }
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('estimateNumber')}
                >
                  <div className="flex items-center gap-2">
                    <span>Estimate #</span>
                    {sortField === 'estimateNumber' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('contactName')}
                >
                  <div className="flex items-center gap-2">
                    <span>Contact</span>
                    {sortField === 'contactName' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center gap-2">
                    <span>Total</span>
                    {sortField === 'total' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead>Valid To</TableHead>
                <TableHead>Items</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    <span>Created</span>
                    {sortField === 'createdAt' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEstimates.map((estimate) => {
                const estimateIsSelected = isSelected(estimate.id);
                const totals = calculateEstimateTotals(
                  estimate.lineItems || [],
                  estimate.estimateDiscount || 0,
                );
                return (
                  <TableRow
                    key={estimate.id}
                    className="cursor-pointer hover:bg-accent"
                    tabIndex={0}
                    data-list-item={JSON.stringify(estimate)}
                    data-plugin-name="estimates"
                    role="button"
                    aria-label={`Open estimate ${estimate.estimateNumber}`}
                    onClick={(e) => {
                      // Don't open if clicking checkbox
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenForView(estimate);
                    }}
                  >
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={estimateIsSelected}
                        onChange={() => toggleEstimateSelected(estimate.id)}
                        className="cursor-pointer"
                        aria-label={estimateIsSelected ? 'Unselect estimate' : 'Select estimate'}
                      />
                    </TableCell>
                    <TableCell className="w-12">
                      <Calculator className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    </TableCell>
                    <TableCell className="font-semibold">{estimate.estimateNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>{estimate.contactName}</span>
                        {estimate.organizationNumber && (
                          <span className="text-xs text-muted-foreground">
                            Org: {estimate.organizationNumber}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(estimate.status)}</TableCell>
                    <TableCell className="font-medium">
                      {totals.total.toFixed(2)} {estimate.currency}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(estimate.validTo).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                      {totals.totalVat > 0 && (
                        <div className="text-xs">
                          VAT: {totals.totalVat.toFixed(2)} {estimate.currency}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(estimate.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        singularLabel="estimate"
        pluralLabel="estimates"
        isLoading={deleting}
      />

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
