import { Building, User, Plus, Trash2, CheckSquare } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useContacts } from '../hooks/useContacts';

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
  onSave: (data: any) => void; // Kan kasta vid valideringsfel
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  currentContact,
  onSave,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
}) => {
  const { validationErrors, clearValidationErrors } = useContacts();
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
    // Contact Number & Type
    contactNumber: '',
    contactType: 'company',

    // Basic Information
    companyName: '',
    companyType: 'AB',
    organizationNumber: '',
    vatNumber: '',
    personalNumber: '',

    // Contact Persons
    contactPersons: [] as ContactPerson[],

    // Addresses
    addresses: [] as Address[],

    // Contact Details
    email: '',
    phone: '',
    phone2: '',
    website: '',

    // Tax & Legal
    taxRate: '25',
    paymentTerms: '30',
    currency: 'SEK',
    fTax: 'yes',

    // Notes
    notes: '',

    // Settings
    isAssignable: true,
  });

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = `contact-form-${currentContact?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentContact, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load currentContact data when editing
  useEffect(() => {
    if (currentContact) {
      // Edit mode - load existing data
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
          currentContact.isAssignable !== undefined ? currentContact.isAssignable : true,
      });
      markClean(); // Mark as clean after loading existing data
    } else {
      // Create mode - reset to empty form (including when panel reopens)
      resetForm();
    }
  }, [currentContact, markClean]);

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
      isAssignable: true,
    });
    markClean();
  }, [markClean]);

  // Use internal state or external prop (external takes precedence)
  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  // ⬇️ Fix: Sluta testa truthiness på en void-retur. Hantera istället via try/catch.
  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    } // Prevent double submission

    setIsSubmitting(true);
    try {
      console.log('Form submitting with data:', formData);
      // Stödjer både sync och async onSave
      await Promise.resolve(onSave(formData));

      // ✅ Vid lyckad save
      markClean();
      if (!currentContact) {
        resetForm();
      }
    } catch (err) {
      // ❌ Vid valideringsfel/fel – lämna formuläret öppet så att valideringsfel kan visas
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

  // Global functions with correct plural naming
  useEffect(() => {
    (window as any).submitContactsForm = handleSubmit; // PLURAL!
    (window as any).cancelContactsForm = handleCancel; // PLURAL!

    return () => {
      delete (window as any).submitContactsForm;
      delete (window as any).cancelContactsForm;
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
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  // Helper function to get error for a specific field
  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  // Contact Person Functions
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

  // Address Functions
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

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400 dark:text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                  Cannot save contact
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>Please fix the following errors before saving:</p>
                  <ul className="list-disc list-inside mt-1">
                    {validationErrors
                      .filter((error) => !error.message.includes('Warning'))
                      .map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Contact Number & Type - Mobile Optimized */}
          <DetailSection title="Registration">
            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label
                    htmlFor="contactNumber"
                    className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                  >
                    Contact Number
                  </Label>
                  <Input
                    id="contactNumber"
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) => updateField('contactNumber', e.target.value)}
                    placeholder="e.g. 01"
                    className={getFieldError('contactNumber') ? 'border-red-500' : ''}
                    required
                  />
                  {getFieldError('contactNumber') && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {getFieldError('contactNumber')?.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="mb-1 text-[10px] uppercase font-bold text-gray-400">
                    Contact Type
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formData.contactType === 'company' ? 'default' : 'outline'}
                      onClick={() => updateField('contactType', 'company')}
                      className="flex-1 justify-center"
                    >
                      <Building className="w-4 h-4" />
                      <span>Company</span>
                    </Button>
                    <Button
                      type="button"
                      variant={formData.contactType === 'private' ? 'default' : 'outline'}
                      onClick={() => updateField('contactType', 'private')}
                      className="flex-1 justify-center"
                    >
                      <User className="w-4 h-4" />
                      <span>Private</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DetailSection>

          {/* Basic Information */}
          <DetailSection
            title={
              formData.contactType === 'company' ? 'Company Information' : 'Personal Information'
            }
          >
            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
              {formData.contactType === 'company' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="companyName"
                      className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                    >
                      Company Name
                    </Label>
                    <Input
                      id="companyName"
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      className={getFieldError('companyName') ? 'border-red-500' : ''}
                      required
                    />
                    {getFieldError('companyName') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('companyName')?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="companyType"
                      className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                    >
                      Company Type
                    </Label>
                    <NativeSelect
                      id="companyType"
                      value={formData.companyType}
                      onChange={(e) => updateField('companyType', e.target.value)}
                    >
                      <option value="AB">AB (Aktiebolag)</option>
                      <option value="HB">HB (Handelsbolag)</option>
                      <option value="KB">KB (Kommanditbolag)</option>
                      <option value="EF">Enskild Firma</option>
                    </NativeSelect>
                  </div>

                  <div>
                    <Label
                      htmlFor="organizationNumber"
                      className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                    >
                      Organization Number
                    </Label>
                    <Input
                      id="organizationNumber"
                      type="text"
                      value={formData.organizationNumber}
                      onChange={(e) => updateField('organizationNumber', e.target.value)}
                      placeholder="XXXXXX-XXXX"
                      className={getFieldError('organizationNumber') ? 'border-red-500' : ''}
                    />
                    {getFieldError('organizationNumber') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('organizationNumber')?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="vatNumber"
                      className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                    >
                      VAT Number
                    </Label>
                    <Input
                      id="vatNumber"
                      type="text"
                      value={formData.vatNumber}
                      onChange={(e) => updateField('vatNumber', e.target.value)}
                      placeholder="SE123456789001"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="fullName"
                      className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                    >
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      className={getFieldError('companyName') ? 'border-red-500' : ''}
                      required
                    />
                    {getFieldError('companyName') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('companyName')?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="personalNumber"
                      className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                    >
                      Personal Number
                    </Label>
                    <Input
                      id="personalNumber"
                      type="text"
                      value={formData.personalNumber}
                      onChange={(e) => updateField('personalNumber', e.target.value)}
                      placeholder="YYYYMMDD-XXXX"
                      className={getFieldError('personalNumber') ? 'border-red-500' : ''}
                    />
                    {getFieldError('personalNumber') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('personalNumber')?.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DetailSection>

          {/* Contact Details */}
          <DetailSection title="Contact Details">
            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="email"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={getFieldError('email') ? 'border-yellow-500' : ''}
                />
                {getFieldError('email') && (
                  <p
                    className={`mt-1 text-sm ${
                      getFieldError('email')?.message.includes('Warning')
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {getFieldError('email')?.message}
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="website"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Website
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://"
                />
              </div>

              <div>
                <Label
                  htmlFor="phone"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Phone 1
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+46 70 123 45 67"
                />
              </div>

              <div>
                <Label
                  htmlFor="phone2"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Phone 2
                </Label>
                <Input
                  id="phone2"
                  type="tel"
                  value={formData.phone2}
                  onChange={(e) => updateField('phone2', e.target.value)}
                  placeholder="+46 8 123 456 78"
                />
              </div>
            </div>
          </DetailSection>

          {/* Addresses */}
          <DetailSection title="Addresses">
            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-bold text-gray-400">
                  Postal Addresses
                </span>
                <Button
                  type="button"
                  onClick={addAddress}
                  variant="secondary"
                  icon={Plus}
                  size="sm"
                >
                  Add Address
                </Button>
              </div>

              {formData.addresses.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-xs italic">
                  No addresses added yet.
                </p>
              ) : (
                <div className="space-y-6">
                  {formData.addresses.map((address, index) => (
                    <div
                      key={address.id}
                      className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                          #{index + 1} {address.type || 'Address'}
                        </span>
                        <Button
                          type="button"
                          onClick={() => removeAddress(address.id)}
                          variant="ghost"
                          icon={Trash2}
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        ></Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label
                            htmlFor={`address-type-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Type
                          </Label>
                          <NativeSelect
                            id={`address-type-${address.id}`}
                            value={address.type}
                            onChange={(e) => updateAddress(address.id, 'type', e.target.value)}
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
                          <Label
                            htmlFor={`address-email-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Email
                          </Label>
                          <Input
                            id={`address-email-${address.id}`}
                            type="email"
                            value={address.email}
                            onChange={(e) => updateAddress(address.id, 'email', e.target.value)}
                            placeholder="contact@company.com"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label
                            htmlFor={`address-line1-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Address Line 1
                          </Label>
                          <Input
                            id={`address-line1-${address.id}`}
                            type="text"
                            value={address.addressLine1}
                            onChange={(e) =>
                              updateAddress(address.id, 'addressLine1', e.target.value)
                            }
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label
                            htmlFor={`address-line2-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Address Line 2
                          </Label>
                          <Input
                            id={`address-line2-${address.id}`}
                            type="text"
                            value={address.addressLine2}
                            onChange={(e) =>
                              updateAddress(address.id, 'addressLine2', e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor={`address-postal-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Postal Code
                          </Label>
                          <Input
                            id={`address-postal-${address.id}`}
                            type="text"
                            value={address.postalCode}
                            onChange={(e) =>
                              updateAddress(address.id, 'postalCode', e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor={`address-city-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            City
                          </Label>
                          <Input
                            id={`address-city-${address.id}`}
                            type="text"
                            value={address.city}
                            onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor={`address-region-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Region
                          </Label>
                          <Input
                            id={`address-region-${address.id}`}
                            type="text"
                            value={address.region}
                            onChange={(e) => updateAddress(address.id, 'region', e.target.value)}
                            placeholder="e.g. Skåne"
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor={`address-country-${address.id}`}
                            className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                          >
                            Country
                          </Label>
                          <NativeSelect
                            id={`address-country-${address.id}`}
                            value={address.country}
                            onChange={(e) => updateAddress(address.id, 'country', e.target.value)}
                          >
                            <option value="Sweden">Sweden</option>
                            <option value="Norway">Norway</option>
                            <option value="Denmark">Denmark</option>
                            <option value="Finland">Finland</option>
                          </NativeSelect>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DetailSection>

          {/* Contact Persons (only for companies) */}
          {formData.contactType === 'company' && (
            <DetailSection title="Contact Persons">
              <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    Associated People
                  </span>
                  <Button
                    type="button"
                    onClick={addContactPerson}
                    variant="secondary"
                    icon={Plus}
                    size="sm"
                  >
                    Add Contact
                  </Button>
                </div>

                {formData.contactPersons.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-xs italic">
                    No contact persons added yet.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {formData.contactPersons.map((person, index) => (
                      <div
                        key={person.id}
                        className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                            #{index + 1} {person.name || 'Person'}
                          </span>
                          <Button
                            type="button"
                            onClick={() => removeContactPerson(person.id)}
                            variant="ghost"
                            icon={Trash2}
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                          ></Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <Label
                              htmlFor={`person-name-${person.id}`}
                              className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                            >
                              Name
                            </Label>
                            <Input
                              id={`person-name-${person.id}`}
                              type="text"
                              value={person.name}
                              onChange={(e) =>
                                updateContactPerson(person.id, 'name', e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`person-title-${person.id}`}
                              className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                            >
                              Title
                            </Label>
                            <Input
                              id={`person-title-${person.id}`}
                              type="text"
                              value={person.title}
                              onChange={(e) =>
                                updateContactPerson(person.id, 'title', e.target.value)
                              }
                              placeholder="e.g. CEO, Sales Manager"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`person-email-${person.id}`}
                              className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                            >
                              Email
                            </Label>
                            <Input
                              id={`person-email-${person.id}`}
                              type="email"
                              value={person.email}
                              onChange={(e) =>
                                updateContactPerson(person.id, 'email', e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`person-phone-${person.id}`}
                              className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                            >
                              Phone
                            </Label>
                            <Input
                              id={`person-phone-${person.id}`}
                              type="tel"
                              value={person.phone}
                              onChange={(e) =>
                                updateContactPerson(person.id, 'phone', e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DetailSection>
          )}

          {/* Tax & Business Settings */}
          <DetailSection title="Business Settings">
            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label
                  htmlFor="taxRate"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Tax Rate (%)
                </Label>
                <NativeSelect
                  id="taxRate"
                  value={formData.taxRate}
                  onChange={(e) => updateField('taxRate', e.target.value)}
                >
                  <option value="0">0% (Tax Free)</option>
                  <option value="6">6% (Reduced)</option>
                  <option value="12">12% (Reduced)</option>
                  <option value="25">25% (Standard)</option>
                </NativeSelect>
              </div>

              <div>
                <Label
                  htmlFor="paymentTerms"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Terms (days)
                </Label>
                <NativeSelect
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => updateField('paymentTerms', e.target.value)}
                >
                  <option value="0">Immediate</option>
                  <option value="15">15 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </NativeSelect>
              </div>

              <div>
                <Label
                  htmlFor="currency"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Currency
                </Label>
                <NativeSelect
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                >
                  <option value="SEK">SEK (Kronor)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="USD">USD (Dollar)</option>
                  <option value="NOK">NOK (Kroner)</option>
                  <option value="DKK">DKK (Kroner)</option>
                </NativeSelect>
              </div>

              <div>
                <Label
                  htmlFor="fTax"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  F-Tax
                </Label>
                <NativeSelect
                  id="fTax"
                  value={formData.fTax}
                  onChange={(e) => updateField('fTax', e.target.value)}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </NativeSelect>
              </div>

              <div>
                <Label
                  htmlFor="isAssignable"
                  className="mb-1 text-[10px] uppercase font-bold text-gray-400"
                >
                  Assignable
                </Label>
                <div className="flex items-center h-10">
                  <Switch
                    id="isAssignable"
                    checked={formData.isAssignable}
                    onCheckedChange={(checked) => updateField('isAssignable', checked)}
                  />
                  <Label htmlFor="isAssignable" className="ml-2 cursor-pointer text-sm font-normal">
                    {formData.isAssignable ? 'Yes' : 'No'}
                  </Label>
                </div>
              </div>
            </div>
          </DetailSection>

          {/* Notes */}
          <DetailSection title="Notes">
            <div className="p-4 bg-yellow-50/20 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/50 rounded-xl">
              <Label htmlFor="notes" className="mb-1 text-[10px] uppercase font-bold text-gray-400">
                Additional Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                placeholder="Add any additional notes about this contact..."
                className="resize-vertical bg-transparent border-none p-0 focus-visible:ring-0 italic text-sm"
              />
            </div>
          </DetailSection>
        </div>
      </form>

      {/* Unsaved Changes Warning Dialog */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={
          currentContact
            ? 'You have unsaved changes. Do you want to discard your changes and return to view mode?'
            : 'You have unsaved changes. Do you want to discard your changes and close the form?'
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
