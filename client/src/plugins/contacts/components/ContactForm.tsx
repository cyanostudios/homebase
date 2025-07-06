import React, { useState, useEffect, useCallback } from 'react';
import { Building, User, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useApp } from '@/core/api/AppContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

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
  isSubmitting = false 
}) => {
  const { validationErrors, clearValidationErrors } = useApp();
  const { 
    isDirty, 
    showWarning, 
    markDirty, 
    markClean, 
    attemptAction, 
    confirmDiscard, 
    cancelDiscard 
  } = useUnsavedChanges();
  const [formData, setFormData] = useState({
    // Contact Type
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

  // Load currentContact data when editing
  useEffect(() => {
    if (currentContact) {
      // Edit mode - load existing data
      setFormData({
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
        notes: currentContact.notes || ''
      });
      markClean(); // Mark as clean after loading existing data
    } else {
      // Create mode - reset to empty form (including when panel reopens)
      resetForm();
    }
  }, [currentContact, markClean]);

  const resetForm = useCallback(() => {
    setFormData({
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

  const handleSubmit = useCallback(() => {
    console.log('Form submitting with data:', formData);
    const success = onSave(formData);
    if (success) {
      markClean(); // Mark as clean after successful save
    }
    // If validation failed, form stays open to show errors
    if (!success) {
      console.log('Save failed due to validation errors');
    }
  }, [formData, onSave, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Expose functions to parent for unsaved changes handling
  useEffect(() => {
    // Add submit handler to window so footer button can call it
    window.submitContactForm = handleSubmit;
    
    // Add cancel handler that respects unsaved changes
    window.cancelContactForm = handleCancel;
    
    return () => {
      delete window.submitContactForm;
      delete window.cancelContactForm;
    };
  }, [handleSubmit, handleCancel]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty(); // Mark as dirty when user makes changes
    // Don't clear validation errors while typing - let them persist until next save
  };

  // Helper function to get error for a specific field
  const getFieldError = (fieldName: string) => {
    return validationErrors.find(error => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  // Contact Person Functions
  const addContactPerson = () => {
    const newPerson: ContactPerson = {
      id: Date.now().toString(),
      name: '',
      title: '',
      email: '',
      phone: ''
    };
    setFormData(prev => ({
      ...prev,
      contactPersons: [...prev.contactPersons, newPerson]
    }));
  };

  const removeContactPerson = (id: string) => {
    setFormData(prev => ({
      ...prev,
      contactPersons: prev.contactPersons.filter(person => person.id !== id)
    }));
  };

  const updateContactPerson = (id: string, field: keyof ContactPerson, value: string) => {
    setFormData(prev => ({
      ...prev,
      contactPersons: prev.contactPersons.map(person =>
        person.id === id ? { ...person, [field]: value } : person
      )
    }));
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
      country: 'Sweden'
    };
    setFormData(prev => ({
      ...prev,
      addresses: [...prev.addresses, newAddress]
    }));
  };

  const removeAddress = (id: string) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.filter(address => address.id !== id)
    }));
  };

  const updateAddress = (id: string, field: keyof Address, value: string) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.map(address =>
        address.id === id ? { ...address, [field]: value } : address
      )
    }));
  };

  return (
    <div className="p-6 space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="md">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Cannot save contact
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Please fix the following errors before saving:</p>
                    <ul className="list-disc list-inside mt-1">
                      {validationErrors
                        .filter(error => !error.message.includes('Warning'))
                        .map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
        
        {/* Contact Type Selection */}
        <Card padding="md">
          <Heading level={3} className="mb-3">Contact Type</Heading>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => updateField('contactType', 'company')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors text-base ${
                formData.contactType === 'company' 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Building className="w-5 h-5" />
              Company
            </button>
            <button
              type="button"
              onClick={() => updateField('contactType', 'private')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors text-base ${
                formData.contactType === 'private' 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <User className="w-5 h-5" />
              Private Person
            </button>
          </div>
        </Card>

        {/* Basic Information */}
        <Card padding="md">
          <Heading level={3} className="mb-3">
            {formData.contactType === 'company' ? 'Company Information' : 'Personal Information'}
          </Heading>
          
          {formData.contactType === 'company' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Type
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Number
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Number
                </label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Number
                </label>
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
        <Card padding="md">
          <Heading level={3} className="mb-3">General Contact Details</Heading>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('email') ? 'border-yellow-500' : 'border-gray-300'
                }`}
              />
              {getFieldError('email') && (
                <p className={`mt-1 text-sm ${
                  getFieldError('email')?.message.includes('Warning') ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {getFieldError('email')?.message}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://"
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone 1
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+46 70 123 45 67"
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone 2
              </label>
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
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <Heading level={3}>Addresses</Heading>
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
            <p className="text-gray-500 text-sm">No addresses added yet.</p>
          ) : (
            <div className="space-y-4">
              {formData.addresses.map((address, index) => (
                <div key={address.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Address {index + 1}
                    </span>
                    <Button
                      type="button"
                      onClick={() => removeAddress(address.id)}
                      variant="danger"
                      icon={Trash2}
                      size="sm"
                    >
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Type
                      </label>
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
                    
                    <div></div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 1
                      </label>
                      <input
                        type="text"
                        value={address.addressLine1}
                        onChange={(e) => updateAddress(address.id, 'addressLine1', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={address.addressLine2}
                        onChange={(e) => updateAddress(address.id, 'addressLine2', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={address.postalCode}
                        onChange={(e) => updateAddress(address.id, 'postalCode', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Region
                      </label>
                      <input
                        type="text"
                        value={address.region}
                        onChange={(e) => updateAddress(address.id, 'region', e.target.value)}
                        placeholder="e.g. Skåne"
                        className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country
                      </label>
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

        {/* Contact Persons (only for companies) */}
        {formData.contactType === 'company' && (
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <Heading level={3}>Contact Persons</Heading>
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
              <p className="text-gray-500 text-sm">No contact persons added yet.</p>
            ) : (
              <div className="space-y-4">
                {formData.contactPersons.map((person, index) => (
                  <div key={person.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Contact Person {index + 1}
                      </span>
                      <Button
                        type="button"
                        onClick={() => removeContactPerson(person.id)}
                        variant="danger"
                        icon={Trash2}
                        size="sm"
                      >
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={person.name}
                          onChange={(e) => updateContactPerson(person.id, 'name', e.target.value)}
                          className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={person.title}
                          onChange={(e) => updateContactPerson(person.id, 'title', e.target.value)}
                          placeholder="e.g. CEO, Sales Manager"
                          className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={person.email}
                          onChange={(e) => updateContactPerson(person.id, 'email', e.target.value)}
                          className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={person.phone}
                          onChange={(e) => updateContactPerson(person.id, 'phone', e.target.value)}
                          className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tax & Business Settings */}
        <Card padding="md">
          <Heading level={3} className="mb-3">Tax & Business Settings</Heading>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Rate (%)
              </label>
              <select
                value={formData.taxRate}
                onChange={(e) => updateField('taxRate', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="0">0% (Tax Free)</option>
                <option value="6">6% (Reduced)</option>
                <option value="12">12% (Reduced)</option>
                <option value="25">25% (Standard)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Terms (days)
              </label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => updateField('paymentTerms', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="0">Immediate</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="SEK">SEK (Swedish Krona)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="NOK">NOK (Norwegian Krone)</option>
                <option value="DKK">DKK (Danish Krone)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                F-Tax
              </label>
              <select
                value={formData.fTax}
                onChange={(e) => updateField('fTax', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </Card>
        
        {/* Notes */}
        <Card padding="md">
          <Heading level={3} className="mb-3">Notes</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
              placeholder="Add any additional notes about this contact..."
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            />
          </div>
        </Card>
      </form>
      
      {/* Unsaved Changes Warning Dialog */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={currentContact 
          ? "You have unsaved changes. Do you want to discard your changes and return to view mode?" 
          : "You have unsaved changes. Do you want to discard your changes and close the form?"
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};