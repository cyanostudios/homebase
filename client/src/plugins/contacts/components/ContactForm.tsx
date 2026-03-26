import { Building, Info, Plus, SlidersHorizontal, Tag, Trash2, User, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';

import { ContactSettingsForm } from './ContactSettingsForm';

const CONTACT_FORM_CARD_CLASS =
  'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

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

interface ContactFormProps {
  currentContact?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  currentContact,
  onSave,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
}) => {
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
      setFormData({
        contactNumber: currentContact.contactNumber || '',
        contactType: currentContact.contactType || 'company',
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
        taxRate: currentContact.taxRate || '25',
        paymentTerms: currentContact.paymentTerms || '30',
        currency: currentContact.currency || 'SEK',
        fTax: currentContact.fTax || 'yes',
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

  useEffect(() => {
    window.submitContactsForm = () => handleSubmit();
    window.cancelContactsForm = () => handleCancel();
    return () => {
      delete window.submitContactsForm;
      delete window.cancelContactsForm;
    };
  }, [handleSubmit, handleCancel]);

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
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const formSidebar = currentContact ? (
    <div className="space-y-4">
      <Card padding="none" className={CONTACT_FORM_CARD_CLASS}>
        <DetailSection
          title={t('contacts.information')}
          icon={Info}
          iconPlugin="contacts"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('contacts', currentContact.id)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {currentContact.createdAt
                  ? new Date(currentContact.createdAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">
                {currentContact.updatedAt
                  ? new Date(currentContact.updatedAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  return (
    <>
      <div
        className={cn(
          'plugin-contacts min-h-full rounded-xl bg-background px-4 py-5 sm:px-5 sm:py-6',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
          <form
            className="space-y-6"
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

            <Card padding="none" className={CONTACT_FORM_CARD_CLASS}>
              <DetailSection
                title={t('contacts.contactContent')}
                iconPlugin="contacts"
                className="p-6"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor="contactNumber"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
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
                            'h-10 text-sm',
                            getFieldError('contactNumber') && 'border-red-500',
                          )}
                          required
                        />
                      ) : (
                        <Input
                          id="contactNumber"
                          type="text"
                          value={formData.contactNumber}
                          readOnly
                          placeholder="Assigned automatically on save"
                          className="h-10 bg-muted text-sm text-muted-foreground cursor-not-allowed"
                        />
                      )}
                      {getFieldError('contactNumber') && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {getFieldError('contactNumber')?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                        Contact Type
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={formData.contactType === 'company' ? 'default' : 'outline'}
                          onClick={() => updateField('contactType', 'company')}
                          className="h-10 text-sm"
                          icon={Building}
                        >
                          Company
                        </Button>
                        <Button
                          type="button"
                          variant={formData.contactType === 'private' ? 'default' : 'outline'}
                          onClick={() => updateField('contactType', 'private')}
                          className="h-10 text-sm"
                          icon={User}
                        >
                          Private
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor="companyName"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        {formData.contactType === 'company' ? 'Company Name *' : 'Full Name *'}
                      </Label>
                      <Input
                        id="companyName"
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => updateField('companyName', e.target.value)}
                        className={cn(
                          'h-10 text-sm',
                          getFieldError('companyName') && 'border-red-500',
                        )}
                        required
                      />
                    </div>

                    {formData.contactType === 'company' ? (
                      <div>
                        <Label
                          htmlFor="companyType"
                          className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                        >
                          Company Type
                        </Label>
                        <NativeSelect
                          id="companyType"
                          value={formData.companyType}
                          onChange={(e) => updateField('companyType', e.target.value)}
                          className="h-10 text-sm"
                        >
                          <option value="AB">AB (Aktiebolag)</option>
                          <option value="HB">HB (Handelsbolag)</option>
                          <option value="KB">KB (Kommanditbolag)</option>
                          <option value="EF">Enskild Firma</option>
                        </NativeSelect>
                      </div>
                    ) : (
                      <div>
                        <Label
                          htmlFor="personalNumber"
                          className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                        >
                          Personal Number
                        </Label>
                        <Input
                          id="personalNumber"
                          type="text"
                          value={formData.personalNumber}
                          onChange={(e) => updateField('personalNumber', e.target.value)}
                          className={cn(
                            'h-10 text-sm',
                            getFieldError('personalNumber') && 'border-red-500',
                          )}
                        />
                      </div>
                    )}

                    <div>
                      <Label
                        htmlFor="organizationNumber"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        Organization Number
                      </Label>
                      <Input
                        id="organizationNumber"
                        type="text"
                        value={formData.organizationNumber}
                        onChange={(e) => updateField('organizationNumber', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="vatNumber"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        VAT Number
                      </Label>
                      <Input
                        id="vatNumber"
                        type="text"
                        value={formData.vatNumber}
                        onChange={(e) => updateField('vatNumber', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="email"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className={cn(
                          'h-10 text-sm',
                          getFieldError('email') && 'border-yellow-500',
                        )}
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="website"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        Website
                      </Label>
                      <Input
                        id="website"
                        type="text"
                        value={formData.website}
                        onChange={(e) => updateField('website', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="phone"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        Phone 1
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="phone2"
                        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                      >
                        Phone 2
                      </Label>
                      <Input
                        id="phone2"
                        type="tel"
                        value={formData.phone2}
                        onChange={(e) => updateField('phone2', e.target.value)}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="notes"
                      className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5"
                    >
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
              </DetailSection>
            </Card>

            <Card padding="none" className={CONTACT_FORM_CARD_CLASS}>
              <div className="space-y-2 p-6">
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {t('contacts.contactProperties')}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Tax Rate (%)</div>
                      <NativeSelect
                        id="taxRate"
                        value={formData.taxRate}
                        onChange={(e) => updateField('taxRate', e.target.value)}
                        className="h-10 max-w-[180px] text-sm"
                      >
                        <option value="0">0% (Tax Free)</option>
                        <option value="6">6% (Reduced)</option>
                        <option value="12">12% (Reduced)</option>
                        <option value="25">25% (Standard)</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Terms (days)</div>
                      <NativeSelect
                        id="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={(e) => updateField('paymentTerms', e.target.value)}
                        className="h-10 max-w-[180px] text-sm"
                      >
                        <option value="0">Immediate</option>
                        <option value="15">15 days</option>
                        <option value="30">30 days</option>
                        <option value="60">60 days</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Currency</div>
                      <NativeSelect
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => updateField('currency', e.target.value)}
                        className="h-10 max-w-[180px] text-sm"
                      >
                        <option value="SEK">SEK (Kronor)</option>
                        <option value="EUR">EUR (Euro)</option>
                        <option value="USD">USD (Dollar)</option>
                        <option value="NOK">NOK (Kroner)</option>
                        <option value="DKK">DKK (Kroner)</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">F-Tax</div>
                      <NativeSelect
                        id="fTax"
                        value={formData.fTax}
                        onChange={(e) => updateField('fTax', e.target.value)}
                        className="h-10 max-w-[180px] text-sm"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Assignable</div>
                      <div className="flex h-10 items-center gap-2">
                        <Switch
                          id="isAssignable"
                          checked={formData.isAssignable}
                          onCheckedChange={(checked) => updateField('isAssignable', checked)}
                        />
                        <Label htmlFor="isAssignable" className="text-xs font-medium">
                          {formData.isAssignable ? 'Yes' : 'No'}
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4 md:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium">Tags</div>
                      <Select
                        value={tagToAdd || '__add_tag__'}
                        onValueChange={(value) => {
                          if (value && value !== '__add_tag__') {
                            addTag(value);
                          }
                        }}
                        disabled={addableTags.length === 0}
                      >
                        <SelectTrigger className="h-10 w-[180px] text-sm">
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
                    </div>
                    {(formData.tags as string[]).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(formData.tags as string[]).map((item) => (
                          <Badge
                            key={item}
                            variant="secondary"
                            className="flex items-center gap-1 text-xs"
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
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="none" className={CONTACT_FORM_CARD_CLASS}>
              <DetailSection title="Addresses" className="p-6">
                <div className="space-y-4">
                  <Button
                    type="button"
                    onClick={addAddress}
                    variant="secondary"
                    icon={Plus}
                    size="sm"
                  >
                    Add Address
                  </Button>
                  {formData.addresses.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">No addresses added yet.</p>
                  ) : (
                    formData.addresses.map((address) => (
                      <div
                        key={address.id}
                        className="rounded-lg border border-border p-4 space-y-4"
                      >
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
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Type
                            </Label>
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
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Email
                            </Label>
                            <Input
                              type="email"
                              value={address.email}
                              onChange={(e) => updateAddress(address.id, 'email', e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Address Line 1
                            </Label>
                            <Input
                              value={address.addressLine1}
                              onChange={(e) =>
                                updateAddress(address.id, 'addressLine1', e.target.value)
                              }
                              className="h-10 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Address Line 2
                            </Label>
                            <Input
                              value={address.addressLine2}
                              onChange={(e) =>
                                updateAddress(address.id, 'addressLine2', e.target.value)
                              }
                              className="h-10 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Postal Code
                            </Label>
                            <Input
                              value={address.postalCode}
                              onChange={(e) =>
                                updateAddress(address.id, 'postalCode', e.target.value)
                              }
                              className="h-10 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              City
                            </Label>
                            <Input
                              value={address.city}
                              onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Region
                            </Label>
                            <Input
                              value={address.region}
                              onChange={(e) => updateAddress(address.id, 'region', e.target.value)}
                              className="h-10 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                              Country
                            </Label>
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

            {formData.contactType === 'company' && (
              <Card padding="none" className={CONTACT_FORM_CARD_CLASS}>
                <DetailSection title="Contact Persons" className="p-6">
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
                          className="rounded-lg border border-border p-4 space-y-4"
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
                              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                                Name
                              </Label>
                              <Input
                                value={person.name}
                                onChange={(e) =>
                                  updateContactPerson(person.id, 'name', e.target.value)
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                                Title
                              </Label>
                              <Input
                                value={person.title}
                                onChange={(e) =>
                                  updateContactPerson(person.id, 'title', e.target.value)
                                }
                                className="h-10 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                                Email
                              </Label>
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
                              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
                                Phone
                              </Label>
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
            )}
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
};
