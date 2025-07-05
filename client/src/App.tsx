import React from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';

function AppContent() {
 const { isContactPanelOpen, currentContact, closeContactPanel } = useApp();

 const handleSaveContact = async (data: any) => {
   console.log('Saving contact:', data);
   // TODO: API call
   closeContactPanel();
 };

 return (
   <div className="min-h-screen bg-gray-50">
     <ContactList />
     
     <UniversalPanel
       isOpen={isContactPanelOpen}
       onClose={closeContactPanel}
       title={currentContact ? 'Edit Contact' : 'Create Contact'}
       subtitle={currentContact ? 'Update contact information' : 'Enter new contact details'}
     >
       <ContactForm
         onSave={handleSaveContact}
         onCancel={closeContactPanel}
       />
     </UniversalPanel>
   </div>
 );
}

function App() {
 return (
   <AppProvider>
     <AppContent />
   </AppProvider>
 );
}

export default App;
