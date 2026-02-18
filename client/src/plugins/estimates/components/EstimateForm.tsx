import {
  Plus,
  Trash2,
  Copy,
  User,
  FileText,
  ListOrdered,
  Percent,
  Calculator,
  StickyNote,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useEstimates } from '../hooks/useEstimates';
import { Estimate, LineItem, calculateLineItem, calculateEstimateTotals } from '../types/estimate';

interface EstimateFormProps {
  currentEstimate?: Estimate;
  onSave: (data: any) => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
}

export function EstimateForm({ currentEstimate, onSave, onCancel }: EstimateFormProps) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors } = useEstimates();
  const { contacts } = useApp(); // Cross-plugin data access
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  // Safety check for contacts
  const safeContacts = contacts || [];
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();

  const [formData, setFormData] = useState({
    contactId: '',
    contactName: '',
    organizationNumber: '',
    currency: 'SEK',
    lineItems: [] as LineItem[],
    estimateDiscount: 0, // NEW: Estimate-level discount percentage
    notes: '',
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'draft' as 'draft' | 'sent' | 'accepted' | 'rejected',
  });

  // Track which items are recently duplicated for visual feedback
  const [duplicatedItemIds, setDuplicatedItemIds] = useState<Set<string>>(new Set());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalDiscount: 0,
    subtotalAfterDiscount: 0,
    estimateDiscountAmount: 0, // NEW
    subtotalAfterEstimateDiscount: 0, // NEW
    totalVat: 0,
    total: 0,
  });

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = `estimate-form-${currentEstimate?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentEstimate, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load currentEstimate data when editing
  useEffect(() => {
    if (currentEstimate) {
      // Migrate existing line items to include discount fields
      const migratedLineItems = (currentEstimate.lineItems || []).map((item) => {
        // If item doesn't have discount fields, add them with defaults
        if (!Object.prototype.hasOwnProperty.call(item, 'discount')) {
          return calculateLineItem({
            ...item,
            discount: 0, // Default 0% discount for existing items
          });
        }
        return item;
      });

      setFormData({
        contactId: currentEstimate.contactId || '',
        contactName: currentEstimate.contactName || '',
        organizationNumber: currentEstimate.organizationNumber || '',
        currency: currentEstimate.currency || 'SEK',
        lineItems: migratedLineItems,
        estimateDiscount: currentEstimate.estimateDiscount || 0, // NEW: Load estimate discount
        notes: currentEstimate.notes || '',
        validTo: new Date(currentEstimate.validTo),
        status: currentEstimate.status || 'draft',
      });
      markClean();
      setDuplicatedItemIds(new Set());
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetForm intentionally excluded
  }, [currentEstimate, markClean]);

  // Calculate totals when line items OR estimate discount changes
  useEffect(() => {
    const newTotals = calculateEstimateTotals(formData.lineItems, formData.estimateDiscount);
    setTotals(newTotals);
  }, [formData.lineItems, formData.estimateDiscount]);

  const resetForm = useCallback(() => {
    setFormData({
      contactId: '',
      contactName: '',
      organizationNumber: '',
      currency: 'SEK',
      lineItems: [],
      estimateDiscount: 0, // NEW: Reset estimate discount
      notes: '',
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft',
    });
    markClean();
    setDuplicatedItemIds(new Set());
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave(formData);
      if (result?.success) {
        markClean();
        setDuplicatedItemIds(new Set());
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
      setDuplicatedItemIds(new Set());
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Global functions with correct plural naming
  useEffect(() => {
    window.submitEstimatesForm = handleSubmit; // PLURAL!
    window.cancelEstimatesForm = handleCancel; // PLURAL!

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
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }

    markDirty();
  };

  const handleContactChange = (contactId: string) => {
    const contact = safeContacts.find((c) => c.id === contactId);
    if (contact) {
      setFormData((prev) => ({
        ...prev,
        contactId: contact.id,
        contactName: contact.companyName,
        organizationNumber: contact.organizationNumber || '',
        currency: contact.currency || 'SEK',
      }));
      markDirty();
      clearValidationErrors();
    }
  };

  const addLineItem = () => {
    const newItem = calculateLineItem({
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      vatRate: 25,
      sortOrder: formData.lineItems.length,
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

  const duplicateLineItem = (index: number) => {
    const itemToDuplicate = formData.lineItems[index];
    const newItemId = Date.now().toString();
    const newItem = calculateLineItem({
      ...itemToDuplicate,
      id: newItemId,
      sortOrder: formData.lineItems.length,
    });

    setDuplicatedItemIds((prev) => new Set([...prev, newItemId]));
    updateField('lineItems', [...formData.lineItems, newItem]);
  };

  const removeLineItem = (index: number) => {
    const itemToRemove = formData.lineItems[index];
    setDuplicatedItemIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(itemToRemove.id);
      return newSet;
    });

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
    return validationErrors.find((error) => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

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
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400 dark:text-red-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                    Cannot save estimate
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>Please fix the following errors before saving:</p>
                    <ul className="list-disc list-inside mt-1">
                      {validationErrors
                        .filter((error) => !error.message.includes('Warning'))
                        .map((error, index) => (
                          <li key={error.field ?? index}>{error.message}</li>
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
          <DetailSection title={t('estimates.customerInfo')} icon={User} iconPlugin="estimates">
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <Label htmlFor="estimate-contact" className="mb-1">
                  Customer
                </Label>
                <NativeSelect
                  id="estimate-contact"
                  value={formData.contactId}
                  onChange={(e) => handleContactChange(e.target.value)}
                  className={getFieldError('contactId') ? 'border-red-500' : ''}
                  required
                >
                  <option value="">Select a customer...</option>
                  {safeContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.companyName}{' '}
                      {contact.organizationNumber && `(${contact.organizationNumber})`}
                    </option>
                  ))}
                </NativeSelect>
                {getFieldError('contactId') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {getFieldError('contactId')?.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="estimate-currency" className="mb-1">
                  Currency
                </Label>
                <NativeSelect
                  id="estimate-currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                >
                  <option value="SEK">SEK (Swedish Krona)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="NOK">NOK (Norwegian Krone)</option>
                  <option value="DKK">DKK (Danish Krone)</option>
                </NativeSelect>
              </div>
            </div>
          </DetailSection>
        </Card>

        {/* Estimate Details */}
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection
            title={t('estimates.estimateDetails')}
            icon={FileText}
            iconPlugin="estimates"
          >
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <Label htmlFor="estimate-valid-to" className="mb-1">
                  Valid To
                </Label>
                <Input
                  id="estimate-valid-to"
                  type="date"
                  value={formatValidToDate(formData.validTo)}
                  onChange={(e) => updateField('validTo', parseValidToDate(e.target.value))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="estimate-status" className="mb-1">
                  Status
                </Label>
                <NativeSelect
                  id="estimate-status"
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </NativeSelect>
              </div>
            </div>
          </DetailSection>
        </Card>

        {/* Line Items */}
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title={t('estimates.lineItems')} icon={ListOrdered} iconPlugin="estimates">
            <div className="flex items-center justify-end mb-3">
              <Button
                type="button"
                onClick={addLineItem}
                variant="secondary"
                icon={Plus}
                size="sm"
                className="h-7 text-[10px] px-2"
              >
                Add Item
              </Button>
            </div>

            {formData.lineItems.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No line items added yet.</p>
            ) : (
              <div className="space-y-3">
                {formData.lineItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`border border-gray-200 dark:border-gray-800 rounded-lg p-3 ${
                      duplicatedItemIds.has(item.id) ? 'bg-green-50 dark:bg-green-950/30' : ''
                    }`}
                  >
                    {/* Row 1: Item number + Description + Action */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 w-12">
                        Item {index + 1}
                      </span>
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Service or product description"
                        rows={1}
                        className="flex-1 text-sm resize-none h-auto min-h-[2.5rem]"
                        required
                      />
                      <Button
                        type="button"
                        onClick={() => duplicateLineItem(index)}
                        variant="secondary"
                        icon={Copy}
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        title="Duplicate item"
                      ></Button>
                      <Button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        variant="danger"
                        icon={Trash2}
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                      ></Button>
                    </div>

                    {/* Row 2: Numbers table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Qty
                            </th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Unit Price
                            </th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Discount %
                            </th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              VAT %
                            </th>
                            <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Discount
                            </th>
                            <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              VAT
                            </th>
                            <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)
                                }
                                className="w-16 h-8 px-2 py-1 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                required
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateLineItem(
                                    index,
                                    'unitPrice',
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-20 h-8 px-2 py-1 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                required
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discount || 0}
                                onChange={(e) =>
                                  updateLineItem(index, 'discount', parseFloat(e.target.value) || 0)
                                }
                                className="w-16 h-8 px-2 py-1 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <NativeSelect
                                value={item.vatRate}
                                onChange={(e) =>
                                  updateLineItem(index, 'vatRate', parseFloat(e.target.value))
                                }
                                className="w-16 h-8 px-1 py-1 text-sm"
                              >
                                <option value="0">0%</option>
                                <option value="6">6%</option>
                                <option value="12">12%</option>
                                <option value="25">25%</option>
                              </NativeSelect>
                            </td>
                            <td className="px-2 py-1 text-right text-sm text-gray-900 dark:text-gray-100">
                              -{(item.discountAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-right text-sm text-gray-900 dark:text-gray-100">
                              {(item.vatAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                              {(item.lineTotal || 0).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </Card>

        {/* Estimate Discount - After line items, before totals */}
        {formData.lineItems.length > 0 && (
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title={t('estimates.discount')} icon={Percent} iconPlugin="estimates">
              <div className="flex items-center gap-4 mb-2">
                <Label
                  htmlFor="estimate-discount"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Estimate Discount (%)
                </Label>
                <div className="max-w-xs">
                  <Input
                    id="estimate-discount"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.estimateDiscount || 0}
                    onChange={(e) =>
                      updateField('estimateDiscount', parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Discount applied to subtotal after line item discounts
              </p>
            </DetailSection>
          </Card>
        )}

        {/* Totals Summary */}
        {formData.lineItems.length > 0 && (
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title={t('estimates.summary')} icon={Calculator} iconPlugin="estimates">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {(totals.subtotal || 0).toFixed(2)} {formData.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total Line Item Discounts:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    -{(totals.totalDiscount || 0).toFixed(2)} {formData.currency}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Subtotal after line discounts:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {(totals.subtotalAfterDiscount || 0).toFixed(2)} {formData.currency}
                  </span>
                </div>
                {/* NEW: Show estimate discount if applied */}
                {formData.estimateDiscount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Estimate Discount ({formData.estimateDiscount}%):
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        -{(totals.estimateDiscountAmount || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Subtotal after estimate discount:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(totals.subtotalAfterEstimateDiscount || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total VAT:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {(totals.totalVat || 0).toFixed(2)} {formData.currency}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t border-gray-200 dark:border-gray-800 pt-2">
                  <span>Total:</span>
                  <span>
                    {(totals.total || 0).toFixed(2)} {formData.currency}
                  </span>
                </div>
              </div>
            </DetailSection>
          </Card>
        )}

        {/* Notes */}
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title={t('estimates.notes')} icon={StickyNote} iconPlugin="estimates">
            <div>
              <Label htmlFor="estimate-notes" className="mb-1">
                Additional Notes
              </Label>
              <Textarea
                id="estimate-notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Additional notes or terms..."
                rows={4}
                className="resize-vertical"
              />
            </div>
          </DetailSection>
        </Card>
      </form>

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={currentEstimate ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
}
