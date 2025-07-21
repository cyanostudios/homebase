import React from 'react';
import { Building, User, MapPin, Phone, Mail, Globe, CreditCard, StickyNote } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { useApp } from '@/core/api/AppContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { Button } from '@/core/ui/Button';

interface ContactViewProps {
  contact: any;
}

export const ContactView: React.FC<ContactViewProps> = ({ contact }) => {
  // Use AppContext only for cross-plugin data fetching
  const { getNotesForContact } = useApp();
  
  // Use NoteContext for opening notes
  const { openNoteForView } = useNotes();
  
  // Use ContactContext to close contact panel when navigating to note
  const { closeContactPanel } = useContacts();
  
  if (!contact) return null;

  const mentionedInNotes = getNotesForContact(contact.id);

  return (
    <div className="space-y-4">
      

      {contact.contactType === 'private' && (
        <hr className="border-gray-100" />
      )}

      {/* Contact Details */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} size="lg" color="gray-600" className="mb-3">Contact Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contact.email && (
            <div>
              <Text variant="muted">Email</Text>
              <Text>{contact.email}</Text>
            </div>
          )}
          
          {contact.website && (
            <div>
              <Text variant="muted">Website</Text>
              <a 
                href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {contact.website}
              </a>
            </div>
          )}
          
          {contact.phone && (
            <div>
              <Text variant="muted">Phone 1</Text>
              <Text>{contact.phone}</Text>
            </div>
          )}
          
          {contact.phone2 && (
            <div>
              <Text variant="muted">Phone 2</Text>
              <Text>{contact.phone2}</Text>
            </div>
          )}
        </div>
      </Card>

      <hr className="border-gray-100" />

      {/* Addresses */}
      {contact.addresses && contact.addresses.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} size="lg" color="gray-600" className="mb-3">Addresses</Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {contact.addresses.map((address: any, index: number) => (
              <div key={address.id || index}>
                <div className="flex items-center gap-2 mb-2">
                  <Text className="font-medium">{address.type}</Text>
                </div>
                <div className="ml-0 space-y-1">
                  {address.addressLine1 && <Text>{address.addressLine1}</Text>}
                  {address.addressLine2 && <Text>{address.addressLine2}</Text>}
                  <Text>
                    {[address.postalCode, address.city].filter(Boolean).join(' ')}
                  </Text>
                  {address.region && <Text>{address.region}</Text>}
                  <Text>{address.country}</Text>
                  {address.email && (
                    <div className="mt-2">
                      <Text variant="caption">{address.email}</Text>
                    </div>
                  )}
                </div>
                {index < contact.addresses.length - 1 && (
                  <hr className="my-4 border-gray-100" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

  

      {/* Contact Persons */}
      {contact.contactType === 'company' && contact.contactPersons && contact.contactPersons.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} size="lg" color="gray-600" className="mb-3">Contact Persons</Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {contact.contactPersons.map((person: any, index: number) => (
              <div key={person.id || index}>
                <div className="flex items-center gap-2 mb-2">
                  <Text className="font-medium">{person.name}</Text>
                  {person.title && (
                    <span className="text-sm text-gray-500">• {person.title}</span>
                  )}
                </div>
                <div className="ml-0 space-y-1">
                  {person.email && (
                    <div>
                      <Text variant="caption">{person.email}</Text>
                    </div>
                  )}
                  {person.phone && (
                    <div>
                      <Text variant="caption">{person.phone}</Text>
                    </div>
                  )}
                </div>
                {index < contact.contactPersons.length - 1 && (
                  <hr className="my-4 border-gray-100" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <hr className="border-gray-100" />

      {/* Tax & Business Settings */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} size="lg" color="gray-600" className="mb-3">Business Settings</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Text variant="muted">Tax Rate</Text>
            <Text>{contact.taxRate}%</Text>
          </div>
          <div>
            <Text variant="muted">Payment Terms</Text>
            <Text>{contact.paymentTerms} days</Text>
          </div>
          <div>
            <Text variant="muted">Currency</Text>
            <Text>{contact.currency}</Text>
          </div>
          <div>
            <Text variant="muted">F-Tax</Text>
            <Text>{contact.fTax === 'yes' ? 'Yes' : 'No'}</Text>
          </div>
        </div>
      </Card>


      {/* Notes */}
      {contact.notes && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} size="lg" color="gray-600" className="mb-3">Notes</Heading>
          <Text>{contact.notes}</Text>
        </Card>
      )}

      <hr className="border-gray-100" />

      {/* Cross-plugin references - Mentioned in Notes */}
      {mentionedInNotes.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} size="lg" color="gray-600" className="mb-3">Mentioned in Notes</Heading>
            <div className="space-y-3">
              {mentionedInNotes.map((note: any) => (
                <div key={note.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <StickyNote className="w-4 h-4 text-yellow-600" />
                    <div>
                      <Text className="font-medium text-gray-900">{note.title}</Text>
                      <Text variant="caption" className="text-gray-600">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </Text>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      closeContactPanel(); // Close contact panel first
                      openNoteForView(note); // Then open note panel
                    }}
                    className="text-yellow-700 hover:text-yellow-800"
                  >
                    View Note
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <hr className="border-gray-100" />
        </>
      )}

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} size="lg" color="gray-600" className="mb-3">Record Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Text variant="muted">Created</Text>
            <Text>{new Date(contact.createdAt).toLocaleDateString()}</Text>
          </div>
          <div>
            <Text variant="muted">Last Updated</Text>
            <Text>{new Date(contact.updatedAt).toLocaleDateString()}</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};