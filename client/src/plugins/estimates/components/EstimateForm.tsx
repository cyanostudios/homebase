import React, { useState, useEffect, useCallback } from 'react';
import { useEstimates } from '../hooks/useEstimates';
import { useApp } from '@/core/api/AppContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Heading } from '@/core/ui/Typography';
import { Plus, Trash2 } from 'lucide-react';
import { Estimate, LineItem, calculateLineItem, calculateEstimateTotals } from '../types/estimate';

interface EstimateFormProps {
  currentEstimate?: Estimate;
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export function EstimateForm({ currentEstimate, onSave, onCancel }: EstimateFormProps) {
  const { validationErrors } = useEstimates();
  const { contacts } = useApp(); // Cross-plugin data access
  
  // Safety check for contacts
  const safeContacts = contacts || [];
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
    contactId: '',
    contactName: '',
    organizationNumber: '',
    currency: 'SEK',
    lineItems: [] as LineItem[],
    notes: '',
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'draft' as 'draft' | 'sent' | 'accepted' | 'rejected'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totals, setTotals] = useState({ subtotal: 0, totalVat: 0, total: 0 });

  // Load currentEstimate data when editing
  useEffect(() => {
    if (currentEstimate) {
      setFormData({
        contactId: currentEstimate.contactId || '',
        contactName: currentEstimate.contactName || '',
        organizationNumber: currentEstimate.organizationNumber || '',
        currency: currentEstimate.currency || 'SEK',
        lineItems: currentEstimate.lineItems || [],
        notes: currentEstimate.notes || '',
        validTo: new Date(currentEstimate.validTo),
        status: currentEstimate.status || 'draft'
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentEstimate, markClean]);

  // Calculate totals when line items change
  useEffect(() => {
    const newTotals = calculateEstimateTotals(formData.lineItems);
    setTotals(newTotals);
  }, [formData.lineItems]);

  const resetForm = useCallback(() => {
    setFormData({
      contactId: '',
      contactName: '',
      organizationNumber: '',
      currency: 'SEK',
      lineItems: [],
      notes: '',
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft'
    });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await onSave(formData);
      if (success) {
        markClean();
        if (!currentEstimate) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentEstimate, resetForm, isSubmitting]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Global functions for UniversalPanel footer
  useEffect(() => {
    window.submitEstimatesForm = handleSubmit; // FIXED: Plural form
    window.cancelEstimatesForm = handleCancel; // FIXED: Plural form
    
    return () => {
      delete window.submitEstimatesForm;
      delete window.cancelEstimatesForm;
    };
  }, [handleSubmit, handleCancel]);

  const handleDiscardChanges = () => {
    if (!currentEstimate) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
  };

  const handleContactChange = (contactId: string) => {
    const contact = safeContacts.find(c => c.id === contactId);
    if (contact) {
      setFormData(prev => ({
        ...prev,
        contactId: contact.id,
        contactName: contact.companyName,
        organizationNumber: contact.organizationNumber || '',
        currency: contact.currency || 'SEK'
      }));
      markDirty();
    }
  };

  const addLineItem = () => {
    const newItem = calculateLineItem({
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: 25,
      sortOrder: formData.lineItems.length
    });
    
    updateField('lineItems', [...formData.lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = formData.lineItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        return calculateLineItem(updatedItem);
      }
      return item;
    });
    
    updateField('lineItems', updatedItems);
  };

  const removeLineItem = (index: number) => {
    const updatedItems = formData.lineItems.filter((_, i) => i !== index);
    updateField('lineItems', updatedItems);
  };

  const formatValidToDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const parseValidToDate = (dateString: string): Date => {
    return new Date(dateString + 'T12:00:00');
  };

  // Helper function to get error for a specific field
  const getFieldError = (fieldName: string) => {
    return validationErrors.find(error => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Cannot save estimate
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

        {/* Customer Selection */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Customer Information</Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer
              </label>
              <select
                value={formData.contactId}
                onChange={(e) => handleContactChange(e.target.value)}
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('contactId') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select a customer...</option>
                {safeContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.companyName} {contact.organizationNumber && `(${contact.organizationNumber})`}
                  </option>
                ))}
              </select>
              {getFieldError('contactId') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('contactId')?.message}
                </p>
              )}
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
          </div>
        </Card>

        {/* Estimate Details */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Estimate Details</Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid To
              </label>
              <input
                type="date"
                value={formatValidToDate(formData.validTo)}
                onChange={(e) => updateField('validTo', parseValidToDate(e.target.value))}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card padding="sm" className="shadow-none px-0">
          <div className="flex items-center justify-between mb-3">
            <Heading level={3}>Line Items</Heading>
            <Button
              type="button"
              onClick={addLineItem}
              variant="secondary"
              icon={Plus}
              size="sm"
            >
              Add Item
            </Button>
          </div>

          {formData.lineItems.length === 0 ? (
            <p className="text-gray-500 text-sm">No line items added yet.</p>
          ) : (
            <div className="space-y-3">
              {formData.lineItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                  {/* Row 1: Item number + Description + Action */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 w-12">
                      Item {index + 1}
                    </span>
                    <textarea
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Service or product description"
                      rows={1}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      required
                    />
                    <Button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      variant="danger"
                      icon={Trash2}
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                    >
                    </Button>
                  </div>

                  {/* Row 2: Numbers table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit Price
                          </th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            VAT %
                          </th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subtotal
                          </th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            VAT
                          </th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={item.vatRate}
                              onChange={(e) => updateLineItem(index, 'vatRate', parseFloat(e.target.value))}
                              className="w-16 px-1 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="0">0%</option>
                              <option value="6">6%</option>
                              <option value="12">12%</option>
                              <option value="25">25%</option>
                            </select>
                          </td>
                          <td className="px-2 py-1 text-right text-sm text-gray-900">
                            {item.lineSubtotal.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm text-gray-900">
                            {item.vatAmount.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm font-medium text-gray-900">
                            {item.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Totals Summary */}
        {formData.lineItems.length > 0 && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Summary</Heading>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{totals.subtotal.toFixed(2)} {formData.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total VAT:</span>
                <span className="font-medium">{totals.totalVat.toFixed(2)} {formData.currency}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span>{totals.total.toFixed(2)} {formData.currency}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Notes</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Additional notes or terms..."
              rows={4}
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            />
          </div>
        </Card>

      </form>

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={currentEstimate 
          ? "You have unsaved changes. Do you want to discard your changes and return to view mode?" 
          : "You have unsaved changes. Do you want to discard your changes and close the form?"
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
}