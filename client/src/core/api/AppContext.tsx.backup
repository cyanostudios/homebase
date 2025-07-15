import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Note } from '@/plugins/notes/types/notes';

interface Contact {
  id: string;
  contactNumber: string;
  contactType: 'company' | 'private';
  companyName: string;
  companyType?: string;
  organizationNumber?: string;
  vatNumber?: string;
  personalNumber?: string;
  contactPersons: any[];
  addresses: any[];
  email: string;
  phone: string;
  phone2: string;
  website: string;
  taxRate: string;
  paymentTerms: string;
  currency: string;
  fTax: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidationError {
  field: string;
  message: string;
}

interface AppContextType {
  // Contact Panel State
  isContactPanelOpen: boolean;
  currentContact: Contact | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  
  // Contacts Data
  contacts: Contact[];
  
  // Contact Actions
  openContactPanel: (contact: Contact | null) => void;
  openContactForEdit: (contact: Contact) => void;
  openContactForView: (contact: Contact) => void;
  closeContactPanel: () => void;
  saveContact: (contactData: any) => boolean;
  deleteContact: (id: string) => void;
  clearValidationErrors: () => void;

  // Note Panel State
  isNotePanelOpen: boolean;
  currentNote: Note | null;
  notePanelMode: 'create' | 'edit' | 'view';
  
  // Notes Data
  notes: Note[];
  
  // Note Actions
  openNotePanel: (note: Note | null) => void;
  openNoteForEdit: (note: Note) => void;
  openNoteForView: (note: Note) => void;
  closeNotePanel: () => void;
  saveNote: (noteData: any) => boolean;
  deleteNote: (id: string) => void;

  // Cross-plugin references
  getNotesForContact: (contactId: string) => Note[];
  getContactsForNote: (noteId: string) => Contact[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Notes state
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [notePanelMode, setNotePanelMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Initial dummy data with contact numbers
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      contactNumber: '01',
      contactType: 'company',
      companyName: 'Acme Corporation',
      companyType: 'AB',
      organizationNumber: '556123-4567',
      vatNumber: 'SE556123456701',
      personalNumber: '',
      contactPersons: [
        {
          id: '1',
          name: 'John Smith',
          title: 'CEO',
          email: 'john@acme.com',
          phone: '+46 70 123 45 67'
        }
      ],
      addresses: [
        {
          id: '1',
          type: 'Main Office',
          addressLine1: 'Storgatan 123',
          addressLine2: '',
          postalCode: '111 22',
          city: 'Stockholm',
          region: 'Stockholm',
          country: 'Sweden'
        }
      ],
      email: 'info@acme.com',
      phone: '+46 8 123 456 78',
      phone2: '+46 70 123 45 67',
      website: 'https://acme.com',
      taxRate: '25',
      paymentTerms: '30',
      currency: 'SEK',
      fTax: 'yes',
      notes: 'Important client with multiple projects',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '2',
      contactNumber: '02',
      contactType: 'private',
      companyName: 'Jane Cooper',
      personalNumber: '19851201-1234',
      companyType: '',
      organizationNumber: '',
      vatNumber: '',
      contactPersons: [],
      addresses: [
        {
          id: '1',
          type: 'Home Address',
          addressLine1: 'Hemgatan 45',
          addressLine2: 'Lägenhet 3B',
          postalCode: '211 34',
          city: 'Malmö',
          region: 'Skåne',
          country: 'Sweden'
        }
      ],
      email: 'jane.cooper@example.com',
      phone: '+46 70 987 65 43',
      phone2: '',
      website: '',
      taxRate: '25',
      paymentTerms: '30',
      currency: 'SEK',
      fTax: 'no',
      notes: '',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02')
    }
  ]);

