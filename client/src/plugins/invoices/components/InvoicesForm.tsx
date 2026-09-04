import {
  Calculator,
  Eye,
  Hash,
  ListOrdered,
  Package,
  SlidersHorizontal,
  StickyNote,
  Truck,
} from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import { EMPTY_ORGANIZATION, organizationApi } from '@/core/api/organizationApi';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_PROP_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { formatDate } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import { displayPlainText } from '../utils/htmlText';
import {
  INVOICE_FORM_INPUT_CLASS,
  INVOICE_FORM_PROP_CONTROL_CLASS,
  INVOICE_FORM_TEXTAREA_CLASS,
} from '../utils/invoiceLineItemStyles';
import {
  Invoice,
  InvoiceLineItem,
  DEFAULT_INVOICE_LINE_ITEM_UNIT,
  calculateInvoiceLineItem,
} from '../types/invoices';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';
import {
  computeDueDateFromPaymentTerms,
  formatInvoiceDueDate,
  parsePaymentTermsDays,
} from '../utils/invoiceDueDate';
import {
  displayNameFromEmail,
  fetchLogoAsDataUrl,
  buildInvoiceCustomerBlock,
} from '../utils/invoiceDocumentIdentity';
import {
  openInvoicePreviewWindow,
  writeInvoicePreviewWindow,
} from '../utils/openInvoicePreviewWindow';
import { generateInvoiceWebHTML } from '../webTemplate';

