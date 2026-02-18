import { Receipt, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { GroupedList } from '@/core/ui/GroupedList';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import { invoicesNavigation } from '../navigation';

type SortField = 'invoiceNumber' | 'contactName' | 'total' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

export function InvoicesList() {
  const { invoices, openInvoiceForView, deleteInvoice, deleteInvoices } = useInvoices();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [currentPage, setCurrentPage] = useState<string>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const selectedCount = selectedIds.size;
  const allSelected =
    sortedInvoices.length > 0 && sortedInvoices.every((i) => selectedIds.has(i.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedInvoices.map((i) => i.id)));
    }
  };
  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
      await deleteInvoices(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
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
        <div className="flex items-center gap-3 flex-wrap">
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
                    'h-auto px-5 py-3 rounded-lg text-sm font-medium transition-colors',
                    'flex items-center gap-2',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                  )}
                >
                  <SubIcon className="h-4 w-4" />
                  <span>{subItem.label}</span>
                </Button>
              );
            })}
        </div>
      )}

      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search invoices..."
      />

      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClearSelection={() => setSelectedIds(new Set())}
          actions={[
            {
              label: 'Delete',
              icon: Trash2,
              onClick: () => setBulkDeleteOpen(true),
              variant: 'destructive',
            },
          ]}
        />
      )}

      <Card className="shadow-none">
        {sortedInvoices.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all"
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}
        <GroupedList
          items={sortedInvoices}
          groupConfig={null}
          emptyMessage={
            searchTerm
              ? 'No invoices found matching your search.'
              : 'No invoices yet. Click "Add Invoice" to get started.'
          }
          renderItem={(invoice, idx) => (
            <div
              key={invoice.id}
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3 flex items-start gap-2`}
              tabIndex={0}
              data-list-item={JSON.stringify(invoice)}
              data-plugin-name="invoices"
              role="button"
              aria-label={`Open invoice ${invoice.invoiceNumber || invoice.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleOpenForView(invoice);
              }}
            >
              <div
                className="flex-shrink-0 pt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(invoice.id)}
                  onCheckedChange={() => {}}
                  onClick={(e) => toggleSelectOne(invoice.id, e)}
                  aria-label={`Select ${invoice.invoiceNumber || invoice.id}`}
                />
              </div>
              <div className="flex-1 min-w-0">
              {/* Rad 1: Icon + Invoice Number + Badges */}
              <div className="flex items-center gap-2 mb-1.5">
                <Receipt className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                  {invoice.invoiceNumber || `DRAFT-${invoice.id}`}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {getTypeBadge((invoice as any).invoiceType)}
                  {getStatusBadge(invoice.status || 'draft')}
                </div>
              </div>

              {/* Rad 2: Contact + Total + Due Date */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 min-w-0 truncate">
                  {invoice.contactName || '—'}
                  {invoice.organizationNumber && (
                    <span className="ml-1">• {invoice.organizationNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
            </div>
          )}
        />
      </Card>

      <BulkDeleteModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        itemCount={selectedCount}
        itemLabel="invoices"
        isLoading={bulkDeleting}
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
