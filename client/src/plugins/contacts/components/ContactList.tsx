import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Upload, Users, Mail, Phone, Edit, Trash2, Eye, Building, User, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useContacts } from '../hooks/useContacts';
import { useImport } from '@/plugins/import/hooks/useImport';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

type SortField = 'contactNumber' | 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export const ContactList: React.FC = () => {
  const { contacts, openContactPanel, openContactForEdit, openContactForView, deleteContact } = useContacts();
  const { openImportPanel } = useImport();
  const [searchTerm, setSearchTerm] = useState('');
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
    const filtered = contacts.filter(contact => 
      contact.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.contactNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.organizationNumber && contact.organizationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.personalNumber && contact.personalNumber.toLowerCase().includes(searchTerm.toLowerCase()))
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
  }, [contacts, searchTerm, sortField, sortOrder]);

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

  const handleImportClick = () => {
    openImportPanel(null);
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Contacts</Heading>
          <Text variant="caption">Manage your business contacts</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Search Controls */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleImportClick}
              variant="secondary"
              icon={Upload}
            >
              Import
            </Button>
            <Button
              onClick={() => openContactPanel(null)}
              variant="primary"
              icon={Plus}
            >
              Add Contact
            </Button>
          </div>
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
                    {searchTerm ? 'No contacts found matching your search.' : 'No contacts yet. Click "Add Contact" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedContacts.map((contact, idx) => (
                  <tr 
                    key={contact.id} 
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                    tabIndex={0}
                    data-list-item={JSON.stringify(contact)}
                    data-plugin-name="contacts"
                    role="button"
                    aria-label={`Open contact ${contact.companyName}`}
                    onClick={() => openContactForView(contact)}
                  >
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
                {searchTerm ? 'No contacts found matching your search.' : 'No contacts yet. Click "Add Contact" to get started.'}
              </div>
            ) : (
              sortedContacts.map((contact) => (
                <div key={contact.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs font-mono font-medium text-gray-600">#{contact.contactNumber}</div>
                      {contact.contactType === 'company' ? (
                        <Building className="w-4 h-4 text-blue-500" />
                      ) : (
                        <User className="w-4 h-4 text-green-500" />
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
                      </div>
                    </div>
                    {/* View button in top right */}
                    <div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Eye}
                        onClick={() => openContactForView(contact)}
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