// client/src/plugins/invoices/components/InvoicesForm.tsx
import { Plus, Trash2, Copy } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useInvoices } from '../hooks/useInvoices';
import {
  Invoice,
  InvoiceLineItem,
  calculateInvoiceLineItem,
  calculateInvoiceTotals,
} from '../types/invoices';

interface InvoicesFormProps {
  currentInvoice?: Invoice | null;
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export const InvoicesForm: React.FC<InvoicesFormProps> = ({ currentInvoice, onSave, onCancel }) => {
  const { validationErrors, clearValidationErrors } = useInvoices();
  const { contacts } = useApp();
  const safeContacts = contacts || [];

  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();

  const [duplicatedItemIds, setDuplicatedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    contactId: '',
    contactName: '',
    organizationNumber: '',
    currency: 'SEK',
    lineItems: [] as InvoiceLineItem[],
    invoiceDiscount: 0,
    notes: '',
    paymentTerms: '',
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled',
    invoiceType: 'invoice' as 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt',
  });

  // Totals
  const totals = useMemo(
    () => calculateInvoiceTotals(formData.lineItems, formData.invoiceDiscount),
    [formData.lineItems, formData.invoiceDiscount],
  );

  // Register unsaved-checker
  useEffect(() => {
    const formKey = `invoice-form-${currentInvoice?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentInvoice, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load for edit/view
  useEffect(() => {
    if (currentInvoice) {
      const migrated = (currentInvoice.lineItems || []).map((li) => {
        if (typeof li.lineSubtotal === 'number') {
          return li;
        }
        return calculateInvoiceLineItem({ ...li });
      });

      setFormData({
        contactId: currentInvoice.contactId || '',
        contactName: currentInvoice.contactName || '',
        organizationNumber: currentInvoice.organizationNumber || '',
        currency: currentInvoice.currency || 'SEK',
        lineItems: migrated,
        invoiceDiscount: currentInvoice.invoiceDiscount || 0,
        notes: currentInvoice.notes || '',
        paymentTerms: currentInvoice.paymentTerms || '',
        issueDate: currentInvoice.issueDate
          ? new Date(currentInvoice.issueDate as any)
          : new Date(),
        dueDate: currentInvoice.dueDate
          ? new Date(currentInvoice.dueDate as any)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: (currentInvoice.status as any) || 'draft',
        invoiceType: (currentInvoice.invoiceType as any) || 'invoice',
      });
      markClean();
      setDuplicatedItemIds(new Set());
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInvoice]);

  const resetForm = useCallback(() => {
    setFormData({
      contactId: '',
      contactName: '',
      organizationNumber: '',
      currency: 'SEK',
      lineItems: [],
      invoiceDiscount: 0,
      notes: '',
      paymentTerms: '',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft',
      invoiceType: 'invoice',
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
      const success = await onSave(formData);
      if (success) {
        markClean();
        setDuplicatedItemIds(new Set());
        if (!currentInvoice) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentInvoice, resetForm, isSubmitting]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      setDuplicatedItemIds(new Set());
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Kopplad till panelfoten via custom events
  useEffect(() => {
    const onSubmit = () => {
      void handleSubmit();
    };
    const onCancel = () => {
      handleCancel();
    };
    window.addEventListener('submitInvoiceForm', onSubmit as EventListener);
    window.addEventListener('cancelInvoiceForm', onCancel as EventListener);
    return () => {
      window.removeEventListener('submitInvoiceForm', onSubmit as EventListener);
      window.removeEventListener('cancelInvoiceForm', onCancel as EventListener);
    };
  }, [handleSubmit, handleCancel]);

  // Helpers
  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const handleContactChange = (contactId: string) => {
    const contact = safeContacts.find((c) => c.id === contactId);
    if (contact) {
      updateField('contactId', contact.id);
      updateField('contactName', contact.companyName);
      updateField('organizationNumber', contact.organizationNumber || '');
      updateField('currency', contact.currency || 'SEK');
      if ((contact as any).paymentTerms) {
        updateField('paymentTerms', (contact as any).paymentTerms);
      }
    } else {
      updateField('contactId', '');
    }
  };

  const addLineItem = () => {
    const newItem = calculateInvoiceLineItem({
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

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = formData.lineItems.map((item, i) => {
      if (i !== index) {
        return item;
      }
      const patch: any = { ...item, [field]: value };
      return calculateInvoiceLineItem(patch);
    });
    updateField('lineItems', updated);
  };

  const duplicateLineItem = (index: number) => {
    const src = formData.lineItems[index];
    const newId = Date.now().toString();
    const dup = calculateInvoiceLineItem({
      ...src,
      id: newId,
      sortOrder: formData.lineItems.length,
    });
    setDuplicatedItemIds((prev) => new Set([...prev, newId]));
    updateField('lineItems', [...formData.lineItems, dup]);
  };

  const removeLineItem = (index: number) => {
    const victim = formData.lineItems[index];
    setDuplicatedItemIds((prev) => {
      const next = new Set(prev);
      if (victim?.id) {
        next.delete(String(victim.id));
      }
      return next;
    });
    const updated = formData.lineItems.filter((_, i) => i !== index);
    updateField('lineItems', updated);
  };

  const fmtDateInput = (d: Date) => d.toISOString().split('T')[0];
  const parseDateInput = (s: string) => new Date(s + 'T12:00:00');

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {/* Validation summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="text-sm text-red-800 dark:text-red-400 font-medium">
                Cannot save invoice
              </div>
              <ul className="list-disc list-inside mt-2 text-sm text-red-700 dark:text-red-400">
                {validationErrors
                  .filter((e) => !e.message.includes('Warning'))
                  .map((e, i) => (
                    <li key={e.field ?? `err-${i}`}>{e.message}</li>
                  ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Customer */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Customer
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <Label htmlFor="invoice-contact" className="mb-1">
                Customer
              </Label>
              <NativeSelect
                id="invoice-contact"
                value={formData.contactId}
                onChange={(e) => handleContactChange(e.target.value)}
                className={getFieldError('contactId') ? 'border-destructive' : ''}
                required
              >
                <option value="">Select a customer…</option>
                {safeContacts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.organizationNumber ? `(${c.organizationNumber})` : ''}
                  </option>
                ))}
              </NativeSelect>
              {getFieldError('contactId') && (
                <p className="mt-1 text-sm text-destructive">
                  {getFieldError('contactId')?.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="invoice-currency" className="mb-1">
                Currency
              </Label>
              <NativeSelect
                id="invoice-currency"
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
              >
                <option value="SEK">SEK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="NOK">NOK</option>
                <option value="DKK">DKK</option>
              </NativeSelect>
            </div>
          </div>
        </Card>

        {/* Invoice details */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Invoice Details
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <Label htmlFor="invoice-issue-date" className="mb-1">
                Issue Date
              </Label>
              <Input
                id="invoice-issue-date"
                type="date"
                value={fmtDateInput(formData.issueDate)}
                onChange={(e) => updateField('issueDate', parseDateInput(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="invoice-due-date" className="mb-1">
                Due Date
              </Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={fmtDateInput(formData.dueDate)}
                onChange={(e) => updateField('dueDate', parseDateInput(e.target.value))}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="invoice-payment-terms" className="mb-1">
                Payment Terms
              </Label>
              <Input
                id="invoice-payment-terms"
                type="text"
                value={formData.paymentTerms}
                onChange={(e) => updateField('paymentTerms', e.target.value)}
                placeholder="e.g. 30 dagar netto"
              />
            </div>

            <div>
              <Label htmlFor="invoice-type" className="mb-1">
                Invoice Type
              </Label>
              <NativeSelect
                id="invoice-type"
                value={formData.invoiceType}
                onChange={(e) => updateField('invoiceType', e.target.value as any)}
              >
                <option value="invoice">Faktura (Invoice)</option>
                <option value="credit_note">Kreditfaktura (Credit Note)</option>
                <option value="cash_invoice">Kontantfaktura (Cash Invoice)</option>
                <option value="receipt">Kvitto (Receipt)</option>
              </NativeSelect>
            </div>

            <div>
              <Label htmlFor="invoice-status" className="mb-1">
                Status
              </Label>
              <NativeSelect
                id="invoice-status"
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as any)}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="canceled">Canceled</option>
              </NativeSelect>
            </div>
          </div>
        </Card>

        {/* Line items */}
        <Card padding="sm" className="shadow-none px-0">
          <div className="flex items-center justify-between mb-3">
            <Heading level={3}>Line Items</Heading>
            <Button type="button" onClick={addLineItem} variant="secondary" icon={Plus} size="sm">
              Add Item
            </Button>
          </div>

          {formData.lineItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No line items added yet.</p>
          ) : (
            <div className="space-y-3">
              {formData.lineItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className={`border border-border rounded-lg p-3 ${duplicatedItemIds.has(String(item.id)) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                >
                  {/* Row 1 */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-foreground flex-shrink-0 w-12">
                      Item {index + 1}
                    </span>
                    <Textarea
                      value={item.description || ''}
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
                      className="h-8 w-8 p-0"
                      title="Duplicate item"
                    />
                    <Button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      variant="danger"
                      icon={Trash2}
                      size="sm"
                      className="h-8 w-8 p-0"
                    />
                  </div>

                  {/* Row 2: numbers */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Unit Price
                          </th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Discount %
                          </th>
                          <th className="px-2 py-1 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            VAT %
                          </th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Discount
                          </th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            VAT
                          </th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                                updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
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
                              value={item.vatRate || 25}
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
                          <td className="px-2 py-1 text-right text-sm text-foreground">
                            -{(item.discountAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm text-foreground">
                            {(item.vatAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm font-medium text-foreground">
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
        </Card>

        {/* Invoice-level discount */}
        {formData.lineItems.length > 0 && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="flex items-center gap-4 mb-2">
              <Label htmlFor="invoice-discount" className="text-sm font-medium text-foreground">
                Invoice Discount (%)
              </Label>
              <div className="max-w-xs">
                <Input
                  id="invoice-discount"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.invoiceDiscount || 0}
                  onChange={(e) => updateField('invoiceDiscount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Discount applied to subtotal after line item discounts
            </p>
          </Card>
        )}

        {/* Totals */}
        {formData.lineItems.length > 0 && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Summary
            </Heading>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subtotal:</span>
                <span className="text-sm font-medium text-foreground">
                  {(totals.subtotal || 0).toFixed(2)} {formData.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Line Item Discounts:</span>
                <span className="text-sm font-medium text-foreground">
                  -{(totals.totalDiscount || 0).toFixed(2)} {formData.currency}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">
                  Subtotal after line discounts:
                </span>
                <span className="text-sm font-medium text-foreground">
                  {(totals.subtotalAfterDiscount || 0).toFixed(2)} {formData.currency}
                </span>
              </div>
              {formData.invoiceDiscount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Invoice Discount ({formData.invoiceDiscount}%):
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      -{(totals.invoiceDiscountAmount || 0).toFixed(2)} {formData.currency}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-sm text-muted-foreground">
                      Subtotal after invoice discount:
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {(totals.subtotalAfterInvoiceDiscount || 0).toFixed(2)} {formData.currency}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total VAT:</span>
                <span className="text-sm font-medium text-foreground">
                  {(totals.totalVat || 0).toFixed(2)} {formData.currency}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-border pt-2">
                <span className="text-foreground">Total:</span>
                <span className="text-foreground">
                  {(totals.total || 0).toFixed(2)} {formData.currency}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Notes
          </Heading>
          <Textarea
            id="invoice-notes"
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            rows={4}
            placeholder="Additional notes or terms…"
            className="resize-vertical"
          />
        </Card>

        {/* ⬇️ Local Save/Cancel borttaget – panelfoten hanterar detta ⬇️ */}
      </form>

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={
          currentInvoice
            ? 'You have unsaved changes. Discard and return to view mode?'
            : 'You have unsaved changes. Discard and close the form?'
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={() => {
          if (!currentInvoice) {
            resetForm();
            setTimeout(() => confirmDiscard(), 0);
          } else {
            confirmDiscard();
          }
        }}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
