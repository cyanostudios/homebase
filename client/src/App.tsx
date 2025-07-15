import React, { useState } from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { TopBar } from '@/core/ui/TopBar';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { ContactList } from '@/plugins/contacts/components/ContactList';
import { ContactForm } from '@/plugins/contacts/components/ContactForm';
import { ContactView } from '@/plugins/contacts/components/ContactView';
import { NotesList } from '@/plugins/notes/components/NotesList';
import { NoteForm } from '@/plugins/notes/components/NoteForm';
import { NoteView } from '@/plugins/notes/components/NoteView';
import { MainLayout } from '@/core/ui/MainLayout';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { Button } from '@/core/ui/Button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Check, X, Edit, Trash2 } from 'lucide-react';

function AppContent() {
  const { 
    // Auth state
    isAuthenticated,
    isLoading,
    // Contact state
    isContactPanelOpen, 
    currentContact, 
    panelMode, 
    closeContactPanel, 
    saveContact,
    openContactForEdit,
    openContactForView,
    deleteContact,
    validationErrors,
    // Note state
    isNotePanelOpen,
    currentNote,
    notePanelMode,
    closeNotePanel,
    saveNote,
    openNoteForEdit,
    openNoteForView,
    deleteNote
  } = useApp();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState<'contacts' | 'notes'>('contacts');

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Determine which panel is open and what type of item we're dealing with
  const isAnyPanelOpen = isContactPanelOpen || isNotePanelOpen;
  const isContact = isContactPanelOpen;
  const isNote = isNotePanelOpen;
  const currentItem = isContact ? currentContact : currentNote;
  const currentMode = isContact ? panelMode : notePanelMode;

  const handleDeleteItem = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (isContact && currentContact) {
      await deleteContact(currentContact.id);
      closeContactPanel();
    } else if (isNote && currentNote) {
      await deleteNote(currentNote.id);
      closeNotePanel();
    }
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleSaveContact = async (data: any) => {
    console.log('Saving contact:', data);
    return await saveContact(data);
  };

  const handleSaveNote = async (data: any) => {
    console.log('Saving note:', data);
    return await saveNote(data);
  };

  const handleCancel = () => {
    if (isContact) {
      if (panelMode === 'edit' && currentContact) {
        // Return to view mode instead of closing
        openContactForView(currentContact);
      } else {
        // Close panel for create mode
        closeContactPanel();
      }
    } else if (isNote) {
      if (notePanelMode === 'edit' && currentNote) {
        // Return to view mode instead of closing
        openNoteForView(currentNote);
      } else {
        // Close panel for create mode
        closeNotePanel();
      }
    }
  };

  const handleSaveClick = () => {
    // Trigger the form submission via global function
    if (isContact && window.submitContactForm) {
      window.submitContactForm();
    } else if (isNote && window.submitNoteForm) {
      window.submitNoteForm();
    }
  };

  const handleCancelClick = () => {
    if (isContact && window.cancelContactForm) {
      window.cancelContactForm();
    } else if (isNote && window.cancelNoteForm) {
      window.cancelNoteForm();
    } else {
      handleCancel();
    }
  };

  const handleClosePanel = () => {
    if (isContact) {
      closeContactPanel();
    } else if (isNote) {
      closeNotePanel();
    }
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  // Different footers based on panel mode
  const getFooter = () => {
    if (currentMode === 'view') {
      return (
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            onClick={handleDeleteItem}
            variant="danger"
            icon={Trash2}
          >
            Delete
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleClosePanel}
              variant="secondary"
              icon={X}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (isContact && currentContact) {
                  openContactForEdit(currentContact);
                } else if (isNote && currentNote) {
                  openNoteForEdit(currentNote);
                }
              }}
              variant="primary"
              icon={Edit}
            >
              Edit
            </Button>
          </div>
        </div>
      );
    }

    // Form mode (create/edit)
    return (
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          onClick={handleCancelClick}
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
          {currentMode === 'edit' ? 'Update' : 'Save'}
        </Button>
      </div>
    );
  };

  const getPanelTitle = () => {
    const itemType = isContact ? 'Contact' : 'Note';
    switch (currentMode) {
      case 'view': return `View ${itemType}`;
      case 'edit': return `Edit ${itemType}`;
      case 'create': return `Create ${itemType}`;
      default: return itemType;
    }
  };

  const getPanelSubtitle = () => {
    const itemType = isContact ? 'contact' : 'note';
    switch (currentMode) {
      case 'view': return `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} information`;
      case 'edit': return `Update ${itemType} information`;
      case 'create': return `Enter new ${itemType} details`;
      default: return '';
    }
  };

  const getDeleteMessage = () => {
    if (isContact && currentContact) {
      return `Are you sure you want to delete "${currentContact.companyName}"? This action cannot be undone.`;
    } else if (isNote && currentNote) {
      return `Are you sure you want to delete "${currentNote.title}"? This action cannot be undone.`;
    }
    return "Are you sure you want to delete this item? This action cannot be undone.";
  };

  return (
    <MainLayout currentPage={currentPage} onPageChange={setCurrentPage}>
      <div className="h-full flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto">
          {currentPage === 'contacts' ? <ContactList /> : <NotesList />}
        </div>
      </div>
      
      <UniversalPanel
        isOpen={isAnyPanelOpen}
        onClose={handleCancelClick}
        title={getPanelTitle()}
        subtitle={getPanelSubtitle()}
        footer={getFooter()}
      >
        {isContact && (
          <>
            {currentMode === 'view' ? (
              <ContactView contact={currentContact} />
            ) : (
              <ContactForm
                currentContact={currentContact}
                onSave={handleSaveContact}
                onCancel={handleCancel}
              />
            )}
          </>
        )}
        {isNote && (
          <>
            {currentMode === 'view' ? (
              <NoteView note={currentNote} />
            ) : (
              <NoteForm
                currentNote={currentNote}
                onSave={handleSaveNote}
                onCancel={handleCancel}
              />
            )}
          </>
        )}
      </UniversalPanel>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={`Delete ${isContact ? 'Contact' : 'Note'}`}
        message={getDeleteMessage()}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </MainLayout>
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