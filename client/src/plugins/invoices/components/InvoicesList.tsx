import { Plus, Search, Receipt } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { GroupedList } from '@/core/ui/GroupedList';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useInvoices } from '../hooks/useInvoices';

type SortField = 'invoiceNumber' | 'contactName' | 'total' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

export function InvoicesList() {
  const { invoices, openInvoicesPanel, openInvoiceForView, deleteInvoice } = useInvoices();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
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

  // Protected navigation handlers
  const handleOpenForView = (invoice: any) => {
    attemptNavigation(() => {
      openInvoiceForView(invoice);
    });
  };

  const handleOpenPanel = () => {
    attemptNavigation(() => {
      openInvoicesPanel(null);
    });
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>
            Invoices ({searchTerm ? sortedInvoices.length : invoices.length}
            {searchTerm && sortedInvoices.length !== invoices.length && ` of ${invoices.length}`})
          </Heading>
          <Text variant="caption">Manage your customer invoices</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
            <Input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10"
            />
          </div>
          <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>
            Add Invoice
          </Button>
        </div>
      </div>

      <Card>
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
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
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
          )}
        />
      </Card>

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
