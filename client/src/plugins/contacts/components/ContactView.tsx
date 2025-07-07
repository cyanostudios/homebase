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
      
      {/* Contact Type & Basic Info - Mobile Optimized */}
      <Card padding="md" className="shadow-none">
        {/* Mobile/Desktop responsive header */}
        <div className="space-y-3 md:space-y-0">
          {/* Row 1: Contact Number + Type */}
          <div className="flex items-center gap-3">
            <div className="text-sm font-mono font-medium text-gray-600">#{contact.contactNumber}</div>
            {contact.contactType === 'company' ? (
              <Building className="w-5 h-5 text-blue-600" />
            ) : (
              <User className="w-5 h-5 text-green-600" />
            )}
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              contact.contactType === 'company' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {contact.contactType === 'company' ? 'Company' : 'Private Person'}
            </span>
          </div>
          
          {/* Row 2: Name + Company Type (if applicable) */}
          <div className="py-2">
            <Heading level={2} className="text-xl md:text-2xl">
              {contact.companyName}
              {contact.contactType === 'company' && contact.companyType && (
                <span className="text-gray-600 font-normal"> ({contact.companyType})</span>
              )}
            </Heading>
          </div>
          
          {/* Row 3: Organization/Personal Number */}
          {contact.contactType === 'company' && contact.organizationNumber && (
            <div>
              <Text className="text-base font-medium text-gray-700">{contact.organizationNumber}</Text>
            </div>
          )}
          {contact.contactType === 'private' && contact.personalNumber && (
            <div>
              <Text className="text-base font-medium text-gray-700">{contact.personalNumber}</Text>
            </div>
          )}
        </div>

        {/* VAT Number for companies */}
        {contact.contactType === 'company' && contact.vatNumber && (
          <div className="mt-3">
            <div>
              <Text variant="muted">VAT Number</Text>
              <Text>{contact.vatNumber}</Text>
            </div>
          </div>
        )}
      </Card>

      {contact.contactType === 'company' && contact.vatNumber && (
        <hr className="border-gray-100" />
      )}

      {contact.contactType === 'private' && (
        <hr className="border-gray-100" />
      )}

      {/* Contact Details */}
      <Card padding="md" className="shadow-none">
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
              <Text>{contact.website}</Text>
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
        <Card padding="md" className="shadow-none">
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

      <hr className="border-gray-100" />

      {/* Contact Persons */}
      {contact.contactType === 'company' && contact.contactPersons && contact.contactPersons.length > 0 && (
        <Card padding="md" className="shadow-none">
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
      <Card padding="md" className="shadow-none">
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

      <hr className="border-gray-100" />

      {/* Notes */}
      {contact.notes && (
        <Card padding="md" className="shadow-none">
          <Heading level={3} size="lg" color="gray-600" className="mb-3">Notes</Heading>
          <Text>{contact.notes}</Text>
        </Card>
      )}

      <hr className="border-gray-100" />

      {/* Metadata */}
      <Card padding="md" className="shadow-none">
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