import {
  Building,
  Globe,
  Hash,
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
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_PROP_ROW_CLASS as PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import { COMPANY_TYPE_OPTIONS } from '../types/contacts';

import { ContactSettingsForm } from './ContactSettingsForm';
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
interface ContactPerson {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
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

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '—';
}

interface ContactFormProps {
  currentContact?: any;
  onSave: (data: any) => Promise<boolean> | boolean | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ContactForm = React.forwardRef<PanelFormHandle, ContactFormProps>(function ContactForm(
  { currentContact, onSave, onCancel, isSubmitting: externalIsSubmitting = false },
  ref,
) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode } = useContacts();
  const { getSettings, settingsVersion } = useApp();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
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

  useEffect(() => {
    const formKey = `contact-form-${currentContact?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentContact, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
    attemptAction(() => {
      onCancel();
    });
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

  if (panelMode === 'settings') {
    return <ContactSettingsForm onCancel={onCancel} />;
  }

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

  const updateContactPerson = (id: string, field: keyof ContactPerson, value: string) => {
    setFormData((prev) => ({
      ...prev,
      contactPersons: prev.contactPersons.map((person) =>
        person.id === id ? { ...person, [field]: value } : person,
      ),
    }));
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
  const avatarClass = isCompanyType
    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';

  const formLeftSidebar = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <div className="border-b border-border/50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                avatarClass,
              )}
              aria-hidden
            >
              {contactInitials(formData.companyName || '—')}
            </div>
            <div className="min-w-0 flex-1">
              <Input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder={isCompanyType ? 'Company Name *' : 'Full Name *'}
                className={cn(
                  'h-9 text-lg font-semibold tracking-tight',
                  getFieldError('companyName') && 'border-red-500',
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
        </div>

        <div className="space-y-4 px-4 py-4">
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
                  className={cn('h-9 text-sm', getFieldError('contactNumber') && 'border-red-500')}
                  required
                />
              ) : (
                <Input
                  id="contactNumber"
                  type="text"
                  value={formData.contactNumber}
                  readOnly
                  placeholder="Assigned on save"
                  className="h-9 cursor-not-allowed bg-muted text-sm text-muted-foreground"
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
                  className="h-9 w-full text-sm"
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
                  className={cn('h-9 text-sm', getFieldError('personalNumber') && 'border-red-500')}
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
                    className="h-9 text-sm"
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
                    className="h-9 text-sm"
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
                className={cn('h-9 text-sm', getFieldError('email') && 'border-yellow-500')}
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
                className="h-9 text-sm"
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
                className="h-9 text-sm"
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
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className={FACT_LABEL_CLASS}>
              <StickyNote className="h-3 w-3" />
              Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
        </div>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title="Addresses" icon={MapPin} subtleTitle className="p-6">
          <div className="space-y-4">
            <Button type="button" onClick={addAddress} variant="secondary" icon={Plus} size="sm">
              Add Address
            </Button>
            {formData.addresses.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No addresses added yet.</p>
            ) : (
              formData.addresses.map((address) => (
                <div key={address.id} className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{address.type || 'Address'}</span>
                    <Button
                      type="button"
                      onClick={() => removeAddress(address.id)}
                      variant="ghost"
                      icon={Trash2}
                      size="sm"
                      className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className={FACT_LABEL_CLASS}>Type</Label>
                      <NativeSelect
                        value={address.type}
                        onChange={(e) => updateAddress(address.id, 'type', e.target.value)}
                        className="h-10 text-sm"
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
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className={FACT_LABEL_CLASS}>Address Line 1</Label>
                      <Input
                        value={address.addressLine1}
                        onChange={(e) => updateAddress(address.id, 'addressLine1', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className={FACT_LABEL_CLASS}>Address Line 2</Label>
                      <Input
                        value={address.addressLine2}
                        onChange={(e) => updateAddress(address.id, 'addressLine2', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>Postal Code</Label>
                      <Input
                        value={address.postalCode}
                        onChange={(e) => updateAddress(address.id, 'postalCode', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>City</Label>
                      <Input
                        value={address.city}
                        onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>Region</Label>
                      <Input
                        value={address.region}
                        onChange={(e) => updateAddress(address.id, 'region', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <Label className={FACT_LABEL_CLASS}>Country</Label>
                      <NativeSelect
                        value={address.country}
                        onChange={(e) => updateAddress(address.id, 'country', e.target.value)}
                        className="h-10 text-sm"
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
    </div>
  );

  return (
    <>
      <div className="plugin-contacts">
        <DetailLayout leftSidebar={formLeftSidebar}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm font-medium text-destructive">Cannot save contact</div>
                <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
                  {validationErrors
                    .filter((error) => !error.message.includes('Warning'))
                    .map((error) => (
                      <li key={`${error.field}-${error.message}`}>{error.message}</li>
                    ))}
                </ul>
              </Card>
            )}

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
                      <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                        0% (Tax Free)
                      </Badge>
                    ) : (
                      <NativeSelect
                        id="taxRate"
                        value={formData.taxRate}
                        onChange={(e) => updateField('taxRate', e.target.value)}
                        className="h-9 w-full max-w-[180px] text-sm"
                      >
                        <option value="0">0% (Tax Free)</option>
                        <option value="6">6% (Reduced)</option>
                        <option value="12">12% (Reduced)</option>
                        <option value="25">25% (Standard)</option>
                      </NativeSelect>
                    )}
                  </div>

                  <div className={PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Payment terms
                    </span>
                    <NativeSelect
                      id="paymentTerms"
                      value={formData.paymentTerms}
                      onChange={(e) => updateField('paymentTerms', e.target.value)}
                      className="h-9 w-full max-w-[180px] text-sm"
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
                      className="h-9 w-full max-w-[180px] text-sm"
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
                        value={formData.fTax || 'yes'}
                        onChange={(e) => updateField('fTax', e.target.value)}
                        className="h-9 w-full max-w-[180px] text-sm"
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
                        <SelectTrigger className="h-8 w-[180px] text-xs">
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
                        <SelectTrigger className="h-8 w-full text-xs sm:w-[160px]">
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
                              className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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

            {formData.contactType === 'company' ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title="Contact Persons" icon={Users} subtleTitle className="p-6">
                  <div className="space-y-4">
                    <Button
                      type="button"
                      onClick={addContactPerson}
                      variant="secondary"
                      icon={Plus}
                      size="sm"
                    >
                      Add Contact
                    </Button>
                    {formData.contactPersons.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground">
                        No contact persons added yet.
                      </p>
                    ) : (
                      formData.contactPersons.map((person) => (
                        <div
                          key={person.id}
                          className="space-y-4 rounded-lg border border-border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{person.name || 'Person'}</span>
                            <Button
                              type="button"
                              onClick={() => removeContactPerson(person.id)}
                              variant="ghost"
                              icon={Trash2}
                              size="sm"
                              className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              <span className="sr-only">Remove</span>
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label className={FACT_LABEL_CLASS}>Name</Label>
                              <Input
                                value={person.name}
                                onChange={(e) =>
                                  updateContactPerson(person.id, 'name', e.target.value)
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div>
                              <Label className={FACT_LABEL_CLASS}>Title</Label>
                              <Input
                                value={person.title}
                                onChange={(e) =>
                                  updateContactPerson(person.id, 'title', e.target.value)
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div>
                              <Label className={FACT_LABEL_CLASS}>Email</Label>
                              <Input
                                type="email"
                                value={person.email}
                                onChange={(e) =>
                                  updateContactPerson(person.id, 'email', e.target.value)
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div>
                              <Label className={FACT_LABEL_CLASS}>Phone</Label>
                              <Input
                                type="tel"
                                value={person.phone}
                                onChange={(e) =>
                                  updateContactPerson(person.id, 'phone', e.target.value)
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DetailSection>
              </Card>
            ) : null}
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
