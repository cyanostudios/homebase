import { Mail, Phone, Building, User, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useContacts } from '../hooks/useContacts';

type SortField = 'contactNumber' | 'name' | 'type' | 'email';
type SortOrder = 'asc' | 'desc';

export const ContactList: React.FC = () => {
  const { contacts, openContactForView, deleteContact, deleteContacts } = useContacts();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
  }>({
    isOpen: false,
    contactId: '',
    contactName: '',
  });

  const [sortField, setSortField] = useState<SortField>('contactNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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

  const selectedCount = selectedIds.size;
  const allSelected =
    sortedContacts.length > 0 &&
    sortedContacts.every((c) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedContacts.map((c) => c.id)));
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
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    try {
      await deleteContacts(ids);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Protected navigation handlers
  const handleOpenForView = (contact: any) => attemptNavigation(() => openContactForView(contact));
  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search contacts..."
      />

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

      <Card className="shadow-none">
        {sortedContacts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No contacts found matching your search.'
              : 'No contacts yet. Click "Add Contact" to get started.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
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
              {sortedContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-accent"
                  tabIndex={0}
                  data-list-item={JSON.stringify(contact)}
                  data-plugin-name="contacts"
                  role="button"
                  aria-label={`Open contact ${contact.companyName}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleOpenForView(contact);
                  }}
                >
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleSelectOne(contact.id)}
                      aria-label={`Select ${contact.companyName}`}
                    />
                  </TableCell>
                  <TableCell className="w-12">
                    {contact.contactType === 'company' ? (
                      <Building className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <User className="w-4 h-4 text-green-500 dark:text-green-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{contact.contactNumber}
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
                      className={
                        contact.contactType === 'company'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      }
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

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

      <BulkDeleteModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        itemCount={selectedCount}
        itemLabel="contacts"
        isLoading={bulkDeleting}
      />
    </div>
  );
};