import { InvoiceCustomerSelect } from './InvoiceCustomerSelect';
import { InvoiceDocumentPreview } from './InvoiceDocumentPreview';
import { InvoiceLineItemsEditor } from './InvoiceLineItemsEditor';
import { InvoicePricingSummary } from './InvoicePricingSummary';
import { InvoiceStatusSelect } from './InvoiceStatusSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

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
    const { validationErrors, clearValidationErrors, invoiceCreatePrefill } = useInvoices();
    const { user, contacts } = useApp();

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
        orderNumber: '',
        deliveryMethod: '',
        issueDate,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
        status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'partially_paid',
        invoiceType: 'invoice' as 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt',
      };
    });

    const totals = useMemo(() => resolveInvoiceTotals(formData), [formData]);

    useEffect(() => {
      const formKey = `invoice-form-${currentInvoice?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => isDirty);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [isDirty, currentInvoice, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    useEffect(() => {
      if (currentInvoice) {
        const migrated = (currentInvoice.lineItems || []).map((li) =>
          calculateInvoiceLineItem({ ...li }),
        );

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
          notes: displayPlainText(currentInvoice.notes || ''),
          paymentTerms,
          orderNumber: currentInvoice.orderNumber || '',
          deliveryMethod: currentInvoice.deliveryMethod || '',
          issueDate,
          dueDate: storedDue ?? dueDateFromIssueAndTerms(issueDate, paymentTerms),
          status: (currentInvoice.status as any) || 'draft',
          invoiceType: (currentInvoice.invoiceType as any) || 'invoice',
        });
        markClean();
        setDuplicatedItemIds(new Set());
        return;
      }

      const issueDate = new Date();
      const paymentTerms = normalizePaymentTermsSelectValue(invoiceCreatePrefill?.paymentTerms);
      setFormData({
        contactId: invoiceCreatePrefill?.contactId || '',
        contactName: invoiceCreatePrefill?.contactName || '',
        organizationNumber: invoiceCreatePrefill?.organizationNumber || '',
        currency: invoiceCreatePrefill?.currency || 'SEK',
        lineItems: [],
        invoiceDiscount: 0,
        notes: '',
        paymentTerms,
        orderNumber: '',
        deliveryMethod: '',
        issueDate,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
        status: 'draft',
        invoiceType: 'invoice',
      });
      markClean();
      setDuplicatedItemIds(new Set());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentInvoice, invoiceCreatePrefill]);

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
        orderNumber: '',
        deliveryMethod: '',
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

    const openSharedStylePreview = useCallback(() => {
      const win = openInvoicePreviewWindow();
      if (!win) {
        alert(
          t('invoices.previewPopupBlocked', {
            defaultValue: 'Could not open preview. Allow pop-ups for this site and try again.',
          }),
        );
        return;
      }

      void (async () => {
        try {
          let organization = EMPTY_ORGANIZATION;
          try {
            const org = await organizationApi.getOrganization();
            const logoUrl = org.logoUrl ? await fetchLogoAsDataUrl(org.logoUrl) : '';
            organization = { ...org, logoUrl: logoUrl || org.logoUrl || '' };
          } catch {
            organization = EMPTY_ORGANIZATION;
          }

          const totals = resolveInvoiceTotals(formData);
          const numberLabel = currentInvoice?.invoiceNumber
            ? formatDisplayNumber('invoices', String(currentInvoice.invoiceNumber))
            : currentInvoice?.id
              ? formatDisplayNumber('invoices', String(currentInvoice.id))
              : t('invoices.previewDraftNumber', { defaultValue: 'DRAFT' });
          const contact =
            formData.contactId && contacts
              ? contacts.find((c) => String(c.id) === String(formData.contactId))
              : null;
          const customer = buildInvoiceCustomerBlock({
            contactName: formData.contactName,
            organizationNumber: formData.organizationNumber,
            contactId: formData.contactId,
            contact: contact || null,
          });

          const html = generateInvoiceWebHTML({
            id: currentInvoice?.id || 'draft',
            invoiceNumber: numberLabel,
            contactName: formData.contactName,
            organizationNumber: formData.organizationNumber,
            currency: formData.currency || 'SEK',
            lineItems: formData.lineItems || [],
            invoiceDiscount: formData.invoiceDiscount || 0,
            notes: formData.notes,
            paymentTerms: formData.paymentTerms,
            orderNumber: formData.orderNumber,
            deliveryMethod: formData.deliveryMethod,
            issueDate: formData.issueDate,
            dueDate: formData.dueDate,
            status: formData.status,
            invoiceType: formData.invoiceType,
            ...totals,
            organization,
            referencePerson: displayNameFromEmail(user?.email),
            customer,
          });

          writeInvoicePreviewWindow(win, html, `Faktura ${numberLabel}`, {
            pageBreakLabel: t('invoices.previewPageBreak', { defaultValue: 'Page break' }),
          });
        } catch (error) {
          console.error('Failed to open invoice preview', error);
          try {
            win.close();
          } catch {
            /* ignore */
          }
          alert(
            t('invoices.previewOpenFailed', {
              defaultValue: 'Could not open invoice preview. Try again.',
            }),
          );
        }
      })();
    }, [contacts, currentInvoice, formData, t, user?.email]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
        preview: openSharedStylePreview,
      }),
      [handleSubmit, handleCancel, openSharedStylePreview],
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

    const handleContactChange = (
      contact: {
        id: string | number;
        companyName?: string;
        organizationNumber?: string;
        currency?: string;
        paymentTerms?: string;
      } | null,
    ) => {
      if ((formData.status || 'draft') !== 'draft') {
        return;
      }
      if (contact) {
        const paymentTerms = normalizePaymentTermsSelectValue(contact.paymentTerms);
        setFormData((prev) => {
          const issueDate = prev.issueDate;
          return {
            ...prev,
            contactId: String(contact.id),
            contactName: contact.companyName || '',
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
        return;
      }
      setFormData((prev) => ({
        ...prev,
        contactId: '',
        contactName: '',
        organizationNumber: '',
      }));
      markDirty();
    };

    const addLineItem = () => {
      const newItem = calculateInvoiceLineItem({
        id: Date.now().toString(),
        kind: 'item',
        description: '',
        quantity: 1,
        unit: DEFAULT_INVOICE_LINE_ITEM_UNIT,
        unitPrice: 0,
        discount: 0,
        vatRate: 25,
        sortOrder: formData.lineItems.length,
      });
      updateField('lineItems', [...formData.lineItems, newItem]);
    };

    const addTextFieldLineItem = () => {
      const newItem = calculateInvoiceLineItem({
        id: Date.now().toString(),
        kind: 'text',
        description: '',
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
    const propSelectClass = INVOICE_FORM_PROP_CONTROL_CLASS;
    const dueDisplay = formatInvoiceDueDate(formData.dueDate);
    const showDueUrgency = formData.status !== 'paid' && formData.status !== 'canceled';

    const invoiceNumberLabel = currentInvoice
      ? formatDisplayNumber('invoices', currentInvoice.invoiceNumber || currentInvoice.id)
      : '';

    const formBody = (
      <div className="space-y-4">
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <Card
            padding="none"
            className={cn(DETAIL_VIEW_CARD_CLASS, 'flex h-full min-h-0 flex-col')}
          >
            <InvoiceCustomerSelect
              contactId={formData.contactId}
              contactName={formData.contactName}
              invoiceNumber={currentInvoice?.invoiceNumber || currentInvoice?.id}
              editable={(formData.status || 'draft') === 'draft'}
              onCustomerChange={handleContactChange}
              errorMessage={getFieldError('contactId')?.message ?? null}
            />

            <div className="flex min-h-0 flex-1 flex-col space-y-3 px-4 py-3">
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
                    className={cn(
                      INVOICE_FORM_INPUT_CLASS,
                      'cursor-not-allowed text-muted-foreground',
                    )}
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="invoice-order-number" className={FACT_LABEL_CLASS}>
                  <Package className="h-3 w-3" />
                  {t('invoices.orderNumber', { defaultValue: 'Order number' })}
                </Label>
                <Input
                  id="invoice-order-number"
                  type="text"
                  value={formData.orderNumber}
                  onChange={(e) => updateField('orderNumber', e.target.value)}
                  className={INVOICE_FORM_INPUT_CLASS}
                  placeholder={t('invoices.orderNumberPlaceholder', {
                    defaultValue: 'Optional order number…',
                  })}
                />
              </div>

              <div>
                <Label htmlFor="invoice-delivery-method" className={FACT_LABEL_CLASS}>
                  <Truck className="h-3 w-3" />
                  {t('invoices.deliveryMethod', { defaultValue: 'Delivery method' })}
                </Label>
                <Input
                  id="invoice-delivery-method"
                  type="text"
                  value={formData.deliveryMethod}
                  onChange={(e) => updateField('deliveryMethod', e.target.value)}
                  className={INVOICE_FORM_INPUT_CLASS}
                  placeholder={t('invoices.deliveryMethodPlaceholder', {
                    defaultValue: 'Optional delivery method…',
                  })}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <Label htmlFor="invoice-notes" className={FACT_LABEL_CLASS}>
                  <StickyNote className="h-3 w-3" />
                  {t('invoices.notesAndTerms')}
                </Label>
                <Textarea
                  id="invoice-notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={2}
                  placeholder={t('invoices.notesPlaceholder', {
                    defaultValue: 'Additional notes or terms…',
                  })}
                  className={cn(INVOICE_FORM_TEXTAREA_CLASS, 'min-h-[4.5rem] flex-1')}
                />
              </div>
            </div>
          </Card>

          <Card
            padding="none"
            className={cn(DETAIL_VIEW_CARD_CLASS, 'flex h-full min-h-0 flex-col')}
          >
            <DetailSection
              title={t('invoices.invoiceProperties', {
                defaultValue: 'Invoice Properties',
              })}
              icon={SlidersHorizontal}
              iconPlugin="invoices"
              subtleTitle
              className="flex h-full flex-col p-6"
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
                    filled
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
                    className={propSelectClass}
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
                    {!(PAYMENT_TERMS_OPTIONS as readonly string[]).includes(
                      formData.paymentTerms,
                    ) ? (
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
                        : formatDate(formData.dueDate) || '—'}
                    </span>
                    {dueDisplay && showDueUrgency && dueDisplay.isRelative ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatDate(formData.dueDate) || '—'}
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

                <div className={DETAIL_PROP_ROW_CLASS}>
                  <div className="min-w-0 max-w-[14rem] pr-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('invoices.invoiceDiscount', { defaultValue: 'Invoice Discount' })}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {t('invoices.discountHelp', {
                        defaultValue: 'Discount applied to subtotal after line item discounts',
                      })}
                    </p>
                  </div>
                  <Input
                    id="invoice-discount"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.invoiceDiscount}
                    onChange={(e) =>
                      updateField('invoiceDiscount', parseFloat(e.target.value) || 0)
                    }
                    className={propSelectClass}
                    aria-label={t('invoices.discountPercent', { defaultValue: 'Discount %' })}
                  />
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>

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
            icon={ListOrdered}
            iconPlugin="invoices"
            subtleTitle
            className="px-3 py-6"
          >
            <InvoiceLineItemsEditor
              items={formData.lineItems}
              duplicatedItemIds={duplicatedItemIds}
              onAdd={addLineItem}
              onAddTextField={addTextFieldLineItem}
              onUpdate={updateLineItem}
              onDuplicate={duplicateLineItem}
              onRemove={removeLineItem}
              onMoveUp={(i) => moveLineItem(i, 'up')}
              onMoveDown={(i) => moveLineItem(i, 'down')}
            />
          </DetailSection>
        </Card>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {formData.lineItems.length > 0 ? (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('invoices.pricingSummary')}
                icon={Calculator}
                iconPlugin="invoices"
                subtleTitle
                className="p-6"
              >
                <InvoicePricingSummary
                  totals={totals}
                  currency={formData.currency}
                  invoiceDiscount={Number(formData.invoiceDiscount || 0)}
                />
              </DetailSection>
            </Card>
          ) : null}

          <Card
            padding="none"
            className={cn(
              DETAIL_VIEW_CARD_CLASS,
              formData.lineItems.length === 0 && 'lg:col-span-2',
            )}
          >
            <DetailSection
              title={t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
              icon={Eye}
              subtleTitle
              className="p-6"
            >
              <p className="mb-3 text-xs text-muted-foreground">
                {t('invoices.previewHelp', {
                  defaultValue: 'This is how the invoice will look when shared or exported as PDF.',
                })}
              </p>
              <div className="w-full min-w-0">
                <InvoiceDocumentPreview
                  formData={formData}
                  invoiceId={currentInvoice?.id}
                  invoiceNumber={currentInvoice?.invoiceNumber}
                />
                <div className="mt-4 flex justify-end">
                  <RoundIconLabelButton
                    type="button"
                    icon={Eye}
                    label={t('common.preview')}
                    variant="secondary"
                    size="xs"
                    alwaysExpanded
                    onClick={openSharedStylePreview}
                  />
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>
      </div>
    );

    return (
      <>
        <div className="plugin-invoices">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {formBody}
          </form>
        </div>

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
