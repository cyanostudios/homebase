import { Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { GroupedList } from '@/core/ui/GroupedList';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import { invoicesNavigation } from '../navigation';

type SortField = 'invoiceNumber' | 'contactName' | 'total' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

export function InvoicesList() {
  const {
    invoices,
    openInvoiceForView,
    deleteInvoice,
    deleteInvoices,
    selectedInvoiceIds,
    toggleInvoiceSelected,
    clearInvoiceSelection,
    selectedCount,
    isSelected,
  } = useInvoices();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();

  const [currentPage, setCurrentPage] = useState<string>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
  }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: '',
  });

  const sortedInvoices = useMemo(() => {
    const filtered = invoices.filter((invoice) => {
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
  }, [invoices, searchTerm, sortField, sortOrder]);

  const _handleDelete = (id: string, invoiceNumber: string) => {
    setDeleteConfirm({
      isOpen: true,
      invoiceId: id,
      invoiceNumber: invoiceNumber || id,
    });
  };

  const confirmDelete = () => {
    deleteInvoice(deleteConfirm.invoiceId);
    setDeleteConfirm({
      isOpen: false,
      invoiceId: '',
      invoiceNumber: '',
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      invoiceId: '',
      invoiceNumber: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      overdue: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      canceled: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
    };

    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;

    return <Badge className={colorClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const getTypeBadge = (invoiceType: string) => {
    const typeColors = {
      invoice: 'bg-blue-50 text-blue-700',
      credit_note: 'bg-orange-50 text-orange-700',
      cash_invoice: 'bg-green-50 text-green-700',
      receipt: 'bg-purple-50 text-purple-700',
    };

    const typeLabels = {
      invoice: 'Faktura',
      credit_note: 'Kredit',
      cash_invoice: 'Kontant',
      receipt: 'Kvitto',
    };

    const type = invoiceType || 'invoice';
    const colorClass = typeColors[type as keyof typeof typeColors] || typeColors.invoice;
    const label = typeLabels[type as keyof typeof typeLabels] || 'Faktura';

    return <Badge className={colorClass}>{label}</Badge>;
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

  // Set header trailing (search + filter) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search invoices..."
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, setHeaderTrailing]);

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
    <div className="space-y-4">
      {/* Sub-navigation buttons */}
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearInvoiceSelection}
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
        <GroupedList
          items={sortedInvoices}
          groupConfig={null}
          emptyMessage={
            searchTerm
              ? 'No invoices found matching your search.'
              : 'No invoices yet. Click "Add Invoice" to get started.'
          }
          renderItem={(invoice, idx) => {
            const invoiceIsSelected = isSelected(invoice.id);
            return (
              <div
                key={invoice.id}
                className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
                tabIndex={0}
                data-list-item={JSON.stringify(invoice)}
                data-plugin-name="invoices"
                role="button"
                aria-label={`Open invoice ${invoice.invoiceNumber || invoice.id}`}
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
                    onChange={() => toggleInvoiceSelected(invoice.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer flex-shrink-0 h-5 w-5 sm:h-4 sm:w-4"
                    aria-label={invoiceIsSelected ? 'Unselect invoice' : 'Select invoice'}
                  />
                  <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                    {invoice.invoiceNumber || `DRAFT-${invoice.id}`}
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

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        singularLabel="invoice"
        pluralLabel="invoices"
        isLoading={deleting}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice "${deleteConfirm.invoiceNumber}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
}