  // Initial dummy notes with mentions
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      title: 'Project Meeting Notes',
      content: 'Discussed the new project requirements with the team. Key points:\n\n- Budget: $50,000\n- Timeline: 3 months\n- Team size: 4 developers\n- Technology stack: React, Node.js, PostgreSQL\n\nNext steps:\n1. Create detailed project plan\n2. Set up development environment\n3. Schedule weekly standup meetings\n\nWe should reach out to @Acme Corporation for additional requirements.',
      mentions: [
        {
          contactId: '1',
          contactName: 'Acme Corporation',
          companyName: 'Acme Corporation',
          position: 298,
          length: 16
        }
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02')
    },
    {
      id: '2',
      title: 'Ideas for Marketing Campaign',
      content: 'Brainstorming session for Q2 marketing campaign:\n\n- Social media focus on LinkedIn and Twitter\n- Content marketing with weekly blog posts\n- Webinar series on industry trends\n- Partnership with tech influencers\n\nBudget allocation:\n- Social media ads: 40%\n- Content creation: 30%\n- Webinars: 20%\n- Influencer partnerships: 10%\n\nNote: @Jane Cooper mentioned she has contacts in the industry that could help with influencer partnerships.',
      mentions: [
        {
          contactId: '2',
          contactName: 'Jane Cooper',
          position: 392,
          length: 12
        }
      ],
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03')
    }
  ]);

  // Helper function to generate next contact number
  const generateNextContactNumber = (): string => {
    const existingNumbers = contacts.map(contact => parseInt(contact.contactNumber) || 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return nextNumber.toString().padStart(2, '0'); // Format as 01, 02, etc.
  };

  const validateContact = (contactData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Contact number validation
    if (!contactData.contactNumber?.trim()) {
      errors.push({
        field: 'contactNumber',
        message: 'Contact number is required'
      });
    } else {
      // Check for duplicate contact numbers
      const existingContact = contacts.find(contact => 
        contact.id !== currentContact?.id && // Exclude current contact when editing
        contact.contactNumber === contactData.contactNumber.trim()
      );
      
      if (existingContact) {
        errors.push({
          field: 'contactNumber',
          message: `Contact number "${contactData.contactNumber}" already exists for "${existingContact.companyName}"`
        });
      }
    }
    
    // Required fields
    if (!contactData.companyName?.trim()) {
      errors.push({
        field: 'companyName',
        message: contactData.contactType === 'company' ? 'Company name is required' : 'Full name is required'
      });
    }
    
    // Company validations
    if (contactData.contactType === 'company') {
      // Organization number validation
      if (contactData.organizationNumber?.trim()) {
        const existingContact = contacts.find(contact => 
          contact.id !== currentContact?.id && // Exclude current contact when editing
          contact.contactType === 'company' &&
          contact.organizationNumber === contactData.organizationNumber.trim()
        );
        
        if (existingContact) {
          errors.push({
            field: 'organizationNumber',
            message: `Organization number already exists for "${existingContact.companyName}"`
          });
        }
      }
    }
    
    // Private person validations
    if (contactData.contactType === 'private') {
      // Personal number validation
      if (contactData.personalNumber?.trim()) {
        const existingContact = contacts.find(contact => 
          contact.id !== currentContact?.id && // Exclude current contact when editing
          contact.contactType === 'private' &&
          contact.personalNumber === contactData.personalNumber.trim()
        );
        
        if (existingContact) {
          errors.push({
            field: 'personalNumber',
            message: `Personal number already exists for "${existingContact.companyName}"`
          });
        }
      }
    }
    
    // Email validation (warning, not blocking)
    if (contactData.email?.trim()) {
      const existingContact = contacts.find(contact => 
        contact.id !== currentContact?.id && // Exclude current contact when editing
        contact.email === contactData.email.trim()
      );
      
      if (existingContact) {
        errors.push({
          field: 'email',
          message: `Email already exists for "${existingContact.companyName}" (Warning)`
        });
      }
    }
    
    return errors;
  };

  const validateNote = (noteData: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Title validation
    if (!noteData.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Note title is required'
      });
    }
    
    // Content validation
    if (!noteData.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Note content is required'
      });
    }
    
    return errors;
  };

  // Contact functions
  const openContactPanel = (contact: Contact | null) => {
    setCurrentContact(contact);
    setPanelMode(contact ? 'edit' : 'create');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    // Close note panel if open
    setIsNotePanelOpen(false);
  };

  const openContactForEdit = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('edit');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    // Close note panel if open
    setIsNotePanelOpen(false);
  };

  const openContactForView = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('view');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    // Close note panel if open
    setIsNotePanelOpen(false);
  };

  const closeContactPanel = () => {
    setIsContactPanelOpen(false);
    setCurrentContact(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveContact = (contactData: any): boolean => {
    console.log('Validating contact data:', contactData);
    
    // Auto-generate contact number for new contacts if not provided
    if (!currentContact && !contactData.contactNumber?.trim()) {
      contactData.contactNumber = generateNextContactNumber();
    }
    
    // Run validation
    const errors = validateContact(contactData);
    setValidationErrors(errors);
    
    // If there are blocking errors, don't save
    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }
    
    // Save the contact
    let savedContact: Contact;
    if (currentContact) {
      // Update existing contact
      savedContact = { ...contactData, id: currentContact.id, updatedAt: new Date() };
      setContacts(prev => prev.map(contact => 
        contact.id === currentContact.id ? savedContact : contact
      ));
      // Stay in view mode after edit
      setCurrentContact(savedContact);
      setPanelMode('view');
      setValidationErrors([]);
    } else {
      // Create new contact
      savedContact = {
        ...contactData,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setContacts(prev => [...prev, savedContact]);
      // Close panel after create
      closeContactPanel();
    }
    
    return true;
  };

  const deleteContact = (id: string) => {
    console.log("Deleting contact with id:", id);
    setContacts(prev => {
      const newContacts = prev.filter(contact => contact.id !== id);
      console.log("Contacts after delete:", newContacts);
      return newContacts;
    });
  };

  // Note functions
  const openNotePanel = (note: Note | null) => {
    setCurrentNote(note);
    setNotePanelMode(note ? 'edit' : 'create');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    // Close contact panel if open
    setIsContactPanelOpen(false);
  };

  const openNoteForEdit = (note: Note) => {
    setCurrentNote(note);
    setNotePanelMode('edit');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    // Close contact panel if open
    setIsContactPanelOpen(false);
  };

  const openNoteForView = (note: Note) => {
    setCurrentNote(note);
    setNotePanelMode('view');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    // Close contact panel if open
    setIsContactPanelOpen(false);
  };

  const closeNotePanel = () => {
    setIsNotePanelOpen(false);
    setCurrentNote(null);
    setNotePanelMode('create');
    setValidationErrors([]);
  };

  const saveNote = (noteData: any): boolean => {
    console.log('Validating note data:', noteData);
    
    // Run validation
    const errors = validateNote(noteData);
    setValidationErrors(errors);
    
    // If there are blocking errors, don't save
    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }
    
    // Save the note
    let savedNote: Note;
    if (currentNote) {
      // Update existing note
      savedNote = { 
        ...noteData, 
        id: currentNote.id, 
        updatedAt: new Date(), 
        createdAt: currentNote.createdAt,
        mentions: noteData.mentions || []
      };
      setNotes(prev => prev.map(note => 
        note.id === currentNote.id ? savedNote : note
      ));
      // Stay in view mode after edit
      setCurrentNote(savedNote);
      setNotePanelMode('view');
      setValidationErrors([]);
    } else {
      // Create new note
      savedNote = {
        ...noteData,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        mentions: noteData.mentions || []
      };
      setNotes(prev => [...prev, savedNote]);
      // Close panel after create
      closeNotePanel();
    }
    
    return true;
  };

  const deleteNote = (id: string) => {
    console.log("Deleting note with id:", id);
    setNotes(prev => {
      const newNotes = prev.filter(note => note.id !== id);
      console.log("Notes after delete:", newNotes);
      return newNotes;
    });
  };

  // Cross-plugin reference functions
  const getNotesForContact = (contactId: string): Note[] => {
    return notes.filter(note => 
      note.mentions && note.mentions.some(mention => mention.contactId === contactId)
    );
  };

  const getContactsForNote = (noteId: string): Contact[] => {
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.mentions) return [];
    
    return note.mentions.map(mention => 
      contacts.find(contact => contact.id === mention.contactId)
    ).filter(Boolean) as Contact[];
  };

  return (
    <AppContext.Provider value={{
      // Contact state
      isContactPanelOpen,
      currentContact,
      panelMode,
      validationErrors,
      contacts,
      // Contact actions
      openContactPanel,
      openContactForEdit,
      openContactForView,
      closeContactPanel,
      saveContact,
      deleteContact,
      clearValidationErrors,
      // Note state
      isNotePanelOpen,
      currentNote,
      notePanelMode,
      notes,
      // Note actions
      openNotePanel,
      openNoteForEdit,
      openNoteForView,
      closeNotePanel,
      saveNote,
      deleteNote,
      // Cross-plugin references
      getNotesForContact,
      getContactsForNote,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}