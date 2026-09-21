import {
  ArrowDown,
  ArrowUp,
  Building,
  Globe,
  Hash,
  History,
  Info,
  Link2,
  Mail,
  MapPin,
  Phone as PhoneIcon,
  Plus,
  SlidersHorizontal,
  StickyNote,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_PROP_ROW_CLASS as PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_GHOST_PROP_CONTROL_CLASS,
  FORM_GHOST_READONLY_CLASS,
  FORM_GHOST_SELECT_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
  FORM_INPUT_ERROR_CLASS,
} from '@/core/ui/formFieldStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { syncTextareaHeight } from '@/core/ui/syncTextareaHeight';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import { COMPANY_TYPE_OPTIONS, CONTACT_TYPE_ICON_SHELL_CLASS } from '../types/contacts';
import {
  isContactPersonInvoiceReference,
  withContactPersonInvoiceReference,
} from '../utils/contactInvoiceReference';

import { ContactSettingsForm } from './ContactSettingsForm';
/** Same label language as ContactView (`DETAIL_FIELD_LABEL_CLASS`). */
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500';

type ContactFormTab = 'information' | 'addresses' | 'persons' | 'linked' | 'activity';

const CONTACT_FORM_TABS: ContactFormTab[] = [
  'information',
  'addresses',
  'persons',
  'linked',
  'activity',
];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const CONTACT_FORM_EDIT_DISABLED_TABS: ReadonlySet<ContactFormTab> = new Set([
  'linked',
  'activity',
]);

const TAB_ERROR_FIELDS: Record<ContactFormTab, string[]> = {
  information: [
    'companyName',
    'contactNumber',
    'personalNumber',
    'organizationNumber',
    'vatNumber',
    'email',
    'website',
    'phone',
    'phone2',
    'notes',
    'contactType',
    'companyType',
    'taxRate',
    'paymentTerms',
    'currency',
    'fTax',
    'isAssignable',
    'tags',
  ],
  addresses: ['addresses'],
  persons: ['contactPersons'],
  linked: [],
  activity: [],
};

function parseContactFormTab(value: string | null): ContactFormTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && CONTACT_FORM_TABS.includes(value as ContactFormTab)) {
    return value as ContactFormTab;
  }
  return 'information';
}
interface ContactPerson {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  invoiceReference?: boolean;
}

interface Address {
  id: string;
  type: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  region: string;
  country: string;
  email: string;
}

interface ContactFormProps {
  currentContact?: any;
  onSave: (data: any) => Promise<boolean> | boolean | void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Single-column layout for mail-style list detail column. */
  stacked?: boolean;
}

