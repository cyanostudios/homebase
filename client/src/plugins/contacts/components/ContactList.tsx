import { Mail, Phone, Building, User } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { GroupedList } from '@/core/ui/GroupedList';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useContacts } from '../hooks/useContacts';

type SortField = 'contactNumber' | 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export const ContactList: React.FC = () => {
  const { contacts, openContactForView, deleteContact } = useContacts();
  const { attemptNavigation } = useGlobalNavigationGuard();
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

  const [sortField] = useState<SortField>('contactNumber');
  const [sortOrder] = useState<SortOrder>('asc');

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

  // Protected navigation handlers
  const handleOpenForView = (contact: any) => attemptNavigation(() => openContactForView(contact));
  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search contacts..."
      />

      <Card className="shadow-none">
        <GroupedList
          items={sortedContacts}
          groupConfig={{
            getGroupKey: (contact) => contact.contactType || 'unknown',
            getGroupLabel: (groupKey) => {
              return groupKey === 'company' ? 'Company' : 'Private';
            },
            getGroupOrder: (groupKey) => {
              // Company first, then Private
              return groupKey === 'company' ? 0 : 1;
            },
            defaultOpen: true,
          }}
          emptyMessage={
            searchTerm
              ? 'No contacts found matching your search.'
              : 'No contacts yet. Click "Add Contact" to get started.'
          }
          renderItem={(contact, idx) => (
            <div
              key={contact.id}
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
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
              {/* Rad 1: Icon + Contact Number + Name + Badge */}
              <div className="flex items-center gap-2 mb-1.5">
                {contact.contactType === 'company' ? (
                  <Building className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                ) : (
                  <User className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                )}
                <div className="text-xs font-mono text-muted-foreground flex-shrink-0">
                  #{contact.contactNumber}
                </div>
                <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                  {contact.companyName}
                </div>
                <Badge
                  className={`flex-shrink-0 ${
                    contact.contactType === 'company'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  }`}
                >
                  {contact.contactType === 'company' ? 'Company' : 'Private'}
                </Badge>
              </div>

              {/* Rad 2: Email + Phone */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
                {contact.phone && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Phone className="w-3 h-3" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>

              {/* Rad 3: Organization Number / Personal Number / Website (optional) */}
              {(contact.organizationNumber ||
                (contact.contactType === 'private' && contact.personalNumber) ||
                contact.website) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {contact.contactType === 'company' && contact.organizationNumber && (
                    <span>Org: {contact.organizationNumber}</span>
                  )}
                  {contact.contactType === 'private' && contact.personalNumber && (
                    <span>PN: {contact.personalNumber.substring(0, 9)}XXXX</span>
                  )}
                  {contact.website && (
                    <span
                      className={contact.organizationNumber || contact.personalNumber ? ' • ' : ''}
                    >
                      {contact.website}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        />
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
    </div>
  );
};
