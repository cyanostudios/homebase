import { ArrowUp, ArrowDown, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
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
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
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
  const { setHeaderTrailing } = useContentLayout();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleExportCSV = () => {
    if (selectedEstimateIds.length === 0) {
      alert('Please select estimates to export');
      return;
    }
    const selectedEstimates = estimates.filter((est) =>
      selectedEstimateIds.includes(String(est.id)),
    );
    const csvHeaders = [
      'estimateNumber',
      'contactName',
      'organizationNumber',
      'currency',
      'total',
      'status',
      'validTo',
      'createdAt',
      'updatedAt',
    ];
    const csvData = selectedEstimates.map((est) => ({
      estimateNumber: est.estimateNumber ?? '',
      contactName: est.contactName ?? '',
      organizationNumber: est.organizationNumber ?? '',
      currency: est.currency ?? '',
      total: est.total ?? 0,
      status: est.status ?? '',
      validTo: est.validTo instanceof Date ? est.validTo.toISOString() : String(est.validTo ?? ''),
      createdAt:
        est.createdAt instanceof Date ? est.createdAt.toISOString() : String(est.createdAt ?? ''),
      updatedAt:
        est.updatedAt instanceof Date ? est.updatedAt.toISOString() : String(est.updatedAt ?? ''),
    }));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedEstimateIds.length === 0) {
      alert('Please select estimates to export');
      return;
    }
    const selectedEstimates = estimates.filter((est) =>
      selectedEstimateIds.includes(String(est.id)),
    );
    const pdfHeaders = [
      { key: 'estimateNumber', label: 'Estimate #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'validTo', label: 'Valid To' },
      { key: 'createdAt', label: 'Created' },
    ];
    const pdfData = selectedEstimates.map((est) => ({
      estimateNumber: est.estimateNumber ?? '',
      contactName: est.contactName ?? '',
      currency: est.currency ?? '',
      total: est.total ?? 0,
      status: est.status ?? '',
      validTo:
        est.validTo instanceof Date
          ? est.validTo.toLocaleDateString('sv-SE')
          : String(est.validTo ?? ''),
      createdAt:
        est.createdAt instanceof Date
          ? est.createdAt.toLocaleDateString('sv-SE')
          : String(est.createdAt ?? ''),
    }));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Estimates Export');
  };

  // Set header trailing (search + filter) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search estimates..."
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, setHeaderTrailing]);

  // Protected navigation handlers
  const handleOpenForView = (estimate: any) => {
    attemptNavigation(() => {
      openEstimateForView(estimate);
    });
  };

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearEstimateSelection}
        actions={[
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          { label: 'Export PDF', icon: FileText, onClick: handleExportPDF, variant: 'default' },
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
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-2 p-4">
            {sortedEstimates.map((estimate) => {
              const estimateIsSelected = isSelected(estimate.id);
              const totals = calculateEstimateTotals(
                estimate.lineItems || [],
                estimate.estimateDiscount || 0,
              );
              return (
                <Card
                  key={estimate.id}
                  className="p-4 cursor-pointer hover:bg-accent transition-colors"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    e.preventDefault();
                    handleOpenForView(estimate);
                  }}
                  data-list-item={JSON.stringify(estimate)}
                  data-plugin-name="estimates"
                  role="button"
                  aria-label={`Open estimate ${estimate.estimateNumber}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={estimateIsSelected}
                          onChange={() => toggleEstimateSelected(estimate.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                          aria-label={estimateIsSelected ? 'Unselect estimate' : 'Select estimate'}
                        />
                        <span className="font-semibold text-base">{estimate.estimateNumber}</span>
                        {getStatusBadge(estimate.status)}
                      </div>
                      <h3 className="font-semibold mb-1 truncate">{estimate.contactName}</h3>
                      {estimate.organizationNumber && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Org: {estimate.organizationNumber}
                        </p>
                      )}
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="font-medium">
                          {totals.total.toFixed(2)} {estimate.currency}
                        </div>
                        <div className="text-muted-foreground">
                          {estimate.lineItems.length} item
                          {estimate.lineItems.length !== 1 ? 's' : ''}
                          {totals.totalVat > 0 &&
                            ` • VAT: ${totals.totalVat.toFixed(2)} ${estimate.currency}`}
                        </div>
                        <div className="text-muted-foreground">
                          Valid to: {new Date(estimate.validTo).toLocaleDateString()}
                        </div>
                        <div className="text-muted-foreground">
                          Created: {new Date(estimate.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          // Desktop: Table layout
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
        itemLabel="estimates"
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
