import React from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';

export function ContactList() {
  const { openContactPanel } = useApp();

  const handleAddContact = () => {
    openContactPanel(null); // null = create mode
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <button
          onClick={handleAddContact}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </button>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No contacts yet. Click "Add Contact" to get started.</p>
      </div>
    </div>
  );
}
