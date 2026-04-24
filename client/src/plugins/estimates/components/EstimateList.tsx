import {
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
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
type EstimateFilter = 'all' | 'draft' | 'accepted' | 'sent';

function StatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border-0 bg-card p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

export function EstimateList() {
  const { t } = useTranslation();
  const {
    estimates,
    estimatesContentView,
    openEstimateSettings,
    openEstimatePanel,
    openEstimateForView,
    deleteEstimates,
    selectedEstimateIds,
    toggleEstimateSelected,
    mergeIntoEstimateSelection,
    selectAllEstimates,
    clearEstimateSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedEstimateId,
  } = useEstimates();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [activeFilter, setActiveFilter] = useState<EstimateFilter>('all');

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
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sortedEstimates = useMemo(() => {
    const byFilter = estimates.filter((estimate) => {
      if (activeFilter === 'draft') {
        return estimate.status === 'draft';
      }
      if (activeFilter === 'accepted') {
        return estimate.status === 'accepted';
      }
      if (activeFilter === 'sent') {
        return estimate.status === 'sent';
      }
      return true;
    });

    const filtered = byFilter.filter(
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
  }, [estimates, searchTerm, sortField, sortOrder, activeFilter]);
  const stats = useMemo(
    () => ({
      total: estimates.length,
      draft: estimates.filter((e) => e.status === 'draft').length,
      accepted: estimates.filter((e) => e.status === 'accepted').length,
      sent: estimates.filter((e) => e.status === 'sent').length,
    }),
    [estimates],
  );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft:
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-secondary/50 text-secondary-foreground',
      sent: 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold plugin-contacts bg-plugin-subtle text-plugin',
      accepted:
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold plugin-invoices bg-plugin-subtle text-plugin',
      rejected:
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-rose-50/50 text-rose-700 dark:text-rose-300',
    };

    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;

    return <Badge className={colorClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  // Visible estimate IDs for selection
  const visibleEstimateIds = useMemo(
    () => sortedEstimates.map((estimate) => String(estimate.id)),
    [sortedEstimates],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleEstimateIds,
      mergeIntoSelection: mergeIntoEstimateSelection,
      toggleOne: toggleEstimateSelected,
    });

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
    <div className="plugin-estimates min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.estimates')}</h2>
            <p className="text-sm text-muted-foreground">{t('estimates.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => attemptNavigation(() => openEstimatePanel(null))}
          >
            {t('estimates.addEstimate')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label="Draft"
            value={stats.draft}
            dotClassName="bg-slate-500"
            active={activeFilter === 'draft'}
            onClick={() => setActiveFilter('draft')}
          />
          <StatCard
            label="Sent"
            value={stats.sent}
            dotClassName="bg-amber-500"
            active={activeFilter === 'sent'}
            onClick={() => setActiveFilter('sent')}
          />
          <StatCard
            label="Accepted"
            value={stats.accepted}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'accepted'}
            onClick={() => setActiveFilter('accepted')}
          />
        </div>

        {selectedCount > 0 && (
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
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="estimates"
          isLoading={deleting}
        />

        <Card
          className={cn(
            'rounded-xl border-0',
            viewMode === 'grid'
              ? 'overflow-visible bg-transparent shadow-none'
              : 'overflow-hidden bg-white shadow-sm dark:bg-slate-950',
          )}
        >
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('estimates.searchPlaceholder')}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                onClick={() => openEstimateSettings()}
                className="h-8 px-2.5 text-xs"
                title={t('common.settings')}
              >
                {t('common.settings')}
              </Button>
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('slots.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ListIcon}
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('slots.list')}
                </Button>
              </div>
            </div>
          </div>

          {sortedEstimates.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? t('estimates.noMatch') : t('estimates.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedEstimates.map((estimate, index) => {
                const estimateIsSelected = isSelected(estimate.id);
                const totals = calculateEstimateTotals(
                  estimate.lineItems || [],
                  estimate.estimateDiscount || 0,
                );
                return (
                  <Card
                    key={estimate.id}
                    className={cn(
                      'relative flex h-full min-h-[180px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all dark:bg-slate-950',
                      estimateIsSelected
                        ? 'plugin-estimates bg-plugin-subtle border-plugin-subtle ring-1 border-plugin-subtle'
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={estimateIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(estimate.id)}
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
                    <h3 className="line-clamp-1 text-base font-semibold leading-snug">
                      {estimate.contactName}
                    </h3>
                    {estimate.organizationNumber ? (
                      <div className="text-xs text-muted-foreground">
                        <span>Org: {estimate.organizationNumber}</span>
                      </div>
                    ) : null}
                    <div className="mt-auto flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>
                          {totals.total.toFixed(2)} {estimate.currency}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {estimate.lineItems.length} item
                          {estimate.lineItems.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
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
                {sortedEstimates.map((estimate, index) => {
                  const estimateIsSelected = isSelected(estimate.id);
                  const totals = calculateEstimateTotals(
                    estimate.lineItems || [],
                    estimate.estimateDiscount || 0,
                  );
                  return (
                    <Card
                      key={estimate.id}
                      className={cn(
                        'rounded-xl border-0 bg-card p-4 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors',
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
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(estimate.id)}
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
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
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
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
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
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
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
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
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
                    <TableHead className="text-xs">Valid To</TableHead>
                    <TableHead className="text-xs">Items</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs"
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
                  {sortedEstimates.map((estimate, index) => {
                    const estimateIsSelected = isSelected(estimate.id);
                    const totals = calculateEstimateTotals(
                      estimate.lineItems || [],
                      estimate.estimateDiscount || 0,
                    );
                    return (
                      <TableRow
                        key={estimate.id}
                        className={cn(
                          'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                          estimateIsSelected && 'bg-plugin-subtle',
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
                        <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={estimateIsSelected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(estimate.id)}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={
                              estimateIsSelected ? 'Unselect estimate' : 'Select estimate'
                            }
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
                        <TableCell className="text-xs">
                          {new Date(estimate.validTo).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {estimate.lineItems.length} item
                          {estimate.lineItems.length !== 1 ? 's' : ''}
                          {totals.totalVat > 0 && (
                            <div className="text-xs">
                              VAT: {totals.totalVat.toFixed(2)} {estimate.currency}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(estimate.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
          <div
            className={cn(
              'px-4 py-2 text-xs text-muted-foreground',
              viewMode === 'grid'
                ? 'mx-1 mb-1 mt-3 rounded-xl bg-white dark:bg-slate-950'
                : 'border-t border-border/60',
            )}
          >
            Showing {sortedEstimates.length} of {estimates.length} Estimates
          </div>
        </Card>
      </div>
    </div>
  );
}
