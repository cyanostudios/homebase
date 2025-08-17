import React, { useState, useEffect, useCallback } from 'react';
import { Building, User, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useProducts } from '../hooks/useProducts';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

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

interface ProductFormProps {
  currentItem?: any; // must match pluginRegistry expected prop
  onSave: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  currentItem,
  onSave,
  onCancel,
  isSubmitting = false
}) => {
  const { validationErrors, clearValidationErrors } = useProducts();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } = useGlobalNavigationGuard();

  // Alias current item to product for clarity
  const currentProduct = currentItem;

  const [formData, setFormData] = useState({
    // Product number & type (TEMP: still using contact fields until real product schema)
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
    notes: ''
  });

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = `product-form-${currentProduct?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => { unregisterUnsavedChangesChecker(formKey); };
  }, [isDirty, currentProduct, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load currentProduct data when editing
  useEffect(() => {
    if (currentProduct) {
      setFormData({
        contactNumber: currentProduct.contactNumber || '',
        contactType: currentProduct.contactType || 'company',
        companyName: currentProduct.companyName || '',
        companyType: currentProduct.companyType || 'AB',
        organizationNumber: currentProduct.organizationNumber || '',
        vatNumber: currentProduct.vatNumber || '',
        personalNumber: currentProduct.personalNumber || '',
        contactPersons: currentProduct.contactPersons || [],
        addresses: currentProduct.addresses || [],
        email: currentProduct.email || '',
        phone: currentProduct.phone || '',
        phone2: currentProduct.phone2 || '',
        website: currentProduct.website || '',
        taxRate: currentProduct.taxRate || '25',
        paymentTerms: currentProduct.paymentTerms || '30',
        currency: currentProduct.currency || 'SEK',
        fTax: currentProduct.fTax || 'yes',
        notes: currentProduct.notes || ''
      });
      markClean(); // mark clean after loading
    } else {
      resetForm();
    }
  }, [currentProduct, markClean]);

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
      notes: ''
    });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    const success = await onSave(formData);
    if (success) {
      markClean();
      if (!currentProduct) resetForm();
    }
  }, [formData, onSave, markClean, currentProduct, resetForm]);

  const handleCancel = useCallback(() => {
    attemptAction(() => { onCancel(); });
  }, [attemptAction, onCancel]);

  // Global functions with correct plural naming for this plugin
  useEffect(() => {
    (window as any).submitProductsForm = handleSubmit; // PLURAL!
    (window as any).cancelProductsForm = handleCancel; // PLURAL!
    return () => {
      delete (window as any).submitProductsForm;
      delete (window as any).cancelProductsForm;
    };
  }, [handleSubmit, handleCancel]);

  const handleDiscardChanges = () => {
    if (!currentProduct) {
      resetForm();
      setTimeout(() => { confirmDiscard(); }, 0);
    } else {
      confirmDiscard();
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  // Helper to get error for a specific field
  const getFieldError = (fieldName: string) => validationErrors.find(error => error.field === fieldName);

  // Any blocking errors (non-warning)?
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  // Contact Person Functions
  const addContactPerson = () => {
    const newPerson: ContactPerson = { id: Date.now().toString(), name: '', title: '', email: '', phone: '' };
    setFormData(prev => ({ ...prev, contactPersons: [...prev.contactPersons, newPerson] }));
    markDirty();
  };

  const removeContactPerson = (id: string) => {
    setFormData(prev => ({ ...prev, contactPersons: prev.contactPersons.filter(person => person.id !== id) }));
    markDirty();
  };

  const updateContactPerson = (id: string, field: keyof ContactPerson, value: string) => {
    setFormData(prev => ({
      ...prev,
      contactPersons: prev.contactPersons.map(person => (person.id === id ? { ...person, [field]: value } : person))
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
      email: ''
    };
    setFormData(prev => ({ ...prev, addresses: [...prev.addresses, newAddress] }));
    markDirty();
  };

  const removeAddress = (id: string) => {
    setFormData(prev => ({ ...prev, addresses: prev.addresses.filter(address => address.id !== id) }));
    markDirty();
  };

  const updateAddress = (id: string, field: keyof Address, value: string) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.map(address => (address.id === id ? { ...address, [field]: value } : address))
    }));
    markDirty();
  };

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Cannot save product</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Please fix the following errors before saving:</p>
                    <ul className="list-disc list-inside mt-1">
                      {validationErrors
                        .filter(error => !error.message.includes('Warning'))
                        .map((error, index) => (<li key={index}>{error.message}</li>))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Product Number & Type (TEMP: contact fields kept) */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Product Number & Type</Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
              <input
                type="text"
                value={formData.contactNumber}
                onChange={(e) => updateField('contactNumber', e.target.value)}
                placeholder="01"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('contactNumber') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {getFieldError('contactNumber') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('contactNumber')?.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateField('contactType', 'company')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border-2 transition-colors text-sm flex-1 justify-center ${
                    formData.contactType === 'company' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span className="hidden sm:inline">Company</span>
                  <span className="sm:hidden">Co.</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('contactType', 'private')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border-2 transition-colors text-sm flex-1 justify-center ${
                    formData.contactType === 'private' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Private</span>
                  <span className="sm:hidden">Priv.</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Basic Information */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            {formData.contactType === 'company' ? 'Company Information' : 'Personal Information'}
          </Heading>

          {formData.contactType === 'company' ? (
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('companyName') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {getFieldError('companyName') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('companyName')?.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Type</label>
                <select
                  value={formData.companyType}
                  onChange={(e) => updateField('companyType', e.target.value)}
                  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="AB">AB (Aktiebolag)</option>
                  <option value="HB">HB (Handelsbolag)</option>
                  <option value="KB">KB (Kommanditbolag)</option>
                  <option value="EF">Enskild Firma</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Number</label>
                <input
                  type="text"
                  value={formData.organizationNumber}
                  onChange={(e) => updateField('organizationNumber', e.target.value)}
                  placeholder="XXXXXX-XXXX"
                  className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('organizationNumber') ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {getFieldError('organizationNumber') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('organizationNumber')?.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                <input
                  type="text"
                  value={formData.vatNumber}
                  onChange={(e) => updateField('vatNumber', e.target.value)}
                  placeholder="SE123456789001"
                  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('companyName') ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {getFieldError('companyName') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('companyName')?.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Number</label>
                <input
                  type="text"
                  value={formData.personalNumber}
                  onChange={(e) => updateField('personalNumber', e.target.value)}
                  placeholder="YYYYMMDD-XXXX"
                  className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('personalNumber') ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {getFieldError('personalNumber') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('personalNumber')?.message}</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Contact Details */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">General Contact Details</Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('email') ? 'border-yellow-500' : 'border-gray-300'
                }`}
              />
              {getFieldError('email') && (
                <p className={`mt-1 text-sm ${getFieldError('email')?.message.includes('Warning') ? 'text-yellow-600' : 'text-red-600'}`}>
                  {getFieldError('email')?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://"
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone 1</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+46 70 123 45 67"
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone 2</label>
              <input
                type="tel"
                value={formData.phone2}
                onChange={(e) => updateField('phone2', e.target.value)}
                placeholder="+46 8 123 456 78"
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </Card>

        {/* Addresses */}
        <Card padding="sm" className="shadow-none px-0">
          <div className="flex items-center justify-between mb-3">
            <Heading level={3}>Addresses</Heading>
            <Button type="button" onClick={addAddress} variant="secondary" icon={Plus} size="sm">
              Add Address
            </Button>
          </div>

          {formData.addresses.length === 0 ? (
            <p className="text-gray-500 text-sm">No addresses added yet.</p>
          ) : (
            <div className="space-y-4">
              {formData.addresses.map((address, index) => (
                <div key={address.id} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Address {index + 1}</span>
                    <Button type="button" onClick={() => removeAddress(address.id)} variant="danger" icon={Trash2} size="sm" />
                  </div>

                  <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Type</label>
                      <select
                        value={address.type}
                        onChange={(e) => updateAddress(address.id, 'type', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Main Office">Main Office</option>
                        <option value="Billing Address">Billing Address</option>
                        <option value="Shipping Address">Shipping Address</option>
                        <option value="Branch Office">Branch Office</option>
                        <option value="Home Address">Home Address</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email for this address</label>
                      <input
                        type="email"
                        value={address.email}
                        onChange={(e) => updateAddress(address.id, 'email', e.target.value)}
                        placeholder="contact@company.com"
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                      <input
                        type="text"
                        value={address.addressLine1}
                        onChange={(e) => updateAddress(address.id, 'addressLine1', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                      <input
                        type="text"
                        value={address.addressLine2}
                        onChange={(e) => updateAddress(address.id, 'addressLine2', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={address.postalCode}
                        onChange={(e) => updateAddress(address.id, 'postalCode', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                      <input
                        type="text"
                        value={address.region}
                        onChange={(e) => updateAddress(address.id, 'region', e.target.value)}
                        placeholder="e.g. Skåne"
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <select
                        value={address.country}
                        onChange={(e) => updateAddress(address.id, 'country', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Sweden">Sweden</option>
                        <option value="Norway">Norway</option>
                        <option value="Denmark">Denmark</option>
                        <option value="Finland">Finland</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Notes</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
              placeholder="Add any additional notes about this product..."
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            />
          </div>
        </Card>
      </form>

      {/* Unsaved Changes Warning Dialog */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={currentProduct
          ? "You have unsaved changes. Discard changes and return to view mode?"
          : "You have unsaved changes. Discard changes and close the form?"
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
