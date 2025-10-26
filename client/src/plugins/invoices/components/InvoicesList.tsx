import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Eye, Search, ChevronUp, ChevronDown, Copy, Receipt } from 'lucide-react';
import { useInvoicesContext } from '../context/InvoicesContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { Button } from '@/core/ui/Button';
import { Badge } from '@/core/ui/Badge';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

type SortField = 'invoiceNumber' | 'contactName' | 'total' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

export function InvoicesList() {
  const { 
    invoices,
    openInvoicesPanel,
    openInvoiceForEdit,
    openInvoiceForView,
    deleteInvoice
  } = useInvoicesContext();
  const { attemptNavigation } = useGlobalNavigationGuard();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
  }>({
    isOpen: false,
    invoiceId: '',
    invoiceNumber: ''
  });
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedInvoices = useMemo(() => {
    const filtered = invoices.filter(invoice => {
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
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [invoices, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const handleDelete = (id: string, invoiceNumber: string) => {
    setDeleteConfirm({
      isOpen: true,
      invoiceId: id,
      invoiceNumber: invoiceNumber || id
    });
  };

  const confirmDelete = () => {
    deleteInvoice(deleteConfirm.invoiceId);
    setDeleteConfirm({
      isOpen: false,
      invoiceId: '',
      invoiceNumber: ''
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      invoiceId: '',
      invoiceNumber: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800',
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
    
    return (
      <Badge className={colorClass}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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
    
    return (
      <Badge className={colorClass}>
        {label}
      </Badge>
    );
  };

  // Protected navigation handlers
  const handleOpenForView = (invoice: any) => {
    attemptNavigation(() => {
      openInvoiceForView(invoice);
    });
  };

  const handleOpenForEdit = (invoice: any) => {
    attemptNavigation(() => {
      openInvoiceForEdit(invoice);
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button
            onClick={handleOpenPanel}
            variant="primary"
            icon={Plus}
          >
            Add Invoice
          </Button>
        </div>
      </div>

      <Card>
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('invoiceNumber')}
                >
                  <div className="flex items-center gap-1">
                    Invoice #
                    <SortIcon field="invoiceNumber" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('contactName')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    <SortIcon field="contactName" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center gap-1">
                    Total
                    <SortIcon field="total" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm ? 'No invoices found matching your search.' : 'No invoices yet. Click "Add Invoice" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice, idx) => (
                  <tr 
                    key={invoice.id} 
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-blue-500" />
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber || `DRAFT-${invoice.id}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{invoice.contactName || '—'}</div>
                        {invoice.organizationNumber && (
                          <div className="text-xs text-gray-500">{invoice.organizationNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge((invoice as any).invoiceType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invoice.status || 'draft')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(invoice.total || 0).toFixed(2)} {invoice.currency || 'SEK'}
                      </div>
                      <div className="text-xs text-gray-500">
                        VAT: {(invoice.totalVat || 0).toFixed(2)} {invoice.currency || 'SEK'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForView(invoice);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForEdit(invoice);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedInvoices.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchTerm ? 'No invoices found matching your search.' : 'No invoices yet. Click "Add Invoice" to get started.'}
              </div>
            ) : (
              sortedInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <Receipt className="w-5 h-5 text-blue-500" />
                      <div className="text-xs text-gray-500">
                        {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber || `DRAFT-${invoice.id}`}
                        </h3>
                        {getTypeBadge((invoice as any).invoiceType)}
                        {getStatusBadge(invoice.status || 'draft')}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">{invoice.contactName || '—'}</div>
                        {invoice.organizationNumber && (
                          <div className="text-xs text-gray-500">{invoice.organizationNumber}</div>
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {(invoice.total || 0).toFixed(2)} {invoice.currency || 'SEK'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Eye}
                        onClick={() => handleOpenForView(invoice)}
                        className="h-8 px-3"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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