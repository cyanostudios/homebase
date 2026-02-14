import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { cn } from '@/lib/utils';

import { contactsApi } from '../api/contactsApi';
import { Contact, ValidationError } from '../types/contacts';
import { contactExportConfig, getContactExportBaseFilename } from '../utils/contactExportConfig';

interface ContactContextType {
  // Contact Panel State
  isContactPanelOpen: boolean;
  currentContact: Contact | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];

  // Contacts Data
  contacts: Contact[];

  // Contact Actions
  openContactPanel: (contact: Contact | null) => void;
  openContactForEdit: (contact: Contact) => void;
  openContactForView: (contact: Contact) => void;
  openContactSettings: () => void;
  closeContactPanel: () => void;
  saveContact: (contactData: any) => Promise<boolean>;
  deleteContact: (id: string) => Promise<void>;
  deleteContacts: (ids: string[]) => Promise<void>;
  clearValidationErrors: () => void;
  // Bulk selection
  selectedContactIds: string[];
  toggleContactSelected: (id: string) => void;
  selectAllContacts: (ids: string[]) => void;
  clearContactSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  getPanelSubtitle: (mode: string, item: Contact | null) => any;
  getDeleteMessage: (item: Contact | null) => string;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Contact) => void;
  importContacts: (data: any[]) => Promise<void>;
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, refreshData } = useApp();

  // Panel states
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Use core bulk selection hook
  const {
    selectedIds: selectedContactIds,
    toggleSelection: toggleContactSelectedCore,
    selectAll: selectAllContactsCore,
    clearSelection: clearContactSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

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

  const validateContact = (contactData: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Contact number: required only when editing; on create backend assigns it
    if (currentContact) {
      if (!contactData.contactNumber?.trim()) {
        errors.push({
          field: 'contactNumber',
          message: 'Contact number is required',
        });
      } else {
        const existingContact = contacts.find(
          (c) =>
            c.id !== currentContact?.id && c.contactNumber === contactData.contactNumber.trim(),
        );
        if (existingContact) {
          errors.push({
            field: 'contactNumber',
            message: `Contact number "${contactData.contactNumber}" already exists for "${existingContact.companyName}"`,
          });
        }
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

  const openContactSettings = useCallback(() => {
    setCurrentContact(null);
    setPanelMode('settings');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

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
    // Contact number: backend assigns on create; only send for update
    if (!currentContact) {
      delete contactData.contactNumber;
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

      // Refresh global data to update other plugins (e.g. TaskForm assignee list)
      await refreshData();

      return true;
    } catch (error: any) {
      console.error('Failed to save contact:', error);

      // V2: Handle standardized error format from backend
      const validationErrors: ValidationError[] = [];

      // Check if backend returned validation errors in details array
      if (error?.details && Array.isArray(error.details)) {
        error.details.forEach((detail: any) => {
          if (typeof detail === 'string') {
            validationErrors.push({ field: 'general', message: detail });
          } else if (detail?.field && detail?.message) {
            validationErrors.push({ field: detail.field, message: detail.message });
          } else if (detail?.msg) {
            validationErrors.push({ field: detail.param || 'general', message: detail.msg });
          }
        });
      }

      // If no validation errors from backend, use error message
      if (validationErrors.length === 0) {
        const errorMessage =
          error?.message || error?.error || 'Failed to save contact. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }

      setValidationErrors(validationErrors);
      return false;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      await contactsApi.deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      await refreshData();
    } catch (error: any) {
      console.error('Failed to delete contact:', error);
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to delete contact';
      alert(errorMessage);
    }
  };

  // Bulk delete using core bulkApi
  const deleteContacts = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return;
    }

    try {
      await bulkApi.bulkDelete('contacts', uniqueIds);
      // Update local state - remove deleted contacts
      setContacts((prev) => prev.filter((c) => !uniqueIds.includes(String(c.id))));
      // Clear selection after successful delete
      clearContactSelectionCore();
      await refreshData();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete contacts';
      alert(errorMessage);
      throw error;
    }
  };

  const getPanelSubtitle = (mode: string, item: Contact | null) => {
    if (mode === 'settings') {
      return null;
    }
    if (mode === 'view' && item) {
      const isCompany = item.contactType === 'company';
      const typeColors = {
        company: 'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
        personal:
          'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
      };
      const color = isCompany ? typeColors.company : typeColors.personal;
      const label = isCompany ? 'Company' : 'Personal';
      return (
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 h-5 shrink-0 font-medium', color)}
          >
            {label}
          </Badge>
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

  const exportFormats: ExportFormat[] = ['txt', 'csv', 'pdf'];

  const onExportItem = useCallback((format: ExportFormat, item: Contact) => {
    const result = exportItems({
      items: [item],
      format,
      config: contactExportConfig,
      filename: getContactExportBaseFilename(item),
      title: 'Contacts Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch((err) => {
        console.error('Export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  }, []);

  const importContacts = useCallback(async (data: any[]) => {
    let successCount = 0;
    for (const row of data) {
      try {
        const payload = {
          companyName: row.companyName ?? row.name ?? '',
          contactType: row.contactType ?? row.type ?? 'company',
          email: row.email ?? '',
          phone: row.phone ?? '',
          notes: row.notes ?? '',
        };
        await contactsApi.createContact(payload);
        successCount++;
      } catch (error) {
        console.error('Failed to import contact', row, error);
      }
    }
    if (successCount > 0) {
      await loadContacts();
    }
  }, []);

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
    openContactSettings,
    closeContactPanel,
    saveContact,
    deleteContact,
    deleteContacts,
    clearValidationErrors,

    // Bulk selection
    selectedContactIds,
    toggleContactSelected: toggleContactSelectedCore,
    selectAllContacts: selectAllContactsCore,
    clearContactSelection: clearContactSelectionCore,
    selectedCount,
    isSelected,

    getPanelSubtitle,
    getDeleteMessage,

    exportFormats,
    onExportItem,
    importContacts,
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