export const ContactForm = React.forwardRef<PanelFormHandle, ContactFormProps>(function ContactForm(
  {
    currentContact,
    onSave,
    onCancel,
    isSubmitting: externalIsSubmitting = false,
    stacked: _stacked = false,
  },
  ref,
) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseContactFormTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: ContactFormTab, replace = false) => {
      if (CONTACT_FORM_EDIT_DISABLED_TABS.has(tab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  // Linked / Activity stay visible (greyed) but are not editable — leave those tabs if URL preserved them from View.
  useEffect(() => {
    if (!CONTACT_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);
  const { validationErrors, clearValidationErrors, panelMode } = useContacts();
  const { getSettings, settingsVersion } = useApp();
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    contactNumber: '',
    contactType: 'company',
    companyName: '',
    companyType: 'AB',
    organizationNumber: '',
    vatNumber: '',
    personalNumber: '',
    contactPersons: [] as ContactPerson[],
    addresses: [] as Address[],
    email: '',
    phone: '',
    phone2: '',
    website: '',
    taxRate: '25',
    paymentTerms: '30',
    currency: 'SEK',
    fTax: 'yes',
    notes: '',
    isAssignable: false,
    tags: [] as string[],
  });

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState('');
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const syncNotesTextareaHeight = useCallback(() => {
    syncTextareaHeight(notesTextareaRef.current);
  }, []);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const settings = await getSettings('contacts');
        const list = Array.isArray(settings?.tags) ? settings.tags : [];
        setAvailableTags(
          list
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim())
            .filter(Boolean),
        );
      } catch {
        setAvailableTags([]);
      }
    };
    void loadTags();
  }, [getSettings, settingsVersion]);

  const addableTags = useMemo(
    () =>
      availableTags.filter(
        (item) =>
          !(formData.tags as string[]).some(
            (tag) => String(tag).toLowerCase() === String(item).toLowerCase(),
          ),
      ),
    [availableTags, formData.tags],
  );

  const addTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: [...(prev.tags as string[]), tag] }));
    markDirty();
    setTagToAdd('');
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: (prev.tags as string[]).filter((t) => t !== tag),
    }));
    markDirty();
  };

  // While create/edit is open, block list + sidebar navigation (same discard prompt as Close).
  // Dirty tracking still drives local field state; leave-confirm is session-based.
  useEffect(() => {
    const formKey = `contact-form-${currentContact?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);
    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [currentContact, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      contactNumber: '',
      contactType: 'company',
      companyName: '',
      companyType: 'AB',
      organizationNumber: '',
      vatNumber: '',
      personalNumber: '',
      contactPersons: [],
      addresses: [],
      email: '',
      phone: '',
      phone2: '',
      website: '',
      taxRate: '25',
      paymentTerms: '30',
      currency: 'SEK',
      fTax: 'yes',
      notes: '',
      isAssignable: false,
      tags: [],
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentContact) {
      const contactType = currentContact.contactType || 'company';
      const isPrivate = contactType === 'private';
      setFormData({
        contactNumber: currentContact.contactNumber || '',
        contactType,
        companyName: currentContact.companyName || '',
        companyType: currentContact.companyType || 'AB',
        organizationNumber: currentContact.organizationNumber || '',
        vatNumber: currentContact.vatNumber || '',
        personalNumber: currentContact.personalNumber || '',
        contactPersons: currentContact.contactPersons || [],
        addresses: currentContact.addresses || [],
        email: currentContact.email || '',
        phone: currentContact.phone || '',
        phone2: currentContact.phone2 || '',
        website: currentContact.website || '',
        taxRate: isPrivate ? '0' : currentContact.taxRate || '25',
        paymentTerms: currentContact.paymentTerms || '30',
        currency: currentContact.currency || 'SEK',
        fTax: isPrivate ? '' : currentContact.fTax || 'yes',
        notes: currentContact.notes || '',
        isAssignable:
          currentContact.isAssignable !== undefined ? currentContact.isAssignable : false,
        tags: Array.isArray(currentContact.tags) ? currentContact.tags : [],
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentContact, markClean, resetForm]);

  useLayoutEffect(() => {
    if (activeTab !== 'information') {
      return;
    }
    syncNotesTextareaHeight();
  }, [activeTab, formData.notes, syncNotesTextareaHeight]);

  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;
  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await onSave(formData);
      if (success === true) {
        markClean();
        if (!currentContact) {
          resetForm();
        }
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentContact, resetForm, isCurrentlySubmitting]);

  const handleCancel = useCallback(() => {
    attemptAction(
      () => {
        onCancel();
      },
      { force: true },
    );
  }, [attemptAction, onCancel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  const handleDiscardChanges = () => {
    if (!currentContact) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
      onCancel();
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => {
      if (field === 'contactType' && value === 'private') {
        return { ...prev, contactType: 'private', taxRate: '0', fTax: '' };
      }
      return { ...prev, [field]: value };
    });
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  const addContactPerson = () => {
    const newPerson: ContactPerson = {
      id: Date.now().toString(),
      name: '',
      title: '',
      email: '',
      phone: '',
    };
    setFormData((prev) => ({
      ...prev,
      contactPersons: [...prev.contactPersons, newPerson],
    }));
    markDirty();
  };

  const removeContactPerson = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      contactPersons: prev.contactPersons.filter((person) => person.id !== id),
    }));
    markDirty();
  };

  const updateContactPerson = (id: string, field: keyof ContactPerson, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      contactPersons: prev.contactPersons.map((person) =>
        person.id === id ? { ...person, [field]: value } : person,
      ),
    }));
    markDirty();
  };

  const setInvoiceReferencePerson = (id: string, selected: boolean) => {
    setFormData((prev) => ({
      ...prev,
      contactPersons: withContactPersonInvoiceReference(prev.contactPersons, id, selected),
    }));
    markDirty();
  };

  const moveContactPerson = (id: string, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const persons = [...prev.contactPersons];
      const index = persons.findIndex((person) => person.id === id);
      if (index < 0) {
        return prev;
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= persons.length) {
        return prev;
      }
      [persons[index], persons[targetIndex]] = [persons[targetIndex], persons[index]];
      return { ...prev, contactPersons: persons };
    });
    markDirty();
  };

  const addAddress = () => {
    const newAddress: Address = {
      id: Date.now().toString(),
      type: 'Main Office',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      region: '',
      country: 'Sweden',
      email: '',
    };
    setFormData((prev) => ({
      ...prev,
      addresses: [...prev.addresses, newAddress],
    }));
    markDirty();
  };

  const removeAddress = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((address) => address.id !== id),
    }));
    markDirty();
  };

  const updateAddress = (id: string, field: keyof Address, value: string) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.map((address) =>
        address.id === id ? { ...address, [field]: value } : address,
      ),
    }));
    markDirty();
  };

  const isCompanyType = formData.contactType === 'company';
  const ContactTypeIcon = isCompanyType ? Users : User;

  const tabHasError = useCallback(
    (tab: ContactFormTab) => {
      const fields = TAB_ERROR_FIELDS[tab];
      if (!fields.length) {
        return false;
      }
      return validationErrors.some(
        (error) => fields.includes(error.field) && !error.message.includes('Warning'),
      );
    },
    [validationErrors],
  );

  const addressCount = formData.addresses.length;
  const personCount = formData.contactPersons.length;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('contacts.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'addresses' as const,
        label: t('contacts.tabs.addresses'),
        icon: MapPin,
        count: addressCount > 0 ? addressCount : null,
      },
      {
        id: 'persons' as const,
        label: t('contacts.tabs.persons'),
        icon: Users,
        count: personCount > 0 ? personCount : null,
      },
      {
        id: 'linked' as const,
        label: t('contacts.tabs.linked'),
        icon: Link2,
        count: null as number | null,
      },
      {
        id: 'activity' as const,
        label: t('contacts.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [t, addressCount, personCount],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = CONTACT_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        const hasError = !isDisabled && tabHasError(tab.id);
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('contacts.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.count !== null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
              {hasError ? (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                  aria-label={t('common.error', { defaultValue: 'Error' })}
                />
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <SectionCategoryIcon
              icon={ContactTypeIcon}
              className={CONTACT_TYPE_ICON_SHELL_CLASS[isCompanyType ? 'company' : 'private']}
            />
          </span>
          <div className="min-w-0 flex-1">
            <Input
              id="companyName"
              type="text"
              value={formData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder={isCompanyType ? 'Company Name *' : 'Full Name *'}
              aria-label={isCompanyType ? 'Company Name' : 'Full Name'}
              className={cn(
                DETAIL_FORM_TITLE_INPUT_CLASS,
                PLUGIN_PAGE_TITLE_CLASS,
                'min-w-0 tracking-[0.003em]',
                getFieldError('companyName') && FORM_INPUT_ERROR_CLASS,
              )}
              required
            />
            {getFieldError('companyName') ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {getFieldError('companyName')?.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('contacts.information')} icon={Info} subtleTitle className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={formData.contactType === 'company' ? 'default' : 'outline'}
              onClick={() => updateField('contactType', 'company')}
              className="h-9 text-xs"
              icon={Building}
            >
              Company
            </Button>
            <Button
              type="button"
              variant={formData.contactType === 'private' ? 'default' : 'outline'}
              onClick={() => updateField('contactType', 'private')}
              className="h-9 text-xs"
              icon={User}
            >
              Private
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-4">
            <div>
              <Label htmlFor="contactNumber" className={FACT_LABEL_CLASS}>
                <Hash className="h-3 w-3" />
                {currentContact ? 'Contact Number *' : 'Contact Number'}
              </Label>
              {currentContact ? (
                <Input
                  id="contactNumber"
                  type="text"
                  value={formData.contactNumber}
                  onChange={(e) => updateField('contactNumber', e.target.value)}
                  placeholder="e.g. 01"
                  className={cn(
                    FORM_GHOST_INPUT_CLASS,
                    getFieldError('contactNumber') && FORM_INPUT_ERROR_CLASS,
                  )}
                  required
                />
              ) : (
                <Input
                  id="contactNumber"
                  type="text"
                  value={formData.contactNumber}
                  readOnly
                  placeholder="Assigned on save"
                  className={cn(FORM_GHOST_INPUT_CLASS, FORM_GHOST_READONLY_CLASS)}
                />
              )}
              {getFieldError('contactNumber') ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {getFieldError('contactNumber')?.message}
                </p>
              ) : null}
            </div>

            {isCompanyType ? (
              <div>
                <Label htmlFor="companyType" className={FACT_LABEL_CLASS}>
                  Company type
                </Label>
                <NativeSelect
                  id="companyType"
                  value={formData.companyType}
                  onChange={(e) => updateField('companyType', e.target.value)}
                  className={FORM_GHOST_SELECT_CLASS}
                >
                  {COMPANY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : (
              <div>
                <Label htmlFor="personalNumber" className={FACT_LABEL_CLASS}>
                  Personal Number
                </Label>
                <Input
                  id="personalNumber"
                  type="text"
                  value={formData.personalNumber}
                  onChange={(e) => updateField('personalNumber', e.target.value)}
                  className={cn(
                    FORM_GHOST_INPUT_CLASS,
                    getFieldError('personalNumber') && FORM_INPUT_ERROR_CLASS,
                  )}
                />
              </div>
            )}

            {isCompanyType ? (
              <>
                <div>
                  <Label htmlFor="organizationNumber" className={FACT_LABEL_CLASS}>
                    Organization Number
                  </Label>
                  <Input
                    id="organizationNumber"
                    type="text"
                    value={formData.organizationNumber}
                    onChange={(e) => updateField('organizationNumber', e.target.value)}
                    className={FORM_GHOST_INPUT_CLASS}
                  />
                </div>
                <div>
                  <Label htmlFor="vatNumber" className={FACT_LABEL_CLASS}>
                    VAT Number
                  </Label>
                  <Input
                    id="vatNumber"
                    type="text"
                    value={formData.vatNumber}
                    onChange={(e) => updateField('vatNumber', e.target.value)}
                    className={FORM_GHOST_INPUT_CLASS}
                  />
                </div>
              </>
            ) : null}

            <div>
              <Label htmlFor="email" className={FACT_LABEL_CLASS}>
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={cn(
                  FORM_GHOST_INPUT_CLASS,
                  getFieldError('email') &&
                    'ring-1 ring-yellow-500 focus:ring-yellow-500 focus-visible:ring-yellow-500',
                )}
              />
            </div>
            <div>
              <Label htmlFor="website" className={FACT_LABEL_CLASS}>
                <Globe className="h-3 w-3" />
                Website
              </Label>
              <Input
                id="website"
                type="text"
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
                className={FORM_GHOST_INPUT_CLASS}
              />
            </div>
            <div>
              <Label htmlFor="phone" className={FACT_LABEL_CLASS}>
                <PhoneIcon className="h-3 w-3" />
                Phone 1
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className={FORM_GHOST_INPUT_CLASS}
              />
            </div>
            <div>
              <Label htmlFor="phone2" className={FACT_LABEL_CLASS}>
                <PhoneIcon className="h-3 w-3" />
                Phone 2
              </Label>
              <Input
                id="phone2"
                type="tel"
                value={formData.phone2}
                onChange={(e) => updateField('phone2', e.target.value)}
                className={FORM_GHOST_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className={FACT_LABEL_CLASS}>
              <StickyNote className="h-3 w-3" />
              Notes
            </Label>
            <Textarea
              ref={notesTextareaRef}
              id="notes"
              value={formData.notes}
              onChange={(e) => {
                updateField('notes', e.target.value);
                syncTextareaHeight(e.currentTarget);
              }}
              rows={3}
              className={FORM_GHOST_TEXTAREA_CLASS}
            />
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const addressesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title="Addresses" icon={MapPin} subtleTitle className="p-6">
        <div className="space-y-4">
          <RoundIconLabelButton
            type="button"
            icon={Plus}
            label="Add Address"
            variant="soft"
            size="xs"
            alwaysExpanded
            onClick={addAddress}
          />
          {formData.addresses.length === 0 ? (
            <p className={DETAIL_EMPTY_STATE_CLASS}>
              {t('contacts.noAddresses', { defaultValue: 'No addresses yet.' })}
            </p>
          ) : (
            formData.addresses.map((address) => (
              <div key={address.id} className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{address.type || 'Address'}</span>
                  <RoundIconLabelButton
                    type="button"
                    icon={Trash2}
                    label="Remove"
                    variant="dangerSoft"
                    size="xs"
                    expandOnHover={false}
                    onClick={() => removeAddress(address.id)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className={FACT_LABEL_CLASS}>Type</Label>
                    <NativeSelect
                      value={address.type}
                      onChange={(e) => updateAddress(address.id, 'type', e.target.value)}
                      className={FORM_GHOST_SELECT_CLASS}
                    >
                      <option value="Main Office">Main Office</option>
                      <option value="Billing Address">Billing Address</option>
                      <option value="Shipping Address">Shipping Address</option>
                      <option value="Branch Office">Branch Office</option>
                      <option value="Home Address">Home Address</option>
                      <option value="Other">Other</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label className={FACT_LABEL_CLASS}>Email</Label>
                    <Input
                      type="email"
                      value={address.email}
                      onChange={(e) => updateAddress(address.id, 'email', e.target.value)}
                      className={FORM_GHOST_INPUT_CLASS}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className={FACT_LABEL_CLASS}>Address Line 1</Label>
                    <Input
                      value={address.addressLine1}
                      onChange={(e) => updateAddress(address.id, 'addressLine1', e.target.value)}
                      className={FORM_GHOST_INPUT_CLASS}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className={FACT_LABEL_CLASS}>Address Line 2</Label>
                    <Input
                      value={address.addressLine2}
                      onChange={(e) => updateAddress(address.id, 'addressLine2', e.target.value)}
                      className={FORM_GHOST_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <Label className={FACT_LABEL_CLASS}>Postal Code</Label>
                    <Input
                      value={address.postalCode}
                      onChange={(e) => updateAddress(address.id, 'postalCode', e.target.value)}
                      className={FORM_GHOST_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <Label className={FACT_LABEL_CLASS}>City</Label>
                    <Input
                      value={address.city}
                      onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                      className={FORM_GHOST_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <Label className={FACT_LABEL_CLASS}>Region</Label>
                    <Input
                      value={address.region}
                      onChange={(e) => updateAddress(address.id, 'region', e.target.value)}
                      className={FORM_GHOST_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <Label className={FACT_LABEL_CLASS}>Country</Label>
                    <NativeSelect
                      value={address.country}
                      onChange={(e) => updateAddress(address.id, 'country', e.target.value)}
                      className={FORM_GHOST_SELECT_CLASS}
                    >
                      <option value="Sweden">Sweden</option>
                      <option value="Norway">Norway</option>
                      <option value="Denmark">Denmark</option>
                      <option value="Finland">Finland</option>
                    </NativeSelect>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DetailSection>
    </Card>
  );

  const propertiesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('contacts.contactProperties')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <div>
          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Tax rate</span>
            {formData.contactType === 'private' ? (
              <Badge
                className={cn(
                  BADGE_CHIP_CLASS,
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                0% (Tax Free)
              </Badge>
            ) : (
              <NativeSelect
                id="taxRate"
                value={formData.taxRate}
                onChange={(e) => updateField('taxRate', e.target.value)}
                className={FORM_GHOST_PROP_CONTROL_CLASS}
              >
                <option value="0">0% (Tax Free)</option>
                <option value="6">6% (Reduced)</option>
                <option value="12">12% (Reduced)</option>
                <option value="25">25% (Standard)</option>
              </NativeSelect>
            )}
          </div>

          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Payment terms</span>
            <NativeSelect
              id="paymentTerms"
              value={formData.paymentTerms}
              onChange={(e) => updateField('paymentTerms', e.target.value)}
              className={FORM_GHOST_PROP_CONTROL_CLASS}
            >
              <option value="0">Immediate</option>
              <option value="15">15 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </NativeSelect>
          </div>

          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Currency</span>
            <NativeSelect
              id="currency"
              value={formData.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              className={FORM_GHOST_PROP_CONTROL_CLASS}
            >
              <option value="SEK">SEK (Kronor)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="USD">USD (Dollar)</option>
              <option value="NOK">NOK (Kroner)</option>
              <option value="DKK">DKK (Kroner)</option>
            </NativeSelect>
          </div>

          {formData.contactType === 'company' ? (
            <div className={PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">F-tax</span>
              <NativeSelect
                id="fTax"
                value={formData.fTax}
                onChange={(e) => updateField('fTax', e.target.value)}
                className={FORM_GHOST_PROP_CONTROL_CLASS}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </NativeSelect>
            </div>
          ) : null}

          <div className={PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Assignable</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  formData.isAssignable ? 'bg-emerald-500' : 'bg-red-500',
                )}
                aria-hidden
              />
              <Select
                value={formData.isAssignable ? 'yes' : 'no'}
                onValueChange={(value) => updateField('isAssignable', value === 'yes')}
              >
                <SelectTrigger className={FORM_GHOST_PROP_CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">{t('contacts.assignableYes')}</SelectItem>
                  <SelectItem value="no">{t('contacts.assignableNo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={cn(PROP_ROW_CLASS, 'sm:items-start')}>
            <span className="text-sm text-slate-500 dark:text-slate-400">Tags</span>
            <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:max-w-[70%] sm:items-end">
              <Select
                value={tagToAdd || '__add_tag__'}
                onValueChange={(value) => {
                  if (value && value !== '__add_tag__') {
                    addTag(value);
                  }
                }}
                disabled={addableTags.length === 0}
              >
                <SelectTrigger className={cn(FORM_GHOST_PROP_CONTROL_CLASS, 'sm:w-[160px]')}>
                  <SelectValue placeholder="Add a tag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add_tag__">
                    {addableTags.length === 0 ? 'No more tags to add' : 'Add a tag...'}
                  </SelectItem>
                  {addableTags.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(formData.tags as string[]).length > 0 ? (
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {(formData.tags as string[]).map((item) => (
                    <Badge
                      key={item}
                      className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Tag className="h-3 w-3" />
                      {item}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        onClick={() => removeTag(item)}
                        aria-label={`Remove tag ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No tags</span>
              )}
            </div>
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const personsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('contacts.contactPersons', { defaultValue: 'Contact Persons' })}
        icon={Users}
        subtleTitle
        className="p-6"
      >
        {!isCompanyType ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>
            {t('contacts.contactPersonsCompanyOnly', {
              defaultValue: 'Contact persons are available for company contacts.',
            })}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t('contacts.contactPersonsInvoiceReferenceHint')}
            </p>
            <RoundIconLabelButton
              type="button"
              icon={Plus}
              label={t('contacts.addContactPerson', { defaultValue: 'Add Contact' })}
              variant="soft"
              size="xs"
              alwaysExpanded
              onClick={addContactPerson}
            />
            {formData.contactPersons.length === 0 ? (
              <p className={DETAIL_EMPTY_STATE_CLASS}>
                {t('contacts.noContactPersons', {
                  defaultValue: 'No contact persons added yet.',
                })}
              </p>
            ) : (
              formData.contactPersons.map((person, index) => (
                <div key={person.id} className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        {person.name || t('contacts.personFallback', { defaultValue: 'Person' })}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={isContactPersonInvoiceReference(
                            formData.contactPersons,
                            person.id,
                          )}
                          className={CHECKBOX_SM_CLASS}
                          onChange={(e) => setInvoiceReferencePerson(person.id, e.target.checked)}
                          aria-label={t('contacts.invoiceReferenceCheckbox', {
                            name:
                              person.name ||
                              t('contacts.personFallback', { defaultValue: 'Person' }),
                          })}
                        />
                        <span>{t('contacts.invoiceReferenceCheckboxLabel')}</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <RoundIconLabelButton
                          type="button"
                          icon={ArrowUp}
                          label={t('common.moveUp')}
                          variant="secondary"
                          size="xs"
                          expandOnHover={false}
                          disabled={index === 0}
                          onClick={() => moveContactPerson(person.id, 'up')}
                        />
                        <RoundIconLabelButton
                          type="button"
                          icon={ArrowDown}
                          label={t('common.moveDown')}
                          variant="secondary"
                          size="xs"
                          expandOnHover={false}
                          disabled={index === formData.contactPersons.length - 1}
                          onClick={() => moveContactPerson(person.id, 'down')}
                        />
                        <RoundIconLabelButton
                          type="button"
                          icon={Trash2}
                          label={t('common.delete')}
                          variant="dangerSoft"
                          size="xs"
                          expandOnHover={false}
                          onClick={() => removeContactPerson(person.id)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label className={FACT_LABEL_CLASS}>
                        {t('contacts.personName', { defaultValue: 'Name' })}
                      </Label>
                      <Input
                        value={person.name}
                        onChange={(e) => updateContactPerson(person.id, 'name', e.target.value)}
                        className={FORM_GHOST_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>
                        {t('contacts.personTitle', { defaultValue: 'Title' })}
                      </Label>
                      <Input
                        value={person.title}
                        onChange={(e) => updateContactPerson(person.id, 'title', e.target.value)}
                        className={FORM_GHOST_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>
                        {t('contacts.personEmail', { defaultValue: 'Email' })}
                      </Label>
                      <Input
                        type="email"
                        value={person.email}
                        onChange={(e) => updateContactPerson(person.id, 'email', e.target.value)}
                        className={FORM_GHOST_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>
                        {t('contacts.personPhone', { defaultValue: 'Phone' })}
                      </Label>
                      <Input
                        type="tel"
                        value={person.phone}
                        onChange={(e) => updateContactPerson(person.id, 'phone', e.target.value)}
                        className={FORM_GHOST_INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  if (panelMode === 'settings') {
    return <ContactSettingsForm onCancel={onCancel} />;
  }

  return (
    <>
      <div className="plugin-contacts">
        <DetailLayout gridClassName="grid-cols-1">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {formHeader}

            {hasBlockingErrors && (
              <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
                <div className="text-sm font-medium text-destructive">Cannot save contact</div>
                <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                  {validationErrors
                    .filter((error) => !error.message.includes('Warning'))
                    .map((error) => (
                      <li key={`${error.field}-${error.message}`}>{error.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            {activeTab === 'information' ? informationCard : null}

            {activeTab === 'information' ? propertiesCard : null}
            {activeTab === 'addresses' ? addressesCard : null}
            {activeTab === 'persons' ? personsCard : null}
          </form>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={currentContact ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
