import {
  Calculator,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import { calculateEstimateTotals } from '../types/estimate';
import { estimateExportConfig } from '../utils/estimateExportConfig';

type SortField = 'estimateNumber' | 'contactName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'homebase-estimates-view-mode';

export function EstimateList() {
  const { estimates, openEstimateForView, deleteEstimate, deleteEstimates } = useEstimates();
  const { setHeaderTrailing } = useContentLayout();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const s = localStorage.getItem(VIEW_MODE_KEY);
      return s === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const selectedCount = selectedIds.size;
  const allSelected =
    sortedEstimates.length > 0 && sortedEstimates.every((e) => selectedIds.has(e.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedEstimates.map((e) => e.id)));
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleBulkDeleteConfirm = async () => {
    setBulkDeleting(true);
    try {
      await deleteEstimates(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const setViewModePersisted = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (selectedIds.size === 0) {
      alert('Please select estimates to export');
      return;
    }
    const selected = estimates.filter((e) => selectedIds.has(e.id));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    exportItems({
      items: selected,
      format: 'csv',
      config: estimateExportConfig,
      filename,
      title: 'Estimates Export',
    });
  }, [estimates, selectedIds]);

  const handleExportPDF = useCallback(async () => {
    if (selectedIds.size === 0) {
      alert('Please select estimates to export');
      return;
    }
    const selected = estimates.filter((e) => selectedIds.has(e.id));
    const filename = `estimates-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: selected,
      format: 'pdf',
      config: estimateExportConfig,
      filename,
      title: 'Estimates Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      await (result as Promise<void>).catch((err) => {
        console.error('PDF export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  }, [estimates, selectedIds]);

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search estimates..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setViewModePersisted('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setViewModePersisted('list')}
            >
              <ListIcon className="h-4 w-4" />
              List
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewModePersisted, setHeaderTrailing]);

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

  return (
    <div className="space-y-4">
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClearSelection={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export CSV', icon: FileSpreadsheet, onClick: handleExportCSV, variant: 'default' },
            { label: 'Export PDF', icon: FileText, onClick: handleExportPDF, variant: 'default' },
            {
              label: 'Delete…',
              icon: Trash2,
              onClick: () => setBulkDeleteOpen(true),
              variant: 'destructive',
            },
          ]}
        />
      )}

      <Card className="shadow-none">
        {sortedEstimates.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No estimates found matching your search.'
              : 'No estimates yet. Click "Add Estimate" to get started.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedEstimates.map((estimate) => {
              const totals = calculateEstimateTotals(
                estimate.lineItems || [],
                estimate.estimateDiscount || 0,
              );
              return (
                <Card
                  key={estimate.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[180px] border-transparent plugin-estimates',
                    selectedIds.has(estimate.id)
                      ? 'bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:shadow-md',
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                    e.preventDefault();
                    handleOpenForView(estimate);
                  }}
                  data-list-item={JSON.stringify(estimate)}
                  data-plugin-name="estimates"
                  role="button"
                  aria-label={`Open estimate ${estimate.estimateNumber}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(estimate.id)}
                        onChange={() => toggleSelectOne(estimate.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={
                          selectedIds.has(estimate.id) ? 'Unselect estimate' : 'Select estimate'
                        }
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {estimate.estimateNumber}
                      </span>
                    </div>
                    {getStatusBadge(estimate.status)}
                  </div>
                  <h3 className="font-semibold text-base mb-1 line-clamp-1">{estimate.contactName}</h3>
                  <div className="text-xs text-muted-foreground mb-4">
                    {estimate.organizationNumber && (
                      <span>Org: {estimate.organizationNumber}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>
                        {totals.total.toFixed(2)} {estimate.currency}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {estimate.lineItems.length} item
                        {estimate.lineItems.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Valid to: {new Date(estimate.validTo).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={allSelected ? 'Deselect all estimates' : 'Select all estimates'}
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
                const totals = calculateEstimateTotals(
                  estimate.lineItems || [],
                  estimate.estimateDiscount || 0,
                );
                return (
                  <TableRow
                    key={estimate.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
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
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(estimate.id)}
                        onChange={() => toggleSelectOne(estimate.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={`Select ${estimate.estimateNumber}`}
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

      <BulkDeleteModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        itemCount={selectedCount}
        itemLabel="estimates"
        isLoading={bulkDeleting}
      />
    </div>
  );
}
