import React from 'react';
import { Plus, Users, Mail, Phone } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

// Dummy data for demonstration (replace with real data source)
const contacts = [
  { id: 1, name: 'Jane Cooper', email: 'jane.cooper@example.com', phone: '+1 555-123-4567' },
  { id: 2, name: 'John Smith', email: 'john.smith@example.com', phone: '+1 555-987-6543' },
  { id: 3, name: 'Alice Johnson', email: 'alice.johnson@example.com', phone: '+1 555-222-3333' },
];

export const ContactList: React.FC = () => {
  const { openContactPanel } = useApp();

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
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  No contacts yet. Click "Add Contact" to get started.
                </td>
              </tr>
            ) : (
              contacts.map((contact, idx) => (
                <tr key={contact.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-900">{contact.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-900">{contact.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-900">{contact.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm">View</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
