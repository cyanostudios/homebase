import { Mail, MessageCircle } from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import type { BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import type { BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { resolveSlug } from '@/core/utils/slugUtils';
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
  closeContactSettingsView: () => void;
  closeContactPanel: () => void;
  /** When 'settings', main content shows ContactSettingsView instead of list. */
  contactsContentView: 'list' | 'settings';
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

  // Tags quick-edit in view mode (same UX pattern as tasks)
  displayTags: string[];
  addTagToDraft: (tag: string) => void;
  removeTagFromDraft: (tag: string) => void;
  hasTagsChanges: boolean;
  onApplyTagsEdit: () => Promise<void>;
  showDiscardTagsDialog: boolean;
  setShowDiscardTagsDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardTagsAndClose: () => void;
  tagError: string | null;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;

  // Single-item "Send message" from detail footer (same dialog as bulk)
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Contact) => void;
    className?: string;
    disabled?: boolean;
  }>;
  showSendMessageDialog: boolean;
  sendMessageRecipients: BulkMessageRecipient[];
  closeSendMessageDialog: () => void;
  showSendEmailDialog: boolean;
  sendEmailRecipients: BulkEmailRecipient[];
  closeSendEmailDialog: () => void;
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
  const { t } = useTranslation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, refreshData, user } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/contacts');
  const canSendMessages =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('pulses'));
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));

  // Panel states
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsContentView, setContactsContentView] = useState<'list' | 'settings'>('list');
  const [tagsDraft, setTagsDraft] = useState<string[] | null>(null);
  const [showDiscardTagsDialog, setShowDiscardTagsDialog] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
  const [sendMessageRecipients, setSendMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [sendEmailRecipients, setSendEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const pendingCloseRef = useRef<(() => void) | null>(null);

  const closeSendMessageDialog = useCallback(() => {
    setShowSendMessageDialog(false);
    setSendMessageRecipients([]);
  }, []);

  const closeSendEmailDialog = useCallback(() => {
    setShowSendEmailDialog(false);
    setSendEmailRecipients([]);
  }, []);

  const detailFooterActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: (item: Contact) => void;
      className?: string;
    }> = [];

    if (canSendMessages) {
      actions.push({
        id: 'send-message',
        label: t('bulk.sendMessageTitle'),
        icon: MessageCircle,
        onClick: (item: Contact) => {
          const phone =
            (item.phone && String(item.phone).trim()) ||
            (item.phone2 && String(item.phone2).trim()) ||
            '';
          setSendMessageRecipients([
            {
              id: String(item.id),
              name: item.companyName || '',
              phone,
            },
          ]);
          setShowSendMessageDialog(true);
        },
        className: 'h-9 text-xs px-3',
      });
    }

    if (canSendEmail) {
      actions.push({
        id: 'send-email',
        label: t('bulk.sendEmailTitle'),
        icon: Mail,
        onClick: (item: Contact) => {
          const email = item.email ? String(item.email).trim() : '';
          setSendEmailRecipients([
            {
              id: String(item.id),
              name: item.companyName || '',
              email,
            },
          ]);
          setShowSendEmailDialog(true);
        },
        className: 'h-9 text-xs px-3',
      });
    }

    return actions;
  }, [t, canSendMessages, canSendEmail]);

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

  const loadContacts = async () => {
    try {
      const contactsData = await contactsApi.getContacts();
      const transformedContacts: Contact[] = contactsData.map((contact: any) => ({
        ...contact,
        tags: Array.isArray(contact.tags) ? contact.tags : [],
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

  // Panel actions (clear bulk selection when opening panel or settings)
  const openContactPanel = (contact: Contact | null) => {
    clearContactSelectionCore();
    setCurrentContact(contact);
    setPanelMode(contact ? 'edit' : 'create');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    if (contact) {
      navigateToItem(contact, contacts, 'companyName');
    }
  };

  const openContactForEdit = (contact: Contact) => {
    clearContactSelectionCore();
    setCurrentContact(contact);
    setPanelMode('edit');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(contact, contacts, 'companyName');
  };

  const openContactForView = useCallback(
    (contact: Contact) => {
      setCurrentContact(contact);
      setPanelMode('view');
      setIsContactPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(contact, contacts, 'companyName');
    },
    [onCloseOtherPanels, navigateToItem, contacts],
  );

  const openContactSettings = useCallback(() => {
    clearContactSelectionCore();
    setContactsContentView('settings');
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearContactSelectionCore]);

  const closeContactSettingsView = useCallback(() => {
    setContactsContentView('list');
  }, []);

  const closeContactPanel = useCallback(() => {
    setIsContactPanelOpen(false);
    setCurrentContact(null);
    setPanelMode('create');
    setValidationErrors([]);
    setTagsDraft(null);
    setTagError(null);
    navigateToBase();
  }, [navigateToBase]);

  const currentItemIndex = currentContact
    ? contacts.findIndex((c) => c.id === currentContact.id)
    : -1;
  const totalItems = contacts.length;
  const hasPrevItem = currentItemIndex > 0;
  const hasNextItem = currentItemIndex >= 0 && currentItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || currentItemIndex <= 0) {
      return;
    }
    const prev = contacts[currentItemIndex - 1];
    if (prev) {
      openContactForView(prev);
    }
  }, [hasPrevItem, currentItemIndex, contacts, openContactForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || currentItemIndex < 0 || currentItemIndex >= contacts.length - 1) {
      return;
    }
    const next = contacts[currentItemIndex + 1];
    if (next) {
      openContactForView(next);
    }
  }, [hasNextItem, currentItemIndex, contacts, openContactForView]);

  // Initial deep-link: open the contact matching the URL on first data load
  const openContactForViewRef = useRef(openContactForView);
  useEffect(() => {
    openContactForViewRef.current = openContactForView;
  }, [openContactForView]);
  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || contacts.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'contacts' || !parts[2]) {
      return;
    }
    const item = resolveSlug(parts[2], contacts, 'companyName');
    if (item) {
      didOpenFromUrlRef.current = true;
      openContactForViewRef.current(item as Contact);
    }
  }, [contacts]);

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const contactTagsKey = JSON.stringify(
    Array.isArray(currentContact?.tags) ? currentContact.tags : [],
  );
  useEffect(() => {
    setTagsDraft(null);
    setTagError(null);
  }, [currentContact?.id, contactTagsKey]);

  const displayTags =
    currentContact && tagsDraft !== null
      ? tagsDraft
      : Array.isArray(currentContact?.tags)
        ? currentContact.tags
        : [];

  const addTagToDraft = useCallback(
    (tag: string) => {
      const next = String(tag || '').trim();
      if (!next) {
        return;
      }
      setTagError(null);
      setTagsDraft((prev) => {
        const base = prev ?? (Array.isArray(currentContact?.tags) ? currentContact.tags : []);
        if (base.some((t) => String(t).toLowerCase() === next.toLowerCase())) {
          return prev;
        }
        return [...base, next];
      });
    },
    [currentContact],
  );

  const removeTagFromDraft = useCallback(
    (tag: string) => {
      setTagError(null);
      setTagsDraft((prev) => {
        if (prev === null) {
          const base = Array.isArray(currentContact?.tags) ? currentContact.tags : [];
          return base.filter((t) => t !== tag);
        }
        return prev.filter((t) => t !== tag);
      });
    },
    [currentContact],
  );

  const hasTagsChanges = Boolean(
    currentContact &&
      (() => {
        const saved = Array.isArray(currentContact.tags) ? currentContact.tags : [];
        const draft = tagsDraft ?? saved;
        if (draft.length !== saved.length) {
          return true;
        }
        return draft.some((t, i) => saved[i] !== t);
      })(),
  );

  // Not wrapped in useCallback to avoid large dependency chain; onApplyTagsEdit depends on this
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Update: send existing tags when form doesn't include them; never send tags: [] when we don't know current tags (would wipe DB)
        const updatePayload =
          typeof contactData.tags !== 'undefined'
            ? contactData
            : Array.isArray(currentContact.tags)
              ? { ...contactData, tags: currentContact.tags }
              : contactData; // omit tags so backend leaves column unchanged
        saved = await contactsApi.updateContact(currentContact.id, updatePayload);
        const normalized: Contact = {
          ...saved,
          tags:
            typeof contactData.tags !== 'undefined'
              ? Array.isArray(contactData.tags)
                ? contactData.tags
                : []
              : (saved.tags ?? []),
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
      setTagError(validationErrors.find((e) => e.field === 'general')?.message ?? null);
      return false;
    }
  };

  const onApplyTagsEdit = useCallback(async () => {
    if (!currentContact) {
      return;
    }
    setTagError(null);
    const nextTags = tagsDraft ?? (Array.isArray(currentContact.tags) ? currentContact.tags : []);
    const success = await saveContact({ ...currentContact, tags: nextTags });
    if (success) {
      setTagsDraft(null);
    }
  }, [currentContact, tagsDraft, saveContact]);

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasTagsChanges) {
          pendingCloseRef.current = defaultClose;
          setShowDiscardTagsDialog(true);
        } else {
          defaultClose();
        }
      };
    },
    [hasTagsChanges],
  );

  const onDiscardTagsAndClose = useCallback(() => {
    setTagsDraft(null);
    setShowDiscardTagsDialog(false);
    // Keep same behavior as tasks quick-edit: discard draft and stay in detail view
  }, []);

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
      return t('contacts.deleteConfirmThis');
    }
    const itemName = item.companyName || 'this contact';
    return `${t('contacts.deleteConfirmNamed', { name: itemName })} ${t('bulk.cannotUndo')}`;
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
    closeContactSettingsView,
    closeContactPanel,
    contactsContentView,
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
    displayTags,
    addTagToDraft,
    removeTagFromDraft,
    hasTagsChanges,
    onApplyTagsEdit,
    showDiscardTagsDialog,
    setShowDiscardTagsDialog,
    getCloseHandler,
    onDiscardTagsAndClose,
    tagError,

    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: currentItemIndex === -1 ? 0 : currentItemIndex + 1,
    totalItems,

    detailFooterActions,
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,
    showSendEmailDialog,
    sendEmailRecipients,
    closeSendEmailDialog,
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
