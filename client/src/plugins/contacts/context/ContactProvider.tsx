import { Mail, MessageCircle, Timer } from 'lucide-react';
import React, { useCallback, useMemo, useState, useEffect, useRef, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import type { BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import type { BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';

import { contactsApi } from '../api/contactsApi';
import { Contact, CONTACT_TYPE_COLORS, ValidationError } from '../types/contacts';
import { contactExportConfig, getContactExportBaseFilename } from '../utils/contactExportConfig';
import {
  buildContactTagsSavePayload,
  hasContactTagsDraftChanges,
  mergeContactTag,
  omitContactTag,
  resolveContactDisplayTags,
} from '../utils/contactTagsDraft';
import { buildContactAssignableSavePayload } from '../utils/contactAssignableSave';
import { normalizeContactType } from '../utils/normalizeContactType';

import { ContactContext } from './ContactContext';
import type { ContactContextType } from './ContactContext';

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
  const location = useLocation();
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    refreshData,
    user,
    syncSharedContacts,
    registerSharedDataRefresh,
  } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/contacts');
  const canSendMessages =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('pulses'));
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));

  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsContentView, setContactsContentView] = useState<'list' | 'settings'>('list');
  const [tagsDraft, setTagsDraft] = useState<string[] | null>(null);
  const [showDiscardTagsDialog, setShowDiscardTagsDialog] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
  const [sendMessageRecipients, setSendMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [sendEmailRecipients, setSendEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [contactIdsWithTimeEntries, setContactIdsWithTimeEntries] = useState<Set<string | number>>(
    () => new Set(),
  );
  /** Skip deep-link → view when we already opened edit for this path. */
  const contactsDeepLinkPathSyncedRef = useRef<string | null>(null);

  const setContactHasTimeEntries = useCallback(
    (contactId: string | number, hasEntries: boolean) => {
      setContactIdsWithTimeEntries((prev) => {
        const has = prev.has(contactId);
        if (has === hasEntries) {
          return prev;
        }
        const next = new Set(prev);
        if (hasEntries) {
          next.add(contactId);
        } else {
          next.delete(contactId);
        }
        return next;
      });
    },
    [],
  );

  const [recentlyDuplicatedContactId, setRecentlyDuplicatedContactId] = useState<string | null>(
    null,
  );

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

  const {
    selectedIds: selectedContactIds,
    toggleSelection: toggleContactSelectedCore,
    selectAll: selectAllContactsCore,
    mergeIntoSelection: mergeIntoContactSelectionCore,
    clearSelection: clearContactSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  useEffect(() => {
    if (!isAuthenticated) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const contactsData = await contactsApi.getContacts();
        if (cancelled) {
          return;
        }
        const transformedContacts: Contact[] = contactsData.map((contact: any) => ({
          ...contact,
          tags: Array.isArray(contact.tags) ? contact.tags : [],
          createdAt: new Date(contact.createdAt),
          updatedAt: new Date(contact.updatedAt),
        }));
        setContacts(transformedContacts);
        syncSharedContacts(transformedContacts);
        try {
          const { contactIds } = await contactsApi.getContactIdsWithTimeEntries();
          if (!cancelled) {
            setContactIdsWithTimeEntries((prev) => {
              const next = new Set(prev);
              for (const id of contactIds) {
                next.add(id);
              }
              return next;
            });
          }
        } catch (timeIdsErr) {
          if (!cancelled) {
            console.error('Failed to load contacts with time entries:', timeIdsErr);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load contacts:', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, syncSharedContacts]);

  useEffect(() => {
    syncSharedContacts(contacts);
  }, [contacts, syncSharedContacts]);

  const loadContacts = useCallback(async () => {
    const contactsData = await contactsApi.getContacts();
    const transformedContacts: Contact[] = contactsData.map((contact: any) => ({
      ...contact,
      tags: Array.isArray(contact.tags) ? contact.tags : [],
      createdAt: new Date(contact.createdAt),
      updatedAt: new Date(contact.updatedAt),
    }));
    setContacts(transformedContacts);
    syncSharedContacts(transformedContacts);
    try {
      const { contactIds } = await contactsApi.getContactIdsWithTimeEntries();
      setContactIdsWithTimeEntries((prev) => {
        const next = new Set(prev);
        for (const id of contactIds) {
          next.add(id);
        }
        return next;
      });
    } catch (timeIdsErr) {
      console.error('Failed to load contacts with time entries:', timeIdsErr);
    }
  }, [syncSharedContacts]);

  useEffect(() => {
    return registerSharedDataRefresh('contacts', loadContacts);
  }, [registerSharedDataRefresh, loadContacts]);

  /** Top-bar time widget POST cannot use ContactContext — sync badge via browser event */
  useEffect(() => {
    const CONTACT_TIME_ENTRY_ADDED = 'homebase:contact-time-entry-added';
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ contactId?: string }>;
      const id = ce.detail?.contactId;
      if (id) {
        setContactHasTimeEntries(id, true);
      }
    };
    window.addEventListener(CONTACT_TIME_ENTRY_ADDED, handler);
    return () => window.removeEventListener(CONTACT_TIME_ENTRY_ADDED, handler);
  }, [setContactHasTimeEntries]);

  const validateContact = useCallback(
    (contactData: any): ValidationError[] => {
      const errors: ValidationError[] = [];

      if (currentContact) {
        const contactNumber = String(contactData.contactNumber ?? '').trim();
        if (!contactNumber) {
          errors.push({
            field: 'contactNumber',
            message: 'Contact number is required',
          });
        } else {
          const existingContact = contacts.find(
            (c) => c.id !== currentContact?.id && String(c.contactNumber) === contactNumber,
          );
          if (existingContact) {
            errors.push({
              field: 'contactNumber',
              message: `Contact number "${contactNumber}" already exists for "${existingContact.companyName}"`,
            });
          }
        }
      }

      if (!contactData.companyName?.trim()) {
        errors.push({
          field: 'companyName',
          message:
            contactData.contactType === 'company'
              ? 'Company name is required'
              : 'Full name is required',
        });
      }

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
    },
    [contacts, currentContact],
  );

  const openContactPanel = (contact: Contact | null) => {
    clearContactSelectionCore();
    setRecentlyDuplicatedContactId(null);
    setCurrentContact(contact);
    setPanelMode(contact ? 'edit' : 'create');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    if (contact) {
      const slug = buildSlug(contact, contacts, 'companyName');
      contactsDeepLinkPathSyncedRef.current = `/contacts/${slug}`;
      navigateToItem(contact, contacts, 'companyName');
    }
  };

  const openContactForEdit = (contact: Contact) => {
    clearContactSelectionCore();
    setRecentlyDuplicatedContactId(null);
    setCurrentContact(contact);
    setPanelMode('edit');
    setIsContactPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    const slug = buildSlug(contact, contacts, 'companyName');
    contactsDeepLinkPathSyncedRef.current = `/contacts/${slug}`;
    navigateToItem(contact, contacts, 'companyName');
  };

  const openContactForView = useCallback(
    (contact: Contact) => {
      setRecentlyDuplicatedContactId(null);
      setCurrentContact(contact);
      setPanelMode('view');
      setIsContactPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(contact, contacts, 'companyName');
    },
    [onCloseOtherPanels, navigateToItem, contacts, setValidationErrors],
  );

  const openContactSettings = useCallback(() => {
    clearContactSelectionCore();
    setRecentlyDuplicatedContactId(null);
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
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('contacts', closeContactPanel);
    return () => {
      unregisterPanelCloseFunction('contacts');
    };
  }, [closeContactPanel, registerPanelCloseFunction, unregisterPanelCloseFunction]);

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(contacts, currentContact, openContactForView);

  const openContactForViewRef = useRef(openContactForView);
  useEffect(() => {
    openContactForViewRef.current = openContactForView;
  }, [openContactForView]);
  useEffect(() => {
    if (contacts.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'contacts') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      contactsDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (contactsDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, contacts, 'companyName');
    contactsDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openContactForViewRef.current(item as Contact);
    }
  }, [location.pathname, contacts]);

  const contactIdForDraft = currentContact?.id != null ? String(currentContact.id) : null;
  useEffect(() => {
    setTagsDraft(null);
    setTagError(null);
  }, [contactIdForDraft]);

  const displayTags = resolveContactDisplayTags(currentContact?.tags, tagsDraft);

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
    currentContact && hasContactTagsDraftChanges(currentContact.tags, tagsDraft),
  );

  const saveContact = useCallback(
    async (contactData: any): Promise<boolean> => {
      if (!currentContact) {
        delete contactData.contactNumber;
      }

      const errors = validateContact(contactData);
      setValidationErrors(errors);

      const blocking = errors.filter((e) => !e.message.includes('Warning'));
      if (blocking.length > 0) {
        return false;
      }

      try {
        let saved: Contact;

        if (currentContact) {
          const updatePayload =
            typeof contactData.tags !== 'undefined'
              ? contactData
              : Array.isArray(currentContact.tags)
                ? { ...contactData, tags: currentContact.tags }
                : contactData;
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
          saved = await contactsApi.createContact(contactData);
          const normalized: Contact = {
            ...saved,
            createdAt: new Date(saved.createdAt),
            updatedAt: new Date(saved.updatedAt),
          };
          setContacts((prev) => [...prev, normalized]);
          closeContactPanel();
        }

        await refreshData();

        return true;
      } catch (error: any) {
        console.error('Failed to save contact:', error);

        const validationErrors: ValidationError[] = [];

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

        if (validationErrors.length === 0) {
          const errorMessage =
            error?.message || error?.error || 'Failed to save contact. Please try again.';
          validationErrors.push({ field: 'general', message: errorMessage });
        }

        setValidationErrors(validationErrors);
        setTagError(validationErrors.find((e) => e.field === 'general')?.message ?? null);
        return false;
      }
    },
    [closeContactPanel, currentContact, refreshData, validateContact, setValidationErrors],
  );

  const setContactTags = useCallback(
    async (contact: Contact, nextTags: string[]): Promise<boolean> => {
      const existing = Array.isArray(contact.tags) ? contact.tags : [];
      const unchanged =
        nextTags.length === existing.length &&
        nextTags.every((item, index) => item === existing[index]);
      if (unchanged) {
        return true;
      }

      try {
        const payload = buildContactTagsSavePayload(contact, nextTags);
        const saved = await contactsApi.updateContact(String(contact.id), payload);
        const normalized: Contact = {
          ...saved,
          tags: nextTags,
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        };
        setContacts((prev) =>
          prev.map((c) => (String(c.id) === String(contact.id) ? normalized : c)),
        );
        setCurrentContact((prev) =>
          prev && String(prev.id) === String(contact.id)
            ? { ...prev, tags: nextTags, updatedAt: normalized.updatedAt }
            : prev,
        );
        return true;
      } catch (error) {
        console.error('Failed to update contact tags:', error);
        return false;
      }
    },
    [],
  );

  const onApplyTagsEdit = useCallback(async () => {
    if (!currentContact) {
      return;
    }
    setTagError(null);
    const nextTags = tagsDraft ?? (Array.isArray(currentContact.tags) ? currentContact.tags : []);
    // Dedicated tags update — avoid full saveContact validation / panel mode churn
    const success = await setContactTags(currentContact, nextTags);
    if (success) {
      setTagsDraft(null);
    } else {
      setTagError('Failed to save tags. Please try again.');
    }
  }, [currentContact, tagsDraft, setContactTags]);

  const applyTagToContact = useCallback(
    async (contact: Contact, tag: string): Promise<boolean> => {
      const nextTags = mergeContactTag(contact.tags, tag);
      return setContactTags(contact, nextTags);
    },
    [setContactTags],
  );

  const removeTagFromContact = useCallback(
    async (contact: Contact, tag: string): Promise<boolean> => {
      const nextTags = omitContactTag(contact.tags, tag);
      return setContactTags(contact, nextTags);
    },
    [setContactTags],
  );

  const clearTagsFromContact = useCallback(
    async (contact: Contact): Promise<boolean> => setContactTags(contact, []),
    [setContactTags],
  );

  const setContactAssignable = useCallback(
    async (contact: Contact, isAssignable: boolean): Promise<boolean> => {
      if (Boolean(contact.isAssignable) === isAssignable) {
        return true;
      }

      try {
        const payload = buildContactAssignableSavePayload(contact, isAssignable);
        const saved = await contactsApi.updateContact(String(contact.id), payload);
        const normalized: Contact = {
          ...saved,
          isAssignable,
          createdAt: new Date(saved.createdAt),
          updatedAt: new Date(saved.updatedAt),
        };
        setContacts((prev) =>
          prev.map((c) => (String(c.id) === String(contact.id) ? normalized : c)),
        );
        setCurrentContact((prev) =>
          prev && String(prev.id) === String(contact.id)
            ? { ...prev, isAssignable, updatedAt: normalized.updatedAt }
            : prev,
        );
        return true;
      } catch (error) {
        console.error('Failed to update contact assignable:', error);
        return false;
      }
    },
    [],
  );

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasTagsChanges) {
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
    closeContactPanel();
  }, [closeContactPanel]);

  const deleteContact = async (id: string) => {
    try {
      await contactsApi.deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      await refreshData();
    } catch (error: any) {
      console.error('Failed to delete contact:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete contact';
      alert(errorMessage);
    }
  };

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
      setContacts((prev) => prev.filter((c) => !uniqueIds.includes(String(c.id))));
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
      const typeColor = isCompany ? CONTACT_TYPE_COLORS.company : CONTACT_TYPE_COLORS.private;
      const orgOrPersonal = isCompany
        ? item.organizationNumber?.trim() || null
        : item.personalNumber?.trim() || null;
      const email = item.email?.trim() || null;
      const phone = item.phone?.trim() || null;
      const hasTimeEntries =
        contactIdsWithTimeEntries.has(item.id) || contactIdsWithTimeEntries.has(String(item.id));
      const metaParts = [orgOrPersonal, email, phone].filter(Boolean);

      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 h-5 shrink-0 font-medium border-0', typeColor)}
          >
            {t(`contacts.type.${item.contactType}`)}
          </Badge>
          {metaParts.length > 0 ? (
            <span className="text-xs text-muted-foreground truncate">{metaParts.join(' · ')}</span>
          ) : null}
          {hasTimeEntries ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 h-5 shrink-0 font-medium inline-flex items-center gap-1 bg-amber-50/60 text-amber-700 dark:text-amber-300 border-amber-200/60"
            >
              <Timer className="h-2.5 w-2.5" aria-hidden />
              Time logged
            </Badge>
          ) : null}
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

  const getDeleteMessage = (item: Contact | null) =>
    buildDeleteMessage(t, 'contacts', item?.companyName || undefined);

  const exportFormats: ExportFormat[] = ['txt', 'csv', 'pdf'];

  const createContactDuplicate = useCallback(
    async (item: Contact, newName: string): Promise<Contact> => {
      const nextName = (newName ?? '').trim();
      const payload = {
        ...item,
        companyName: nextName || item.companyName?.trim() || 'Untitled',
      } as Record<string, unknown>;
      delete payload.id;
      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload.contactNumber;
      const created = await contactsApi.createContact(payload);
      const normalized: Contact = {
        ...created,
        tags: Array.isArray(created.tags) ? created.tags : [],
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt),
      };
      setContacts((prev) => [normalized, ...prev]);
      return normalized;
    },
    [],
  );

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Contact) => `Copy of ${item.companyName?.trim() || t('nav.contact')}`,
    nameLabel: t('contacts.title'),
    confirmOnly: false,
    createDuplicate: createContactDuplicate,
    closePanel: closeContactPanel,
  });

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

  const importContacts = useCallback(
    async (data: any[]) => {
      let successCount = 0;
      let failureCount = 0;
      for (const row of data) {
        try {
          const payload = {
            companyName: row.companyName ?? row.name ?? '',
            contactType: normalizeContactType(row.contactType ?? row.type),
            email: row.email ?? '',
            phone: row.phone ?? '',
            notes: row.notes ?? '',
          };
          await contactsApi.createContact(payload);
          successCount++;
        } catch (error) {
          failureCount++;
          console.error('Failed to import contact', row, error);
        }
      }
      if (successCount > 0) {
        await loadContacts();
      }
      return { successCount, failureCount };
    },
    [loadContacts],
  );

  const value: ContactContextType = {
    isContactPanelOpen,
    currentContact,
    panelMode,
    validationErrors,
    contacts,
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
    selectedContactIds,
    toggleContactSelected: toggleContactSelectedCore,
    selectAllContacts: selectAllContactsCore,
    mergeIntoContactSelection: mergeIntoContactSelectionCore,
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
    applyTagToContact,
    removeTagFromContact,
    clearTagsFromContact,
    setContactAssignable,
    showDiscardTagsDialog,
    setShowDiscardTagsDialog,
    getCloseHandler,
    onDiscardTagsAndClose,
    tagError,
    recentlyDuplicatedContactId,
    setRecentlyDuplicatedContactId,
    getDuplicateConfig,
    executeDuplicate,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
    detailFooterActions,
    showSendMessageDialog,
    sendMessageRecipients,
    closeSendMessageDialog,
    showSendEmailDialog,
    sendEmailRecipients,
    closeSendEmailDialog,
    contactIdsWithTimeEntries,
    setContactHasTimeEntries,
  };

  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}
