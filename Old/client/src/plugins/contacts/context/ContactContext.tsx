import { Building, User } from 'lucide-react';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { useApp } from '@/core/api/AppContext';
import { Badge } from '@/core/ui/Badge';

import { contactsApi } from '../api/contactsApi';
import { Contact, ValidationError } from '../types/contacts';

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

  // Panel Title helpers
  getPanelTitle: (mode: string, item: Contact | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Contact | null) => any;
  getDeleteMessage: (item: Contact | null) => string;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

interface ContactProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ContactProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ContactProviderProps) {
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

  // Register a global close function for this panel once
  useEffect(() => {
    registerPanelCloseFunction('contacts', closeContactPanel);
    return () => {
      unregisterPanelCloseFunction('contacts');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global functions for form submission (dispatch events)
  useEffect(() => {
    (window as any).submitContactsForm = () => {
      const event = new CustomEvent('submitContactForm');
      window.dispatchEvent(event);
    };

    (window as any).cancelContactsForm = () => {
      const event = new CustomEvent('cancelContactForm');
      window.dispatchEvent(event);
    };

    return () => {
      delete (window as any).submitContactsForm;
      delete (window as any).cancelContactsForm;
    };
  }, []);

  const loadContacts = async () => {
    try {
      const contactsData = await contactsApi.getContacts();
      const transformedContacts: Contact[] = contactsData.map((contact: any) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
        updatedAt: new Date(contact.updatedAt),
      }));
      setContacts(transformedContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  // Helper: next contact number
  const generateNextContactNumber = (): string => {
    const existingNumbers = contacts.map((contact) => parseInt(contact.contactNumber, 10) || 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return nextNumber.toString().padStart(2, '0');
  };

  const validateContact = (contactData: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Contact number
    if (!contactData.contactNumber?.trim()) {
      errors.push({
        field: 'contactNumber',
        message: 'Contact number is required',
      });
    } else {
      const existingContact = contacts.find(
        (c) => c.id !== currentContact?.id && c.contactNumber === contactData.contactNumber.trim(),
      );
      if (existingContact) {
        errors.push({
          field: 'contactNumber',
          message: `Contact number "${contactData.contactNumber}" already exists for "${existingContact.companyName}"`,
        });
      }
    }

    // Required name (company or full name stored in companyName)
    if (!contactData.companyName?.trim()) {
      errors.push({
        field: 'companyName',
        message:
          contactData.contactType === 'company'
            ? 'Company name is required'
            : 'Full name is required',
      });
    }

    // Company validations
    if (contactData.contactType === 'company' && contactData.organizationNumber?.trim()) {
      const dup = contacts.find(
        (c) =>
          c.id !== currentContact?.id &&
          c.contactType === 'company' &&
          c.organizationNumber === contactData.organizationNumber.trim(),
      );
      if (dup) {
        errors.push({
          field: 'organizationNumber',
          message: `Organization number already exists for "${dup.companyName}"`,
        });
      }
    }

    // Private person validations
    if (contactData.contactType === 'private' && contactData.personalNumber?.trim()) {
      const dup = contacts.find(
        (c) =>
          c.id !== currentContact?.id &&
          c.contactType === 'private' &&
          c.personalNumber === contactData.personalNumber.trim(),
      );
      if (dup) {
        errors.push({
          field: 'personalNumber',
          message: `Personal number already exists for "${dup.companyName}"`,
        });
      }
    }

    // Email (warning)
    if (contactData.email?.trim()) {
      const dup = contacts.find(
        (c) => c.id !== currentContact?.id && c.email === contactData.email.trim(),
      );
      if (dup) {
        errors.push({
          field: 'email',
          message: `Email already exists for "${dup.companyName}" (Warning)`,
        });
      }
    }

    return errors;
  };

  // Panel actions
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
    // Auto-number for new contacts when missing
    if (!currentContact && !contactData.contactNumber?.trim()) {
      contactData.contactNumber = generateNextContactNumber();
    }

    // Validate
    const errors = validateContact(contactData);
    setValidationErrors(errors);

    // Blocking errors?
    const blocking = errors.filter((e) => !e.message.includes('Warning'));
    if (blocking.length > 0) {
      return false;
    }

    try {
      let saved: Contact;

      if (currentContact) {
        // Update
        saved = await contactsApi.updateContact(currentContact.id, contactData);
        const normalized: Contact = {
          ...saved,
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        };
        setContacts((prev) => prev.map((c) => (c.id === currentContact.id ? normalized : c)));
        setCurrentContact(normalized);
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        // Create
        saved = await contactsApi.createContact(contactData);
        const normalized: Contact = {
          ...saved,
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        };
        setContacts((prev) => [...prev, normalized]);
        closeContactPanel();
      }

      return true;
    } catch (error) {
      console.error('Failed to save contact:', error);
      setValidationErrors([
        { field: 'general', message: 'Failed to save contact. Please try again.' },
      ]);
      return false;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      await contactsApi.deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  // Panel title helpers
  const getPanelTitle = (mode: string, item: Contact | null, isMobileView: boolean) => {
    if (mode === 'view' && item) {
      const contactNumber = `#${item.contactNumber || item.id}`;
      // För privatpersoner lagras fullständigt namn i companyName i vår typ
      const name = item.companyName || '';
      const orgNumber = item.organizationNumber || item.personalNumber || '';

      if (isMobileView && orgNumber) {
        return (
          <div>
            <div>
              {contactNumber} • {name}
            </div>
            <div className="text-sm font-normal text-gray-600 mt-1">{orgNumber}</div>
          </div>
        );
      }
      return `${contactNumber} • ${name}${orgNumber ? ` • ${orgNumber}` : ''}`;
    }

    switch (mode) {
      case 'edit':
        return 'Edit Contact';
      case 'create':
        return 'Create Contact';
      default:
        return 'Contact';
    }
  };

  const getPanelSubtitle = (mode: string, item: Contact | null) => {
    if (mode === 'view' && item) {
      const isCompany = item.contactType === 'company';
      const Icon = isCompany ? Building : User;
      const iconColor = isCompany ? '#2563eb' : '#16a34a';
      const badgeText = isCompany ? 'Company' : 'Private Person';
      const badgeColor = isCompany ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

      return (
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
          <Badge className={badgeColor}>{badgeText}</Badge>
        </div>
      );
    }

    switch (mode) {
      case 'edit':
        return 'Update contact information';
      case 'create':
        return 'Enter new contact details';
      default:
        return '';
    }
  };

  const getDeleteMessage = (item: Contact | null) => {
    if (!item) {
      return 'Are you sure you want to delete this contact?';
    }
    const itemName = item.companyName || 'this contact';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
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

    // Panel Title helpers
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}

export function useContactContext() {
  const context = useContext(ContactContext);
  if (context === undefined) {
    throw new Error('useContactContext must be used within a ContactProvider');
  }
  return context;
}
