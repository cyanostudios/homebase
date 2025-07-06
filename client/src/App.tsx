import React from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { MainLayout } from '@/core/ui/MainLayout';
import { Button } from '@/core/ui/Button';
import { Check, X, Edit } from 'lucide-react';

function AppContent() {
  const { 
    isContactPanelOpen, 
    currentContact, 
    panelMode, 
    closeContactPanel, 
    saveContact,
    openContactForEdit,
    openContactForView,
    validationErrors
  } = useApp();

  const handleSaveContact = async (data: any) => {
    console.log('Saving contact:', data);
    return saveContact(data);
  };

  const handleCancel = () => {
    if (panelMode === 'edit' && currentContact) {
      // Return to view mode instead of closing
      openContactForView(currentContact);
    } else {
      // Close panel for create mode
      closeContactPanel();
    }
  };

  const handleSaveClick = () => {
    // Trigger the form submission via global function
    if (window.submitContactForm) {
      window.submitContactForm();
    }
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  // Different footers based on panel mode
  const getFooter = () => {
    if (panelMode === 'view') {
      return (
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            onClick={closeContactPanel}
            variant="secondary"
            icon={X}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => currentContact && openContactForEdit(currentContact)}
            variant="primary"
            icon={Edit}
          >
            Edit Contact
          </Button>
        </div>
      );
    }

    // Form mode (create/edit)
    return (
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          onClick={() => { if (window.cancelContactForm) window.cancelContactForm(); }}
          variant="danger"
          icon={X}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSaveClick}
          variant="primary"
          icon={Check}
          disabled={hasBlockingErrors}
        >
          {panelMode === 'edit' ? 'Update Contact' : 'Save Contact'}
        </Button>
      </div>
    );
  };

  const getPanelTitle = () => {
    switch (panelMode) {
      case 'view': return 'View Contact';
      case 'edit': return 'Edit Contact';
      case 'create': return 'Create Contact';
      default: return 'Contact';
    }
  };

  const getPanelSubtitle = () => {
    switch (panelMode) {
      case 'view': return 'Contact information';
      case 'edit': return 'Update contact information';
      case 'create': return 'Enter new contact details';
      default: return '';
    }
  };

  return (
    <>
      <MainLayout>
        <ContactList />
      </MainLayout>
      
      <UniversalPanel
        isOpen={isContactPanelOpen}
        onClose={() => { if (window.cancelContactForm) window.cancelContactForm(); else closeContactPanel(); }}
        title={getPanelTitle()}
        subtitle={getPanelSubtitle()}
        footer={getFooter()}
      >
        {panelMode === 'view' ? (
          <ContactView contact={currentContact} />
        ) : (
          <ContactForm
            currentContact={currentContact}
            onSave={handleSaveContact}
            onCancel={handleCancel}
          />
        )}
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
