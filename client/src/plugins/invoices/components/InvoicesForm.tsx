import { Hash, SlidersHorizontal, StickyNote } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import {
  Invoice,
  InvoiceLineItem,
  calculateInvoiceLineItem,
  calculateInvoiceTotals,
} from '../types/invoices';
import {
  computeDueDateFromPaymentTerms,
  formatInvoiceDueDate,
  parsePaymentTermsDays,
} from '../utils/invoiceDueDate';

import { InvoiceLineItemsEditor } from './InvoiceLineItemsEditor';
import { InvoicePreviewDialog } from './InvoicePreviewDialog';
import { InvoiceStatusSelect } from './InvoiceStatusSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

function formInitials(contactName: string, invoiceNumber?: string | number | null): string {
  const fromContact = String(contactName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  if (fromContact) {
    return fromContact;
  }
  const raw = String(invoiceNumber || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 0) {
    return digits.slice(-2);
  }
  return raw.slice(0, 2).toUpperCase() || '—';
}

const PAYMENT_TERMS_OPTIONS = ['0', '15', '30', '60'] as const;

function normalizePaymentTermsSelectValue(
  paymentTerms: string | number | null | undefined,
): string {
  const days = parsePaymentTermsDays(paymentTerms);
  if (days === null) {
    return '30';
  }
  const asString = String(days);
  return (PAYMENT_TERMS_OPTIONS as readonly string[]).includes(asString) ? asString : asString;
}

function dueDateFromIssueAndTerms(issueDate: Date, paymentTerms: string): Date {
  return (
    computeDueDateFromPaymentTerms(issueDate, paymentTerms) ??
    new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  );
}

interface InvoicesFormProps {
  currentInvoice?: Invoice | null;
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export const InvoicesForm = React.forwardRef<PanelFormHandle, InvoicesFormProps>(
  function InvoicesForm({ currentInvoice, onSave, onCancel }, ref) {
    const { t } = useTranslation();
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
    const [showPreview, setShowPreview] = useState(false);

    const [formData, setFormData] = useState(() => {
      const issueDate = new Date();
      const paymentTerms = '30';
      return {
        contactId: '',
        contactName: '',
        organizationNumber: '',
        currency: 'SEK',
        lineItems: [] as InvoiceLineItem[],
        invoiceDiscount: 0,
        notes: '',
        paymentTerms,
        issueDate,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
        status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled',
        invoiceType: 'invoice' as 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt',
      };
    });

    const totals = useMemo(
      () => calculateInvoiceTotals(formData.lineItems, formData.invoiceDiscount),
      [formData.lineItems, formData.invoiceDiscount],
    );

    useEffect(() => {
      const formKey = `invoice-form-${currentInvoice?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => isDirty);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [isDirty, currentInvoice, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    useEffect(() => {
      if (currentInvoice) {
        const migrated = (currentInvoice.lineItems || []).map((li) => {
          if (typeof li.lineSubtotal === 'number') {
            return li;
          }
          return calculateInvoiceLineItem({ ...li });
        });

        const issueDate = currentInvoice.issueDate
          ? new Date(currentInvoice.issueDate as any)
          : new Date();
        const paymentTerms = normalizePaymentTermsSelectValue(currentInvoice.paymentTerms);
        const storedDue = currentInvoice.dueDate ? new Date(currentInvoice.dueDate as any) : null;
        setFormData({
          contactId: currentInvoice.contactId || '',
          contactName: currentInvoice.contactName || '',
          organizationNumber: currentInvoice.organizationNumber || '',
          currency: currentInvoice.currency || 'SEK',
          lineItems: migrated,
          invoiceDiscount: currentInvoice.invoiceDiscount || 0,
          notes: currentInvoice.notes || '',
          paymentTerms,
          issueDate,
          dueDate: storedDue ?? dueDateFromIssueAndTerms(issueDate, paymentTerms),
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
      const issueDate = new Date();
      const paymentTerms = '30';
      setFormData({
        contactId: '',
        contactName: '',
        organizationNumber: '',
        currency: 'SEK',
        lineItems: [],
        invoiceDiscount: 0,
        notes: '',
        paymentTerms,
        issueDate,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
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

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
        preview: () => setShowPreview(true),
      }),
      [handleSubmit, handleCancel],
    );

    const updateField = (field: string, value: any) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'issueDate' || field === 'paymentTerms') {
          next.dueDate = dueDateFromIssueAndTerms(
            field === 'issueDate' ? value : next.issueDate,
            field === 'paymentTerms' ? value : next.paymentTerms,
          );
        }
        return next;
      });
      if (validationErrors.length > 0) {
        clearValidationErrors();
      }
      markDirty();
    };

    const handleContactChange = (contactId: string) => {
      const contact = safeContacts.find((c) => c.id === contactId);
      if (contact) {
        const paymentTerms = normalizePaymentTermsSelectValue(
          (contact as { paymentTerms?: string }).paymentTerms,
        );
        setFormData((prev) => {
          const issueDate = prev.issueDate;
          return {
            ...prev,
            contactId: contact.id,
            contactName: contact.companyName,
            organizationNumber: contact.organizationNumber || '',
            currency: contact.currency || 'SEK',
            paymentTerms,
            dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
          };
        });
        if (validationErrors.length > 0) {
          clearValidationErrors();
        }
        markDirty();
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

    const moveLineItem = (index: number, direction: 'up' | 'down') => {
      const items = [...formData.lineItems];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) {
        return;
      }
      [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
      items.forEach((item, i) => {
        item.sortOrder = i;
      });
      updateField('lineItems', items);
    };

    const fmtDateInput = (d: Date) => d.toISOString().split('T')[0];
    const parseDateInput = (s: string) => new Date(s + 'T12:00:00');

    const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
    const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));
    const fieldInputClass = 'h-10 text-sm';
    const propSelectClass = 'h-9 w-full max-w-[180px] text-sm';
    const dueDisplay = formatInvoiceDueDate(formData.dueDate);
    const showDueUrgency = formData.status !== 'paid' && formData.status !== 'canceled';

    const invoiceNumberLabel = currentInvoice
      ? formatDisplayNumber('invoices', currentInvoice.invoiceNumber || currentInvoice.id)
      : '';

    const formLeftSidebar = (
      <div className="space-y-4">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <div className="border-b border-border/50 px-4 py-2.5">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold plugin-invoices bg-plugin-subtle text-plugin"
                aria-hidden
              >
                {formInitials(
                  formData.contactName,
                  currentInvoice?.invoiceNumber || currentInvoice?.id,
                )}
              </div>
              <div className="min-w-0 flex-1">
                <NativeSelect
                  id="invoice-contact"
                  value={formData.contactId}
                  onChange={(e) => handleContactChange(e.target.value)}
                  className={cn(
                    'h-9 w-full text-sm font-semibold',
                    getFieldError('contactId') ? 'border-destructive' : '',
                  )}
                  required
                >
                  <option value="">
                    {t('invoices.selectCustomer', { defaultValue: 'Select a customer…' })}
                  </option>
                  {safeContacts.map(
                    (c: { id: string; companyName?: string; organizationNumber?: string }) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} {c.organizationNumber ? `(${c.organizationNumber})` : ''}
                      </option>
                    ),
                  )}
                </NativeSelect>
                {getFieldError('contactId') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('contactId')?.message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            {currentInvoice ? (
              <div>
                <Label className={FACT_LABEL_CLASS}>
                  <Hash className="h-3 w-3" />
                  {t('invoices.table.number')}
                </Label>
                <Input
                  type="text"
                  value={invoiceNumberLabel}
                  readOnly
                  className="h-9 cursor-not-allowed bg-muted text-sm text-muted-foreground"
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="invoice-notes" className={FACT_LABEL_CLASS}>
                <StickyNote className="h-3 w-3" />
                {t('invoices.notesAndTerms')}
              </Label>
              <Textarea
                id="invoice-notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={4}
                placeholder={t('invoices.notesPlaceholder', {
                  defaultValue: 'Additional notes or terms…',
                })}
                className="text-sm"
              />
            </div>
          </div>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('invoices.invoiceProperties', {
              defaultValue: 'Invoice Properties',
            })}
            icon={SlidersHorizontal}
            iconPlugin="invoices"
            subtleTitle
            className="p-6"
          >
            <div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('invoices.propertyStatus', { defaultValue: 'Status' })}
                </span>
                <InvoiceStatusSelect
                  invoice={{ status: formData.status }}
                  onStatusChange={(nextStatus) => updateField('status', nextStatus)}
                  hideInlineLabel
                />
              </div>

              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('invoices.issueDate', { defaultValue: 'Issue Date' })}
                </span>
                <Input
                  id="invoice-issue-date"
                  type="date"
                  value={fmtDateInput(formData.issueDate)}
                  onChange={(e) => updateField('issueDate', parseDateInput(e.target.value))}
                  className="h-9 w-full max-w-[180px] text-sm"
                  required
                />
              </div>

              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('invoices.paymentTerms', { defaultValue: 'Payment terms' })}
                </span>
                <NativeSelect
                  id="invoice-payment-terms"
                  value={formData.paymentTerms}
                  onChange={(e) => updateField('paymentTerms', e.target.value)}
                  className={propSelectClass}
                >
                  <option value="0">
                    {t('invoices.paymentTermsImmediate', { defaultValue: 'Immediate' })}
                  </option>
                  <option value="15">
                    {t('invoices.paymentTermsDays', {
                      defaultValue: '{{count}} days',
                      count: 15,
                    })}
                  </option>
                  <option value="30">
                    {t('invoices.paymentTermsDays', {
                      defaultValue: '{{count}} days',
                      count: 30,
                    })}
                  </option>
                  <option value="60">
                    {t('invoices.paymentTermsDays', {
                      defaultValue: '{{count}} days',
                      count: 60,
                    })}
                  </option>
                  {!(PAYMENT_TERMS_OPTIONS as readonly string[]).includes(formData.paymentTerms) ? (
                    <option value={formData.paymentTerms}>
                      {t('invoices.paymentTermsDays', {
                        defaultValue: '{{count}} days',
                        count: Number(formData.paymentTerms) || 0,
                      })}
                    </option>
                  ) : null}
                </NativeSelect>
              </div>

              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('invoices.fieldDueDate', { defaultValue: 'Due Date' })}
                </span>
                <div
                  className="flex max-w-[180px] flex-col items-end gap-0.5 text-right"
                  title={t('invoices.dueDateFromPaymentTerms', {
                    defaultValue: 'Calculated from issue date + payment terms',
                  })}
                >
                  <span
                    className={cn(
                      'text-sm font-medium',
                      showDueUrgency && dueDisplay ? dueDisplay.className : 'text-foreground',
                    )}
                  >
                    {dueDisplay && showDueUrgency
                      ? dueDisplay.text
                      : formData.dueDate.toLocaleDateString()}
                  </span>
                  {dueDisplay && showDueUrgency ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formData.dueDate.toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('invoices.currency', { defaultValue: 'Currency' })}
                </span>
                <NativeSelect
                  id="invoice-currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className={propSelectClass}
                >
                  <option value="SEK">SEK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="NOK">NOK</option>
                  <option value="DKK">DKK</option>
                </NativeSelect>
              </div>

              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('invoices.invoiceType', { defaultValue: 'Invoice type' })}
                </span>
                <NativeSelect
                  id="invoice-type"
                  value={formData.invoiceType}
                  onChange={(e) => updateField('invoiceType', e.target.value as any)}
                  className={propSelectClass}
                >
                  <option value="invoice">
                    {t('invoices.type.invoice', { defaultValue: 'Invoice' })}
                  </option>
                  <option value="credit_note">
                    {t('invoices.type.credit_note', { defaultValue: 'Credit note' })}
                  </option>
                  <option value="cash_invoice">
                    {t('invoices.type.cash_invoice', { defaultValue: 'Cash invoice' })}
                  </option>
                  <option value="receipt">
                    {t('invoices.type.receipt', { defaultValue: 'Receipt' })}
                  </option>
                </NativeSelect>
              </div>
            </div>
          </DetailSection>
        </Card>
      </div>
    );

    return (
      <>
        <div className="plugin-invoices">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {formLeftSidebar}
            {hasBlockingErrors ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                  <div className="text-sm font-medium text-red-800 dark:text-red-400">
                    {t('common.cannotSave', { defaultValue: 'Cannot save invoice' })}
                  </div>
                  <ul className="mt-2 list-inside list-disc text-sm text-red-700 dark:text-red-400">
                    {validationErrors
                      .filter((e) => !e.message.includes('Warning'))
                      .map((e, i) => (
                        <li key={e.field ?? `err-${i}`}>{e.message}</li>
                      ))}
                  </ul>
                </div>
              </Card>
            ) : null}

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('invoices.lineItems')}
                iconPlugin="invoices"
                subtleTitle
                className="p-6"
              >
                <InvoiceLineItemsEditor
                  items={formData.lineItems}
                  duplicatedItemIds={duplicatedItemIds}
                  onAdd={addLineItem}
                  onUpdate={updateLineItem}
                  onDuplicate={duplicateLineItem}
                  onRemove={removeLineItem}
                  onMoveUp={(i) => moveLineItem(i, 'up')}
                  onMoveDown={(i) => moveLineItem(i, 'down')}
                />
              </DetailSection>
            </Card>

            {formData.lineItems.length > 0 ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('invoices.invoiceDiscount', { defaultValue: 'Invoice Discount' })}
                  iconPlugin="invoices"
                  subtleTitle
                  className="p-6"
                >
                  <div className="max-w-xs">
                    <Label htmlFor="invoice-discount" className={DETAIL_FIELD_LABEL_CLASS}>
                      {t('invoices.discountPercent', { defaultValue: 'Discount %' })}
                    </Label>
                    <Input
                      id="invoice-discount"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.invoiceDiscount}
                      onChange={(e) =>
                        updateField('invoiceDiscount', parseFloat(e.target.value) || 0)
                      }
                      className={fieldInputClass}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('invoices.discountHelp', {
                        defaultValue: 'Discount applied to subtotal after line item discounts',
                      })}
                    </p>
                  </div>
                </DetailSection>
              </Card>
            ) : null}

            {formData.lineItems.length > 0 ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('invoices.pricingSummary')}
                  iconPlugin="invoices"
                  subtleTitle
                  className="p-6"
                >
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('invoices.subtotal', { defaultValue: 'Subtotal' })}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {(totals.subtotal || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('invoices.lineDiscounts', { defaultValue: 'Line Discounts' })}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        -{(totals.totalDiscount || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">
                        {t('invoices.subtotalAfterLineDiscounts', {
                          defaultValue: 'Subtotal after line discounts',
                        })}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {(totals.subtotalAfterDiscount || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                    {formData.invoiceDiscount > 0 ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('invoices.invoiceDiscount', { defaultValue: 'Invoice Discount' })} (
                            {formData.invoiceDiscount}%):
                          </span>
                          <span className="font-medium tabular-nums text-foreground">
                            -{(totals.invoiceDiscountAmount || 0).toFixed(2)} {formData.currency}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="text-muted-foreground">
                            {t('invoices.subtotalAfterInvoiceDiscount', {
                              defaultValue: 'Subtotal after invoice discount',
                            })}
                          </span>
                          <span className="font-medium tabular-nums text-foreground">
                            {(totals.subtotalAfterInvoiceDiscount || 0).toFixed(2)}{' '}
                            {formData.currency}
                          </span>
                        </div>
                      </>
                    ) : null}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('invoices.totalVat', { defaultValue: 'Total VAT' })}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {(totals.totalVat || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
                      <span className="text-foreground">
                        {t('invoices.totalAmount', { defaultValue: 'Total' })}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {(totals.total || 0).toFixed(2)} {formData.currency}
                      </span>
                    </div>
                  </div>
                </DetailSection>
              </Card>
            ) : null}
          </form>
        </div>

        <InvoicePreviewDialog
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          formData={formData}
          invoiceId={currentInvoice?.id}
          invoiceNumber={currentInvoice?.invoiceNumber}
        />

        <ConfirmDialog
          isOpen={showWarning}
          title={t('dialog.unsavedChanges')}
          message={currentInvoice ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
          confirmText={t('dialog.discardChanges')}
          cancelText={t('dialog.continueEditing')}
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
      </>
    );
  },
);
