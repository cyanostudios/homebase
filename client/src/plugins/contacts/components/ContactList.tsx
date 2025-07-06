import React, { useState } from 'react';
import { Plus, Users, Mail, Phone, Edit, Trash2, Eye, Building, User } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

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
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Heading level={1}>Contacts</Heading>
          <Text variant="caption">Manage your business contacts</Text>
        </div>
        <Button
          onClick={() => openContactPanel(null)}
          variant="primary"
          icon={Plus}
        >
          Add Contact
        </Button>
      </div>

      <Card>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
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
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No contacts yet. Click "Add Contact" to get started.
                </td>
              </tr>
            ) : (
              contacts.map((contact, idx) => (
                <tr key={contact.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{contact.email}</span>
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
                      <Button 
                        variant="danger" 
                        size="sm" 
                        icon={Trash2}
                        onClick={() => handleDelete(contact.id, contact.companyName)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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