import React from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { MainLayout } from '@/core/ui/MainLayout';

function AppContent() {
 console.log('AppContent rendering...');
 
 try {
   const { isContactPanelOpen, currentContact, closeContactPanel } = useApp();
   console.log('Context loaded, panel open:', isContactPanelOpen);

   const handleSaveContact = async (data: any) => {
     console.log('Saving contact:', data);
     closeContactPanel();
   };

   return (
     <>
       <MainLayout>
         <ContactList />
       </MainLayout>
       
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
     </>
   );
 } catch (error) {
   console.error('AppContent error:', error);
   return <div>Error in AppContent: {String(error)}</div>;
 }
}

function App() {
 console.log('App rendering...');
 
 try {
   return (
     <AppProvider>
       <AppContent />
     </AppProvider>
   );
 } catch (error) {
   console.error('App error:', error);
   return <div>Error in App: {String(error)}</div>;
 }
}

export default App;
