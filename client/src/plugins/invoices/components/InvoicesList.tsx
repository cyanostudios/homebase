import { Plus, Search, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { GroupedList } from '@/core/ui/GroupedList';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import { invoicesNavigation } from '../navigation';

type SortField = 'invoiceNumber' | 'contactName' | 'total' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';
type InvoiceFilter = 'all' | 'draft' | 'paid' | 'overdue';

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

export function InvoicesList() {
  const { t } = useTranslation();
  const {
    invoices,
    openInvoiceForView,
    openInvoicesPanel,
    deleteInvoices,
    selectedInvoiceIds,
    toggleInvoiceSelected,
    mergeIntoInvoiceSelection,
    clearInvoiceSelection,
    selectedCount,
    isSelected,
  } = useInvoices();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [currentPage, setCurrentPage] = useState<string>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeFilter, setActiveFilter] = useState<InvoiceFilter>('all');

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Read currentPage from localStorage (same as App.tsx does)
  useEffect(() => {
    const saved = localStorage.getItem('homebase:currentPage');
    if (saved) {
      setCurrentPage(saved);
    }
    // Listen for storage changes
    const handleStorageChange = () => {
      const updated = localStorage.getItem('homebase:currentPage');
      if (updated) {
        setCurrentPage(updated);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Also listen to custom events if pages change programmatically
  useEffect(() => {
    const handlePageChange = (e: CustomEvent<string>) => {
      setCurrentPage(e.detail);
    };
    window.addEventListener('homebase:pageChange' as any, handlePageChange);
    return () => window.removeEventListener('homebase:pageChange' as any, handlePageChange);
  }, []);
  const [sortField] = useState<SortField>('createdAt');
  const [sortOrder] = useState<SortOrder>('desc');

  const sortedInvoices = useMemo(() => {
    const byFilter = invoices.filter((invoice) => {
      if (activeFilter === 'draft') {
        return invoice.status === 'draft';
      }
      if (activeFilter === 'paid') {
        return invoice.status === 'paid';
      }
      if (activeFilter === 'overdue') {
        return invoice.status === 'overdue';
      }
      return true;
    });

    const filtered = byFilter.filter((invoice) => {
      const searchStr = searchTerm.toLowerCase();
      return (
        (invoice.invoiceNumber || '').toLowerCase().includes(searchStr) ||
        (invoice.contactName || '').toLowerCase().includes(searchStr) ||
        (invoice.notes || '').toLowerCase().includes(searchStr) ||
        invoice.id.toLowerCase().includes(searchStr)
      );
    });

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'createdAt') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      } else if (sortField === 'total') {
        aValue = parseFloat(String(aValue || 0));
        bValue = parseFloat(String(bValue || 0));
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [invoices, searchTerm, sortField, sortOrder, activeFilter]);
  const stats = useMemo(
    () => ({
      total: invoices.length,
      draft: invoices.filter((i) => i.status === 'draft').length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      overdue: invoices.filter((i) => i.status === 'overdue').length,
    }),
    [invoices],
  );

  const visibleInvoiceIds = useMemo(
    () => sortedInvoices.map((inv) => String(inv.id)),
    [sortedInvoices],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleInvoiceIds,
      mergeIntoSelection: mergeIntoInvoiceSelection,
      toggleOne: toggleInvoiceSelected,
    });

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft:
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-secondary/50 text-secondary-foreground',
      sent: 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold plugin-contacts bg-plugin-subtle text-plugin',
      paid: 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold plugin-invoices bg-plugin-subtle text-plugin',
      overdue:
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-rose-50/50 text-rose-700 dark:text-rose-300',
      canceled:
        'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-rose-50/50 text-rose-700 dark:text-rose-300',
    };

    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;

    return <Badge className={colorClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const getTypeBadge = (invoiceType: string) => {
    const typeColors = {
      invoice: 'plugin-contacts bg-plugin-subtle text-plugin',
      credit_note: 'plugin-notes bg-plugin-subtle text-plugin',
      cash_invoice: 'plugin-invoices bg-plugin-subtle text-plugin',
      receipt: 'plugin-tasks bg-plugin-subtle text-plugin',
    };

    const typeLabels = {
      invoice: 'Faktura',
      credit_note: 'Kreditfaktura',
      cash_invoice: 'Kontantfaktura',
      receipt: 'Kvitto',
    };

    const type = invoiceType || 'invoice';
    const colorClass = typeColors[type as keyof typeof typeColors] || typeColors.invoice;
    const label = typeLabels[type as keyof typeof typeLabels] || 'Faktura';

    return (
      <Badge className={cn('border-0 rounded-md px-2 py-0.5 text-xs font-semibold', colorClass)}>
        {label}
      </Badge>
    );
  };

  const handleBulkDelete = async () => {
    if (selectedInvoiceIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteInvoices(selectedInvoiceIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedInvoiceIds.length === 0) {
      alert('Please select invoices to export');
      return;
    }
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(String(inv.id)));
    const csvHeaders = [
      'invoiceNumber',
      'contactName',
      'currency',
      'total',
      'status',
      'issueDate',
      'dueDate',
      'createdAt',
    ];
    const csvData = selectedInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber ?? '',
      contactName: inv.contactName ?? '',
      currency: inv.currency ?? '',
      total: inv.total ?? 0,
      status: inv.status ?? '',
      issueDate: inv.issueDate
        ? inv.issueDate instanceof Date
          ? inv.issueDate.toISOString()
          : String(inv.issueDate)
        : '',
      dueDate: inv.dueDate
        ? inv.dueDate instanceof Date
          ? inv.dueDate.toISOString()
          : String(inv.dueDate)
        : '',
      createdAt: inv.createdAt
        ? inv.createdAt instanceof Date
          ? inv.createdAt.toISOString()
          : String(inv.createdAt)
        : '',
    }));
    const filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedInvoiceIds.length === 0) {
      alert('Please select invoices to export');
      return;
    }
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(String(inv.id)));
    const pdfHeaders = [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'dueDate', label: 'Due Date' },
    ];
    const pdfData = selectedInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber ?? '',
      contactName: inv.contactName ?? '',
      currency: inv.currency ?? '',
      total: inv.total ?? 0,
      status: inv.status ?? '',
      issueDate: inv.issueDate
        ? inv.issueDate instanceof Date
          ? inv.issueDate.toLocaleDateString('sv-SE')
          : String(inv.issueDate)
        : '',
      dueDate: inv.dueDate
        ? inv.dueDate instanceof Date
          ? inv.dueDate.toLocaleDateString('sv-SE')
          : String(inv.dueDate)
        : '',
    }));
    const filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Invoices Export');
  };

  // Protected navigation handlers
  const handleOpenForView = (invoice: any) => {
    attemptNavigation(() => {
      openInvoiceForView(invoice);
    });
  };

  const handleSubNavClick = (page: string) => {
    attemptNavigation(() => {
      localStorage.setItem('homebase:currentPage', page);
      setCurrentPage(page);
      // Dispatch storage event so App.tsx can react
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'homebase:currentPage', newValue: page }),
      );
      // Also dispatch custom event for immediate update
      window.dispatchEvent(new CustomEvent('homebase:pageChange', { detail: page }));
    });
  };

  return (
    <div className="plugin-invoices min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.invoices')}</h2>
            <p className="text-sm text-muted-foreground">{t('invoices.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => attemptNavigation(() => openInvoicesPanel(null))}
          >
            {t('invoices.addInvoice')}
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
            label="Paid"
            value={stats.paid}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'paid'}
            onClick={() => setActiveFilter('paid')}
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            dotClassName="bg-rose-500"
            active={activeFilter === 'overdue'}
            onClick={() => setActiveFilter('overdue')}
          />
        </div>

        {invoicesNavigation.submenu && (
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {invoicesNavigation.submenu
              .sort((a, b) => a.order - b.order)
              .map((subItem) => {
                const SubIcon = subItem.icon;
                const isActive = subItem.page === currentPage;

                return (
                  <Button
                    key={subItem.page}
                    variant="ghost"
                    onClick={() => handleSubNavClick(subItem.page)}
                    className={cn(
                      'h-auto px-3 sm:px-5 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                      'flex items-center gap-1.5 sm:gap-2',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                  >
                    <SubIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{subItem.label}</span>
                  </Button>
                );
              })}
          </div>
        )}

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearInvoiceSelection}
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
          itemLabel="invoices"
          isLoading={deleting}
        />

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('invoices.searchPlaceholder')}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
          </div>
          <GroupedList
            items={sortedInvoices}
            groupConfig={null}
            emptyMessage={searchTerm ? t('invoices.noMatch') : t('invoices.noYet')}
            renderItem={(invoice, idx) => {
              const invoiceIsSelected = isSelected(invoice.id);
              return (
                <div
                  key={invoice.id}
                  className="bg-white hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3 dark:bg-slate-950 dark:hover:bg-slate-900/70 dark:focus:bg-slate-900/70"
                  tabIndex={0}
                  data-list-item={JSON.stringify(invoice)}
                  data-plugin-name="invoices"
                  role="button"
                  aria-label={`Open invoice ${formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}`}
                  onClick={(e) => {
                    // Don't open if clicking checkbox
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    e.preventDefault();
                    handleOpenForView(invoice);
                  }}
                >
                  {/* Rad 1: Checkbox + Invoice Number + Badges */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="checkbox"
                      checked={invoiceIsSelected}
                      onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, idx)}
                      onChange={() => onVisibleRowCheckboxChange(invoice.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer flex-shrink-0 h-5 w-5 sm:h-4 sm:w-4"
                      aria-label={invoiceIsSelected ? 'Unselect invoice' : 'Select invoice'}
                    />
                    <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                      {formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                      {getTypeBadge((invoice as any).invoiceType)}
                      {getStatusBadge(invoice.status || 'draft')}
                    </div>
                  </div>

                  {/* Rad 2: Contact + Total + Due Date */}
                  <div
                    className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-3 text-xs text-muted-foreground`}
                  >
                    <div className="flex-1 min-w-0 truncate">
                      {invoice.contactName || '—'}
                      {invoice.organizationNumber && (
                        <span className="ml-1">• {invoice.organizationNumber}</span>
                      )}
                    </div>
                    <div
                      className={`flex items-center gap-2 flex-shrink-0 ${isMobile ? 'flex-wrap' : ''}`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {(invoice.total || 0).toFixed(2)} {invoice.currency || 'SEK'}
                      </span>
                      {invoice.dueDate && (
                        <span>• Due {new Date(invoice.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Rad 3: VAT (optional) */}
                  {invoice.totalVat && invoice.totalVat > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      VAT: {(invoice.totalVat || 0).toFixed(2)} {invoice.currency || 'SEK'}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </Card>
      </div>
    </div>
  );
}
