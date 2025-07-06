import React from 'react';
import { Building, User, MapPin, Phone, Mail, Globe, CreditCard } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

interface ContactViewProps {
  contact: any;
}

export const ContactView: React.FC<ContactViewProps> = ({ contact }) => {
  if (!contact) return null;

  return (
    <div className="p-6 space-y-4">
      
      {/* Contact Type & Basic Info */}
      <Card padding="md">
        <div className="flex items-center gap-3 mb-4">
          {contact.contactType === 'company' ? (
            <Building className="w-6 h-6 text-blue-600" />
          ) : (
            <User className="w-6 h-6 text-green-600" />
          )}
          <div>
            <Heading level={2}>{contact.companyName}</Heading>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              contact.contactType === 'company' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {contact.contactType === 'company' ? 'Company' : 'Private Person'}
            </span>
          </div>
        </div>

        {contact.contactType === 'company' ? (
          <div className="grid grid-cols-2 gap-4">
            {contact.companyType && (
              <div>
                <Text variant="muted">Company Type</Text>
                <Text>{contact.companyType}</Text>
              </div>
            )}
            {contact.organizationNumber && (
              <div>
                <Text variant="muted">Organization Number</Text>
                <Text>{contact.organizationNumber}</Text>
              </div>
            )}
            {contact.vatNumber && (
              <div>
                <Text variant="muted">VAT Number</Text>
                <Text>{contact.vatNumber}</Text>
              </div>
            )}
          </div>
        ) : (
          contact.personalNumber && (
            <div>
              <Text variant="muted">Personal Number</Text>
              <Text>{contact.personalNumber}</Text>
            </div>
          )
        )}
      </Card>

      {/* Contact Details */}
      <Card padding="md">
        <Heading level={3} className="mb-3">Contact Information</Heading>
        <div className="grid grid-cols-2 gap-4">
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <div>
                <Text variant="muted">Email</Text>
                <Text>{contact.email}</Text>
              </div>
            </div>
          )}
          
          {contact.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <div>
                <Text variant="muted">Website</Text>
                <Text>{contact.website}</Text>
              </div>
            </div>
          )}
          
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <Text variant="muted">Phone 1</Text>
                <Text>{contact.phone}</Text>
              </div>
            </div>
          )}
          
          {contact.phone2 && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <Text variant="muted">Phone 2</Text>
                <Text>{contact.phone2}</Text>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Addresses */}
      {contact.addresses && contact.addresses.length > 0 && (
        <Card padding="md">
          <Heading level={3} className="mb-3">Addresses</Heading>
          <div className="space-y-4">
            {contact.addresses.map((address: any, index: number) => (
              <div key={address.id || index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <Text className="font-medium">{address.type}</Text>
                </div>
                <div className="ml-6 space-y-1">
                  {address.addressLine1 && <Text>{address.addressLine1}</Text>}
                  {address.addressLine2 && <Text>{address.addressLine2}</Text>}
                  <Text>
                    {[address.postalCode, address.city].filter(Boolean).join(' ')}
                  </Text>
                  {address.region && <Text>{address.region}</Text>}
                  <Text>{address.country}</Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contact Persons */}
      {contact.contactType === 'company' && contact.contactPersons && contact.contactPersons.length > 0 && (
        <Card padding="md">
          <Heading level={3} className="mb-3">Contact Persons</Heading>
          <div className="space-y-4">
            {contact.contactPersons.map((person: any, index: number) => (
              <div key={person.id || index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <Text className="font-medium">{person.name}</Text>
                  {person.title && (
                    <span className="text-sm text-gray-500">• {person.title}</span>
                  )}
                </div>
                <div className="ml-6 space-y-1">
                  {person.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <Text variant="caption">{person.email}</Text>
                    </div>
                  )}
                  {person.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <Text variant="caption">{person.phone}</Text>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tax & Business Settings */}
      <Card padding="md">
        <Heading level={3} className="mb-3">Business Settings</Heading>
        <div className="grid grid-cols-2 gap-4">
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
        <Card padding="md">
          <Heading level={3} className="mb-3">Notes</Heading>
          <Text>{contact.notes}</Text>
        </Card>
      )}

      {/* Metadata */}
      <Card padding="md">
        <Heading level={3} className="mb-3">Record Information</Heading>
        <div className="grid grid-cols-2 gap-4">
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
