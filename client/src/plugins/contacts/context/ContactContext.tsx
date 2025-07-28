import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Contact, ValidationError } from '../types/contacts';
import { contactsApi } from '../api/contactsApi';
import { useApp } from '@/core/api/AppContext';

interface ContactContextType {
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
  saveContact: (contactData: any) => Promise<boolean>;
  deleteContact: (id: string) => Promise<void>;
  clearValidationErrors: () => void;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

interface ContactProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ContactProvider({ children, isAuthenticated, onCloseOtherPanels }: ContactProviderProps) {
  // ADDED: Get panel registration functions from AppContext
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  
  // Panel states
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadContacts();
    } else {
      setContacts([]);
    }
  }, [isAuthenticated]);

// FIXED: Remove dependency array to avoid infinite loops  
useEffect(() => {
  registerPanelCloseFunction('contacts', closeContactPanel);
  return () => {
    unregisterPanelCloseFunction('contacts');
  };
}, []); // Empty dependency array - only run once

  // ADDED: Global functions for form submission (required for global form handling)
  useEffect(() => {
    window.submitContactsForm = () => {
      // Trigger form submission event
      const event = new CustomEvent('submitContactForm');
      window.dispatchEvent(event);
    };

    window.cancelContactsForm = () => {
      // Trigger form cancel event
      const event = new CustomEvent('cancelContactForm');
      window.dispatchEvent(event);
    };

    // Cleanup
    return () => {
      delete window.submitContactsForm;
      delete window.cancelContactsForm;
    };
  }, []);

  const loadContacts = async () => {
    try {
      const contactsData = await contactsApi.getContacts();
      
      // Transform API data to match interface
      const transformedContacts = contactsData.map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt),
      }));

      setContacts(transformedContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  // Helper function to generate next contact number
  const generateNextContactNumber = (): string => {
    const existingNumbers = contacts.map(contact => parseInt(contact.contactNumber) || 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return nextNumber.toString().padStart(2, '0');
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
        contact.id !== currentContact?.id && 
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
      if (contactData.organizationNumber?.trim()) {
        const existingContact = contacts.find(contact => 
          contact.id !== currentContact?.id && 
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
      if (contactData.personalNumber?.trim()) {
        const existingContact = contacts.find(contact => 
          contact.id !== currentContact?.id && 
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
        contact.id !== currentContact?.id && 
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

  // Contact functions
  const openContactPanel = (contact: Contact | null) => {
    setCurrentContact(contact);
    setPanelMode(contact ? 'edit' : 'create');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openContactForEdit = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('edit');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openContactForView = (contact: Contact) => {
    setCurrentContact(contact);
    setPanelMode('view');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
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

  const saveContact = async (contactData: any): Promise<boolean> => {
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
    
    try {
      let savedContact: Contact;
      
      if (currentContact) {
        // Update existing contact
        savedContact = await contactsApi.updateContact(currentContact.id, contactData);
        setContacts(prev => prev.map(contact => 
          contact.id === currentContact.id ? {
            ...savedContact,
            createdAt: new Date(savedContact.createdAt),
            updatedAt: new Date(savedContact.updatedAt),
          } : contact
        ));
        setCurrentContact({
          ...savedContact,
          createdAt: new Date(savedContact.createdAt),
          updatedAt: new Date(savedContact.updatedAt),
        });
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        // Create new contact
        savedContact = await contactsApi.createContact(contactData);
        setContacts(prev => [...prev, {
          ...savedContact,
          createdAt: new Date(savedContact.createdAt),
          updatedAt: new Date(savedContact.updatedAt),
        }]);
        closeContactPanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save contact:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save contact. Please try again.' }]);
      return false;
    }
  };

  const deleteContact = async (id: string) => {
    console.log("Deleting contact with id:", id);
    try {
      await contactsApi.deleteContact(id);
      setContacts(prev => {
        const newContacts = prev.filter(contact => contact.id !== id);
        console.log("Contacts after delete:", newContacts);
        return newContacts;
      });
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const value: ContactContextType = {
    // Contact Panel State
    isContactPanelOpen,
    currentContact,
    panelMode,
    validationErrors,
    
    // Contacts Data
    contacts,
    
    // Contact Actions
    openContactPanel,
    openContactForEdit,
    openContactForView,
    closeContactPanel,
    saveContact,
    deleteContact,
    clearValidationErrors,
  };

  return (
    <ContactContext.Provider value={value}>
      {children}
    </ContactContext.Provider>
  );
}

export function useContactContext() {
  const context = useContext(ContactContext);
  if (context === undefined) {
    throw new Error('useContactContext must be used within a ContactProvider');
  }
  return context;
}