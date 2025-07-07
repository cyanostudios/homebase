import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Users, Mail, Phone, Edit, Trash2, Eye, Building, User, ChevronUp, ChevronDown } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

type SortField = 'contactNumber' | 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export const ContactList: React.FC = () => {
  const { contacts, openContactPanel, openContactForEdit, openContactForView, deleteContact } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
  }>({
    isOpen: false,
    contactId: '',
    contactName: ''
  });
  
  const [sortField, setSortField] = useState<SortField>('contactNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);

  // Check screen size for responsive view
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768); // md breakpoint
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
      setSortOrder('asc');
    }
  };

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      let aValue: string;
      let bValue: string;
      
      if (sortField === 'name') {
        aValue = a.companyName.toLowerCase();
        bValue = b.companyName.toLowerCase();
      } else if (sortField === 'type') {
        aValue = a.contactType;
        bValue = b.contactType;
      } else { // contactNumber
        aValue = a.contactNumber;
        bValue = b.contactNumber;
      }
      
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }, [contacts, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      contactId: id,
      contactName: name
    });
  };

  const confirmDelete = () => {
    deleteContact(deleteConfirm.contactId);
    setDeleteConfirm({
      isOpen: false,
      contactId: '',
      contactName: ''
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      contactId: '',
      contactName: ''
    });
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Contacts</Heading>
          <Text variant="caption">Manage your business contacts</Text>
        </div>
        <div className="flex sm:block">
          <Button
            onClick={() => openContactPanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add Contact
          </Button>
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('contactNumber')}
                >
                  <div className="flex items-center gap-1">
                    #
                    <SortIcon field="contactNumber" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    <SortIcon field="name" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-1">
                    Type
                    <SortIcon field="type" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email/Web
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No contacts yet. Click "Add Contact" to get started.
                  </td>
                </tr>
              ) : (
                sortedContacts.map((contact, idx) => (
                  <tr key={contact.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono font-medium text-gray-900">#{contact.contactNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {contact.contactType === 'company' ? (
                         <Building className="w-5 h-5 text-blue-500" />
                       ) : (
                         <User className="w-5 h-5 text-green-500" />
                       )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{contact.companyName}</div>
                          {contact.contactType === 'company' && contact.organizationNumber && (
                            <div className="text-xs text-gray-500">{contact.organizationNumber}</div>
                          )}
                          {contact.contactType === 'private' && contact.personalNumber && (
                            <div className="text-xs text-gray-500">{contact.personalNumber.substring(0, 9)}XXXX</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        contact.contactType === 'company' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {contact.contactType === 'company' ? 'Company' : 'Private'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="text-sm text-gray-900">{contact.email}</span>
                        {contact.website && (
                          <div className="text-xs text-gray-500">{contact.website}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{contact.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon={Eye}
                          onClick={() => openContactForView(contact)}
                        >
                          View
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={Edit}
                          onClick={() => openContactForEdit(contact)}
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
          /* Mobile Card View */
          <div className="divide-y divide-gray-200">
            {sortedContacts.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                No contacts yet. Click "Add Contact" to get started.
              </div>
            ) : (
              sortedContacts.map((contact) => (
                <div key={contact.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs font-mono font-medium text-gray-600">#{contact.contactNumber}</div>
                      {contact.contactType === 'company' ? (
                        <Building className="w-5 h-5 text-blue-500" />
                      ) : (
                        <User className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <h3 className="text-sm font-medium text-gray-900">{contact.companyName}</h3>
                      </div>
                      
                      {/* Contact details in mobile */}
                      <div className="space-y-1">
                        {contact.contactType === 'company' && contact.organizationNumber && (
                          <div className="text-xs text-gray-500">{contact.organizationNumber}</div>
                        )}
                        {contact.contactType === 'private' && contact.personalNumber && (
                          <div className="text-xs text-gray-500">{contact.personalNumber.substring(0, 9)}XXXX</div>
                        )}
                        {contact.email && (
                          <div className="text-xs text-gray-600">{contact.email}</div>
                        )}
                        {contact.website && (
                          <div className="text-xs text-gray-600">{contact.website}</div>
                        )}
                        {contact.phone && (
                          <div className="text-xs text-gray-600">{contact.phone}</div>
                        )}
                        
                        {/* Mobile actions under contact info */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            icon={Edit}
                            onClick={() => openContactForEdit(contact)}
                            className="flex-1 h-8"
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            icon={Eye}
                            onClick={() => openContactForView(contact)}
                            className="flex-1 h-8"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
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