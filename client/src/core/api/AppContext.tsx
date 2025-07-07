import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
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

  const openContactPanel = (contact: Contact | null) => {
    setCurrentContact(contact);
    setPanelMode(contact ? 'edit' : 'create');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
  };

  const openContactForEdit = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('edit');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
  };

  const openContactForView = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('view');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
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

  return (
    <AppContext.Provider value={{
      isContactPanelOpen,
      currentContact,
      panelMode,
      validationErrors,
      contacts,
      openContactPanel,
      openContactForEdit,
      openContactForView,
      closeContactPanel,
      saveContact,
      deleteContact,
      clearValidationErrors,
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