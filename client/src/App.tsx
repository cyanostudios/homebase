import React from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { MainLayout } from '@/core/ui/MainLayout';
import { Button } from '@/core/ui/Button';
import { Check, X } from 'lucide-react';

function AppContent() {
  const { isContactPanelOpen, currentContact, closeContactPanel } = useApp();

  const handleSaveContact = async (data: any) => {
    console.log('Saving contact:', data);
    // TODO: API call
    closeContactPanel();
  };

  // Footer med knappar för ContactForm
  const contactFormFooter = (
    <div className="flex justify-end space-x-3">
      <Button
        type="button"
        onClick={closeContactPanel}
        variant="danger"
        icon={X}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        icon={Check}
        onClick={() => {
          // Trigger form submit - detta behöver förbättras med proper form handling
          console.log('Save clicked');
        }}
      >
        Save Contact
      </Button>
    </div>
  );

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
        footer={contactFormFooter}
      >
        <ContactForm
          onSave={handleSaveContact}
          onCancel={closeContactPanel}
        />
      </UniversalPanel>
    </>
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
