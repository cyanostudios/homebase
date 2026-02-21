import {
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  Settings,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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
import { useApp } from '@/core/api/AppContext';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import { calculateEstimateTotals } from '../types/estimate';

import { EstimateSettingsView } from './EstimateSettingsView';

type SortField = 'estimateNumber' | 'contactName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export function EstimateList() {
  const { t } = useTranslation();
  const {
    estimates,
    estimatesContentView,
    openEstimateSettings,
    openEstimateForView,
    deleteEstimate,
    deleteEstimates,
    selectedEstimateIds,
    toggleEstimateSelected,
    selectAllEstimates,
    clearEstimateSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedEstimateId,
  } = useEstimates();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');

  const ESTIMATES_SETTINGS_KEY = 'estimates';

  useEffect(() => {
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings: { viewMode?: ViewMode }) => {
        if (cancelled) {
          return;
        }
        setViewModeState(settings?.viewMode === 'grid' ? 'grid' : 'list');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      updateSettings(ESTIMATES_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

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
      draft: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
      sent: 'plugin-contacts bg-plugin-subtle text-plugin border-plugin-subtle font-medium',
      accepted: 'plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle font-medium',
      rejected: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
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

  useEffect(() => {
    if (estimatesContentView !== 'list') {
      setHeaderTrailing(null);
      return () => setHeaderTrailing(null);
    }
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('estimates.searchPlaceholder')}
        rightActions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              onClick={() => openEstimateSettings()}
              className="h-9 text-xs px-3"
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className={cn('h-9 text-xs px-3', viewMode === 'grid' && 'text-primary')}
            >
              {t('slots.grid')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={ListIcon}
              onClick={() => setViewMode('list')}
              className={cn('h-9 text-xs px-3', viewMode === 'list' && 'text-primary')}
            >
              {t('slots.list')}
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
    t,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    setHeaderTrailing,
    estimatesContentView,
    openEstimateSettings,
  ]);

  // Protected navigation handlers
  const handleOpenForView = (estimate: any) => {
    attemptNavigation(() => {
      openEstimateForView(estimate);
    });
  };

  if (estimatesContentView === 'settings') {
    return <EstimateSettingsView />;
  }

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearEstimateSelection}
        actions={[
          {
            label: t('common.exportCsv'),
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          {
            label: t('common.exportPdf'),
            icon: FileText,
            onClick: handleExportPDF,
            variant: 'default',
          },
          {
            label: t('common.delete'),
            icon: Trash2,
            onClick: () => setShowBulkDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none border-none bg-transparent">
        {sortedEstimates.length === 0 ? (
          <Card className="shadow-none">
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm ? t('estimates.noMatch') : t('estimates.noYet')}
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedEstimates.map((estimate) => {
              const estimateIsSelected = isSelected(estimate.id);
              const totals = calculateEstimateTotals(
                estimate.lineItems || [],
                estimate.estimateDiscount || 0,
              );
              return (
                <Card
                  key={estimate.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[180px] border-transparent bg-gray-50 dark:bg-gray-900/40',
                    estimateIsSelected
                      ? 'plugin-estimates bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:plugin-estimates hover:shadow-md',
                    recentlyDuplicatedEstimateId === String(estimate.id) &&
                      'bg-green-50 dark:bg-green-950/30',
                  )}
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
                  aria-label={`Open estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={estimateIsSelected}
                        onChange={() => toggleEstimateSelected(estimate.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={estimateIsSelected ? 'Unselect estimate' : 'Select estimate'}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatDisplayNumber('estimates', estimate.estimateNumber)}
                      </span>
                    </div>
                    {getStatusBadge(estimate.status)}
                  </div>
                  <h3 className="font-semibold text-base mb-1 line-clamp-1">
                    {estimate.contactName}
                  </h3>
                  <div className="text-xs text-muted-foreground mb-4">
                    {estimate.organizationNumber && <span>Org: {estimate.organizationNumber}</span>}
                  </div>
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>
                        {totals.total.toFixed(2)} {estimate.currency}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      <div>Created: {new Date(estimate.createdAt).toLocaleDateString()}</div>
                      <div>Valid to: {new Date(estimate.validTo).toLocaleDateString()}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : isMobile ? (
          // Mobile: Card layout
          <Card className="shadow-none">
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
                    className={cn(
                      'p-4 cursor-pointer hover:bg-accent transition-colors',
                      recentlyDuplicatedEstimateId === String(estimate.id) &&
                        'bg-green-50 dark:bg-green-950/30',
                    )}
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
                    aria-label={`Open estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)}`}
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
                            aria-label={
                              estimateIsSelected ? 'Unselect estimate' : 'Select estimate'
                            }
                          />
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatDisplayNumber('estimates', estimate.estimateNumber)}
                          </span>
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
          </Card>
        ) : (
          // Desktop: Table layout
          <Card className="shadow-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleHeaderCheckboxChange}
                      className="h-4 w-4 cursor-pointer"
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
                      className={cn(
                        'cursor-pointer hover:bg-accent',
                        recentlyDuplicatedEstimateId === String(estimate.id) &&
                          'bg-green-50 dark:bg-green-950/30',
                      )}
                      tabIndex={0}
                      data-list-item={JSON.stringify(estimate)}
                      data-plugin-name="estimates"
                      role="button"
                      aria-label={`Open estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)}`}
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
                          className="h-4 w-4 cursor-pointer"
                          aria-label={estimateIsSelected ? 'Unselect estimate' : 'Select estimate'}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDisplayNumber('estimates', estimate.estimateNumber)}
                      </TableCell>
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
          </Card>
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
        title={t('estimates.deleteTitle')}
        message={`Are you sure you want to delete estimate "${formatDisplayNumber('estimates', deleteConfirm.estimateNumber)}"? ${t('bulk.cannotUndo')}`}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
}
