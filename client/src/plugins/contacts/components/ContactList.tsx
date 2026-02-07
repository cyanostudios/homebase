import { Mail, Phone, ArrowUp, ArrowDown, Trash2, FileSpreadsheet, FileText, Grid3x3, List as ListIcon } from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect } from 'react';

import { cn } from '@/lib/utils';

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
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useContacts } from '../hooks/useContacts';

type SortField = 'contactNumber' | 'name' | 'type' | 'email';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export const ContactList: React.FC = () => {
  const {
    contacts,
    openContactForView,
    deleteContact,
    deleteContacts,
    selectedContactIds,
    toggleContactSelected,
    selectAllContacts,
    clearContactSelection,
    selectedCount,
    isSelected,
  } = useContacts();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
  }>({
    isOpen: false,
    contactId: '',
    contactName: '',
  });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [sortField, setSortField] = useState<SortField>('contactNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('homebase:contacts:viewMode');
    return (saved as ViewMode) || 'list';
  });

  // Save viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('homebase:contacts:viewMode', viewMode);
  }, [viewMode]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to asc
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedContacts = useMemo(() => {
    const filtered = contacts.filter(
      (contact) =>
        contact.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.contactNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.organizationNumber &&
          contact.organizationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact.personalNumber &&
          contact.personalNumber.toLowerCase().includes(searchTerm.toLowerCase())),
    );

    return [...filtered].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortField === 'name') {
        aValue = a.companyName.toLowerCase();
        bValue = b.companyName.toLowerCase();
      } else if (sortField === 'type') {
        aValue = a.contactType;
        bValue = b.contactType;
      } else if (sortField === 'email') {
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
      } else {
        aValue = a.contactNumber;
        bValue = b.contactNumber;
      }

      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [contacts, searchTerm, sortField, sortOrder]);

  // Visible contact IDs for selection
  const visibleContactIds = useMemo(
    () => sortedContacts.map((contact) => String(contact.id)),
    [sortedContacts],
  );

  // Selection helpers
  const allVisibleSelected = useMemo(
    () => visibleContactIds.length > 0 && visibleContactIds.every((id) => isSelected(id)),
    [visibleContactIds, isSelected],
  );

  const someVisibleSelected = useMemo(
    () => visibleContactIds.some((id) => isSelected(id)),
    [visibleContactIds, isSelected],
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
      clearContactSelection();
    } else {
      selectAllContacts(visibleContactIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContactIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteContacts(selectedContactIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const _handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, contactId: id, contactName: name });
  };

  const confirmDelete = () => {
    deleteContact(deleteConfirm.contactId);
    setDeleteConfirm({ isOpen: false, contactId: '', contactName: '' });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, contactId: '', contactName: '' });
  };

  // Export handlers
  const handleExportCSV = () => {
    if (selectedContactIds.length === 0) {
      alert('Please select contacts to export');
      return;
    }

    // Get selected contacts
    const selectedContacts = contacts.filter((contact) =>
      selectedContactIds.includes(String(contact.id)),
    );

    // Define CSV headers
    const csvHeaders = [
      'contactNumber',
      'contactType',
      'companyName',
      'companyType',
      'organizationNumber',
      'vatNumber',
      'personalNumber',
      'email',
      'phone',
      'phone2',
      'website',
      'taxRate',
      'paymentTerms',
      'currency',
      'fTax',
      'notes',
      'createdAt',
      'updatedAt',
    ];

    // Format data for CSV
    const csvData = selectedContacts.map((contact) => ({
      contactNumber: contact.contactNumber || '',
      contactType: contact.contactType || '',
      companyName: contact.companyName || '',
      companyType: contact.companyType || '',
      organizationNumber: contact.organizationNumber || '',
      vatNumber: contact.vatNumber || '',
      personalNumber: contact.personalNumber || '',
      email: contact.email || '',
      phone: contact.phone || '',
      phone2: contact.phone2 || '',
      website: contact.website || '',
      taxRate: contact.taxRate || '',
      paymentTerms: contact.paymentTerms || '',
      currency: contact.currency || '',
      fTax: contact.fTax || '',
      notes: contact.notes || '',
      createdAt:
        contact.createdAt instanceof Date
          ? contact.createdAt.toISOString()
          : contact.createdAt || '',
      updatedAt:
        contact.updatedAt instanceof Date
          ? contact.updatedAt.toISOString()
          : contact.updatedAt || '',
    }));

    const filename = `contacts-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedContactIds.length === 0) {
      alert('Please select contacts to export');
      return;
    }

    // Get selected contacts
    const selectedContacts = contacts.filter((contact) =>
      selectedContactIds.includes(String(contact.id)),
    );

    // Define PDF headers with labels
    const pdfHeaders = [
      { key: 'contactNumber', label: 'Contact #' },
      { key: 'contactType', label: 'Type' },
      { key: 'companyName', label: 'Company Name' },
      { key: 'organizationNumber', label: 'Org. Number' },
      { key: 'vatNumber', label: 'VAT Number' },
      { key: 'personalNumber', label: 'Personal Number' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'phone2', label: 'Phone 2' },
      { key: 'website', label: 'Website' },
      { key: 'taxRate', label: 'Tax Rate' },
      { key: 'paymentTerms', label: 'Payment Terms' },
      { key: 'currency', label: 'Currency' },
      { key: 'notes', label: 'Notes' },
    ];

    // Format data for PDF
    const pdfData = selectedContacts.map((contact) => ({
      contactNumber: contact.contactNumber || '',
      contactType: contact.contactType === 'company' ? 'Company' : 'Private',
      companyName: contact.companyName || '',
      organizationNumber: contact.organizationNumber || '',
      vatNumber: contact.vatNumber || '',
      personalNumber: contact.personalNumber || '',
      email: contact.email || '',
      phone: contact.phone || '',
      phone2: contact.phone2 || '',
      website: contact.website || '',
      taxRate: contact.taxRate || '',
      paymentTerms: contact.paymentTerms || '',
      currency: contact.currency || '',
      notes: contact.notes || '',
    }));

    const filename = `contacts-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Contacts Export');
  };

  // Set header trailing (search + view mode toggle) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search contacts..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="h-9 w-9"
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="h-9 w-9"
              title="List view"
            >
              <ListIcon className="w-4 h-4" />
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing]);

  // Protected navigation handlers
  const handleOpenForView = (contact: any) => attemptNavigation(() => openContactForView(contact));

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearContactSelection}
        actions={[
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          {
            label: 'Export PDF',
            icon: FileText,
            onClick: handleExportPDF,
            variant: 'default',
          },
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setShowBulkDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none border-none bg-transparent">
        {sortedContacts.length === 0 ? (
          <Card className="shadow-none">
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm
                ? 'No contacts found matching your search.'
                : 'No contacts yet. Click "Add Contact" to get started.'}
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedContacts.map((contact) => {
              const contactIsSelected = isSelected(contact.id);
              return (
                <Card
                  key={contact.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[160px] border-transparent',
                    contactIsSelected
                      ? 'plugin-contacts bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md'
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    e.preventDefault();
                    handleOpenForView(contact);
                  }}
                  data-list-item={JSON.stringify(contact)}
                  data-plugin-name="contacts"
                  role="button"
                  aria-label={`Open contact ${contact.companyName}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={contactIsSelected}
                        onChange={() => toggleContactSelected(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatDisplayNumber('contacts', contact.contactNumber || contact.id)}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-medium',
                        contact.contactType === 'company'
                          ? 'plugin-contacts bg-plugin-subtle text-plugin border-plugin-subtle'
                          : 'plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle'
                      )}
                    >
                      {contact.contactType === 'company' ? 'Company' : 'Private'}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base mb-1 line-clamp-1">
                    {contact.companyName}
                  </h3>
                  <div className="text-xs text-muted-foreground mb-4">
                    {contact.contactType === 'company' && contact.organizationNumber && (
                      <span>Org: {contact.organizationNumber}</span>
                    )}
                    {contact.contactType === 'private' && contact.personalNumber && (
                      <span>PN: {contact.personalNumber.substring(0, 9)}XXXX</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground mt-1 pt-2 border-t border-dashed">
                      <div>Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
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
              {sortedContacts.map((contact) => {
                const contactIsSelected = isSelected(contact.id);
                return (
                  <Card
                    key={contact.id}
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenForView(contact);
                    }}
                    data-list-item={JSON.stringify(contact)}
                    data-plugin-name="contacts"
                    role="button"
                    aria-label={`Open contact ${contact.companyName}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={contactIsSelected}
                            onChange={() => toggleContactSelected(contact.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                            aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                          />
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatDisplayNumber('contacts', contact.contactNumber || contact.id)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-medium',
                              contact.contactType === 'company'
                                ? 'plugin-contacts bg-plugin-subtle text-plugin border-plugin-subtle'
                                : 'plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle'
                            )}
                          >
                            {contact.contactType === 'company' ? 'Company' : 'Private'}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-base mb-1 truncate">
                          {contact.companyName}
                        </h3>
                        {contact.contactType === 'company' && contact.organizationNumber && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Org: {contact.organizationNumber}
                          </p>
                        )}
                        {contact.contactType === 'private' && contact.personalNumber && (
                          <p className="text-xs text-muted-foreground mb-1">
                            PN: {contact.personalNumber.substring(0, 9)}XXXX
                          </p>
                        )}
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
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
                        allVisibleSelected ? 'Deselect all contacts' : 'Select all contacts'
                      }
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('contactNumber')}
                  >
                    <div className="flex items-center gap-2">
                      <span>#</span>
                      {sortField === 'contactNumber' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Name</span>
                      {sortField === 'name' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Type</span>
                      {sortField === 'type' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Email</span>
                      {sortField === 'email' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.map((contact) => {
                  const contactIsSelected = isSelected(contact.id);
                  return (
                    <TableRow
                      key={contact.id}
                      className="cursor-pointer hover:bg-accent"
                      tabIndex={0}
                      data-list-item={JSON.stringify(contact)}
                      data-plugin-name="contacts"
                      role="button"
                      aria-label={`Open contact ${contact.companyName}`}
                      onClick={(e) => {
                        // Don't open if clicking checkbox
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        e.preventDefault();
                        handleOpenForView(contact);
                      }}
                    >
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={contactIsSelected}
                          onChange={() => toggleContactSelected(contact.id)}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={contactIsSelected ? 'Unselect contact' : 'Select contact'}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatDisplayNumber('contacts', contact.contactNumber || contact.id)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{contact.companyName}</span>
                          {contact.contactType === 'company' && contact.organizationNumber && (
                            <span className="text-xs text-muted-foreground">
                              Org: {contact.organizationNumber}
                            </span>
                          )}
                          {contact.contactType === 'private' && contact.personalNumber && (
                            <span className="text-xs text-muted-foreground">
                              PN: {contact.personalNumber.substring(0, 9)}XXXX
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-medium',
                            contact.contactType === 'company'
                              ? 'plugin-contacts bg-plugin-subtle text-plugin border-plugin-subtle'
                              : 'plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle'
                          )}
                        >
                          {contact.contactType === 'company' ? 'Company' : 'Private'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{contact.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card >
        )}
      </Card >

      {/* Bulk Delete Modal */}
      < BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="contacts"
        isLoading={deleting}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Contact"
        message={`Are you sure you want to delete "${deleteConfirm.contactName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
