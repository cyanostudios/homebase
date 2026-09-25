import {
  Calculator,
  CreditCard,
  Eye,
  Hash,
  History,
  Info,
  Link2,
  ListOrdered,
  Package,
  Percent,
  Receipt,
  SlidersHorizontal,
  StickyNote,
  Truck,
} from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
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
import { runListReorderTransition } from '@/core/ui/listReorderTransition';
import { DatePicker } from '@/core/ui/DatePicker';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_GHOST_PROP_CONTROL_CLASS,
  FORM_GHOST_READONLY_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { formatDate } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useInvoices } from '../hooks/useInvoices';
import { displayPlainText } from '../utils/htmlText';
import { INVOICE_FORM_INPUT_CLASS } from '../utils/invoiceLineItemStyles';
import {
  Invoice,
  InvoiceLineItem,
  DEFAULT_INVOICE_LINE_ITEM_UNIT,
  calculateInvoiceLineItem,
} from '../types/invoices';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';
import {
  deriveInvoiceContentProfile,
  FORENKLAD_TOTAL_CEILING_SEK,
  INVOICE_CURRENCY_OPTIONS,
  INVOICE_VAT_RATES,
  isInvoiceIssued,
  resolveInvoiceCurrency,
  resolveInvoiceVatRateFromContact,
} from '../utils/invoiceMlCompliance';
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
import { InvoiceStatusModal } from './InvoiceStatusModal';
import { InvoiceStatusSelect } from './InvoiceStatusSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

const PAYMENT_TERMS_OPTIONS = ['0', '15', '30', '60'] as const;

type InvoiceFormTab = 'information' | 'lines' | 'payments' | 'linked' | 'activity';

const INVOICE_FORM_TABS: InvoiceFormTab[] = [
  'information',
  'lines',
  'payments',
  'linked',
  'activity',
];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const INVOICE_FORM_EDIT_DISABLED_TABS: ReadonlySet<InvoiceFormTab> = new Set([
  'payments',
  'linked',
  'activity',
]);

const TAB_ERROR_FIELDS: Record<InvoiceFormTab, string[]> = {
  information: [
    'contactId',
    'notes',
    'invoiceType',
    'issueDate',
    'paymentTerms',
    'currency',
    'status',
  ],
  lines: ['lineItems'],
  payments: [],
  linked: [],
  activity: [],
};

function parseInvoiceFormTab(value: string | null): InvoiceFormTab {
  if (value && INVOICE_FORM_TABS.includes(value as InvoiceFormTab)) {
    return value as InvoiceFormTab;
  }
  return 'information';
}

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
  /** Reserved for mail-style list detail column (form is already single-column). */
  stacked?: boolean;
  /** Close/Update rendered in the header card title row — matches view chrome. */
  headerTrailing?: React.ReactNode;
}

export const InvoicesForm = React.forwardRef<PanelFormHandle, InvoicesFormProps>(
  function InvoicesForm(
    { currentInvoice, onSave, onCancel, stacked: _stacked = false, headerTrailing },
    ref,
  ) {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseInvoiceFormTab(searchParams.get('tab'));
    const setActiveTab = useCallback(
      (tab: InvoiceFormTab, replace = false) => {
        if (INVOICE_FORM_EDIT_DISABLED_TABS.has(tab)) {
          return;
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (tab === 'information') {
              next.delete('tab');
            } else {
              next.set('tab', tab);
            }
            return next;
          },
          { replace },
        );
      },
      [setSearchParams],
    );

    useEffect(() => {
      if (!INVOICE_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          return next;
        },
        { replace: true },
      );
    }, [activeTab, setSearchParams]);

    const { validationErrors, clearValidationErrors, invoiceCreatePrefill } = useInvoices();
    const { user, contacts } = useApp();

    const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
      useGlobalNavigationGuard();
    const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
      useUnsavedChanges();

    const [duplicatedItemIds, setDuplicatedItemIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    /** Default VAT for new line items — seeded from contact taxRate, overridable per line. */
    const [defaultVatRate, setDefaultVatRate] = useState(25);

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
        supplyDate: issueDate as Date | null,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
        status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'partially_paid',
        invoiceType: 'invoice' as 'invoice' | 'credit_note' | 'cash_invoice' | 'receipt',
        contentProfile: 'full' as 'full' | 'simplified',
        creditedInvoiceId: null as string | number | null,
        creditedInvoiceNumber: '' as string,
        correctionSummary: '',
      };
    });

    const totals = useMemo(() => resolveInvoiceTotals(formData), [formData]);

    useEffect(() => {
      const formKey = `invoice-form-${currentInvoice?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => true);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [currentInvoice, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
        const supplyDate = currentInvoice.supplyDate
          ? new Date(currentInvoice.supplyDate as any)
          : issueDate;
        setFormData({
          contactId: currentInvoice.contactId || '',
          contactName: currentInvoice.contactName || '',
          organizationNumber: currentInvoice.organizationNumber || '',
          currency: resolveInvoiceCurrency(currentInvoice.currency),
          lineItems: migrated,
          invoiceDiscount: currentInvoice.invoiceDiscount || 0,
          notes: displayPlainText(currentInvoice.notes || ''),
          paymentTerms,
          orderNumber: currentInvoice.orderNumber || '',
          deliveryMethod: currentInvoice.deliveryMethod || '',
          issueDate,
          supplyDate,
          dueDate: storedDue ?? dueDateFromIssueAndTerms(issueDate, paymentTerms),
          status: (currentInvoice.status as any) || 'draft',
          invoiceType: (currentInvoice.invoiceType as any) || 'invoice',
          contentProfile: (currentInvoice.contentProfile as any) || 'full',
          creditedInvoiceId: currentInvoice.creditedInvoiceId ?? null,
          creditedInvoiceNumber: currentInvoice.creditedInvoiceNumber || '',
          correctionSummary: currentInvoice.correctionSummary || '',
        });
        const contactTax = contacts?.find(
          (c) => String(c.id) === String(currentInvoice.contactId),
        )?.taxRate;
        const fromLines = migrated.find((li) => li.kind !== 'text')?.vatRate;
        setDefaultVatRate(
          resolveInvoiceVatRateFromContact(contactTax ?? (fromLines != null ? fromLines : 25)),
        );
        markClean();
        setDuplicatedItemIds(new Set());
        return;
      }

      const issueDate = new Date();
      const paymentTerms = normalizePaymentTermsSelectValue(invoiceCreatePrefill?.paymentTerms);
      const prefillVat = resolveInvoiceVatRateFromContact(invoiceCreatePrefill?.taxRate);
      setDefaultVatRate(prefillVat);
      setFormData({
        contactId: invoiceCreatePrefill?.contactId || '',
        contactName: invoiceCreatePrefill?.contactName || '',
        organizationNumber: invoiceCreatePrefill?.organizationNumber || '',
        currency: resolveInvoiceCurrency(invoiceCreatePrefill?.currency),
        lineItems: [],
        invoiceDiscount: 0,
        notes: '',
        paymentTerms,
        orderNumber: '',
        deliveryMethod: '',
        issueDate,
        supplyDate: issueDate,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
        status: 'draft',
        invoiceType: 'invoice',
        contentProfile: 'full',
        creditedInvoiceId: null,
        creditedInvoiceNumber: '',
        correctionSummary: '',
      });
      markClean();
      setDuplicatedItemIds(new Set());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentInvoice, invoiceCreatePrefill]);

    const resetForm = useCallback(() => {
      const issueDate = new Date();
      const paymentTerms = '30';
      setDefaultVatRate(25);
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
        supplyDate: issueDate,
        dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
        status: 'draft',
        invoiceType: 'invoice',
        contentProfile: 'full',
        creditedInvoiceId: null,
        creditedInvoiceNumber: '',
        correctionSummary: '',
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
      attemptAction(
        () => {
          setDuplicatedItemIds(new Set());
          onCancel();
        },
        { force: true },
      );
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
            supplyDate: formData.supplyDate,
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

    const requestStatusChange = (nextStatus: string) => {
      if (isInvoiceIssued(currentInvoice?.status) && nextStatus === 'draft') {
        return;
      }
      if (nextStatus === 'draft') {
        updateField('status', nextStatus);
        return;
      }
      setPendingStatus(nextStatus);
      setShowStatusModal(true);
    };

    const confirmStatusChange = () => {
      if (pendingStatus) {
        updateField('status', pendingStatus);
      }
      setShowStatusModal(false);
      setPendingStatus(null);
    };

    const cancelStatusChange = () => {
      setShowStatusModal(false);
      setPendingStatus(null);
    };

    const handleContactChange = (
      contact: {
        id: string | number;
        companyName?: string;
        organizationNumber?: string;
        currency?: string;
        paymentTerms?: string;
        taxRate?: string;
        contactType?: string;
      } | null,
    ) => {
      if ((formData.status || 'draft') !== 'draft') {
        return;
      }
      if (contact) {
        const paymentTerms = normalizePaymentTermsSelectValue(contact.paymentTerms);
        const currency = resolveInvoiceCurrency(contact.currency);
        const vatRate = resolveInvoiceVatRateFromContact(
          contact.contactType === 'private' ? '0' : contact.taxRate,
        );
        setDefaultVatRate(vatRate);
        setFormData((prev) => {
          const issueDate = prev.issueDate;
          const lineItems = (prev.lineItems || []).map((item) => {
            if (item?.kind === 'text') {
              return item;
            }
            return calculateInvoiceLineItem({ ...item, vatRate });
          });
          return {
            ...prev,
            contactId: String(contact.id),
            contactName: contact.companyName || '',
            organizationNumber: contact.organizationNumber || '',
            currency,
            paymentTerms,
            dueDate: dueDateFromIssueAndTerms(issueDate, paymentTerms),
            lineItems,
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
        vatRate: defaultVatRate,
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
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= formData.lineItems.length) {
        return;
      }
      runListReorderTransition(() => {
        const items = [...formData.lineItems];
        [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
        items.forEach((item, i) => {
          item.sortOrder = i;
        });
        updateField('lineItems', items);
      });
    };

    const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
    const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));
    const propSelectClass = FORM_GHOST_PROP_CONTROL_CLASS;
    const dueDisplay = formatInvoiceDueDate(formData.dueDate);
    const showDueUrgency = formData.status !== 'paid' && formData.status !== 'canceled';
    const derivedProfile = deriveInvoiceContentProfile({
      invoiceType: formData.invoiceType,
      currency: formData.currency,
      total: totals.total,
    });
    const isCreditNote = formData.invoiceType === 'credit_note';
    const showProfileRow =
      formData.invoiceType === 'receipt' || formData.invoiceType === 'cash_invoice';
    const forenkladOverLimit =
      showProfileRow &&
      String(formData.currency || 'SEK').toUpperCase() === 'SEK' &&
      Math.abs(totals.total) > FORENKLAD_TOTAL_CEILING_SEK;

    const invoiceNumberLabel = currentInvoice
      ? formatDisplayNumber('invoices', currentInvoice.invoiceNumber || currentInvoice.id)
      : '';

    const tabHasError = useCallback(
      (tab: InvoiceFormTab) => {
        const fields = TAB_ERROR_FIELDS[tab];
        if (!fields.length) {
          return false;
        }
        return validationErrors.some(
          (error) => fields.includes(error.field) && !error.message.includes('Warning'),
        );
      },
      [validationErrors],
    );

    const lineItemCount = formData.lineItems.length;

    const tabs = useMemo(
      () => [
        {
          id: 'information' as const,
          label: t('invoices.tabs.information'),
          icon: Info,
          count: null as number | null,
        },
        {
          id: 'lines' as const,
          label: t('invoices.tabs.lines'),
          icon: ListOrdered,
          count: lineItemCount > 0 ? lineItemCount : null,
        },
        {
          id: 'payments' as const,
          label: t('invoices.tabs.payments'),
          icon: CreditCard,
          count: null as number | null,
        },
        {
          id: 'linked' as const,
          label: t('invoices.tabs.linked'),
          icon: Link2,
          count: null as number | null,
        },
        {
          id: 'activity' as const,
          label: t('invoices.tabs.activity'),
          icon: History,
          count: null as number | null,
        },
      ],
      [lineItemCount, t],
    );

    const tabChips = (
      <div className={LIST_FILTER_CHIP_ROW_CLASS}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isDisabled = INVOICE_FORM_EDIT_DISABLED_TABS.has(tab.id);
          const isActive = !isDisabled && activeTab === tab.id;
          const hasError = !isDisabled && tabHasError(tab.id);
          return (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              title={
                isDisabled
                  ? t('tasks.tabUnavailableInEdit', {
                      defaultValue: 'Available in view mode only',
                    })
                  : undefined
              }
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
                isDisabled && 'pointer-events-none opacity-40',
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                {tab.count !== null ? (
                  <>
                    {' '}
                    <span className="tabular-nums font-semibold">({tab.count})</span>
                  </>
                ) : null}
                {hasError ? (
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                    aria-label={t('common.error', { defaultValue: 'Error' })}
                  />
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>
    );

    const formHeader = (
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-invoices flex flex-col')}>
        <div className="px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0" aria-hidden>
              <SectionCategoryIcon
                icon={Receipt}
                className="h-8 w-8 bg-plugin-subtle text-plugin [&_svg]:h-4 [&_svg]:w-4"
              />
            </span>
            <h3
              className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1 font-mono tracking-[0.003em]')}
            >
              {invoiceNumberLabel || t('invoices.newInvoice', { defaultValue: 'New invoice' })}
            </h3>
            {headerTrailing ? (
              <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
            ) : null}
          </div>
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
    );

    const formBody = (
      <div className="space-y-4">
        {formHeader}

        {activeTab === 'information' ? (
          <>
            <div className="grid grid-cols-1 items-stretch gap-4">
              <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
                <InvoiceCustomerSelect
                  contactId={formData.contactId}
                  contactName={formData.contactName}
                  invoiceNumber={currentInvoice?.invoiceNumber || currentInvoice?.id}
                  editable={(formData.status || 'draft') === 'draft'}
                  onCustomerChange={handleContactChange}
                  errorMessage={getFieldError('contactId')?.message ?? null}
                />
              </Card>

              <Card
                padding="none"
                className={cn(DETAIL_VIEW_CARD_CLASS, 'flex h-full min-h-0 flex-col')}
              >
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
                        className={cn(FORM_GHOST_INPUT_CLASS, FORM_GHOST_READONLY_CLASS)}
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
                      className={FORM_GHOST_INPUT_CLASS}
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
                      className={FORM_GHOST_INPUT_CLASS}
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
                      className={cn(FORM_GHOST_TEXTAREA_CLASS, 'min-h-[4.5rem] flex-1')}
                    />
                  </div>

                  {isCreditNote ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                      <div>
                        <div className={FACT_LABEL_CLASS}>
                          <Receipt className="h-3 w-3" />
                          {t('invoices.creditsInvoice', { defaultValue: 'Credits invoice' })}
                        </div>
                        <div className={cn(FORM_GHOST_READONLY_CLASS, 'mt-1')}>
                          {formData.creditedInvoiceNumber
                            ? formatDisplayNumber('invoices', formData.creditedInvoiceNumber)
                            : '—'}
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col">
                        <Label htmlFor="invoice-correction-summary" className={FACT_LABEL_CLASS}>
                          {t('invoices.correctionSummary', {
                            defaultValue: 'Correction summary',
                          })}
                        </Label>
                        <Textarea
                          id="invoice-correction-summary"
                          value={formData.correctionSummary}
                          onChange={(e) => updateField('correctionSummary', e.target.value)}
                          rows={2}
                          placeholder={t('invoices.correctionSummaryPlaceholder', {
                            defaultValue: 'What changed vs the original invoice?',
                          })}
                          className={cn(FORM_GHOST_TEXTAREA_CLASS, 'min-h-[4.5rem] flex-1')}
                        />
                      </div>
                    </div>
                  ) : null}
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
                        {t('invoices.invoiceType', { defaultValue: 'Invoice type' })}
                      </span>
                      {isCreditNote ? (
                        <span className="text-sm font-medium text-foreground">
                          {t('invoices.type.credit_note', { defaultValue: 'Credit note' })}
                        </span>
                      ) : (
                        <NativeSelect
                          id="invoice-type"
                          value={formData.invoiceType}
                          onChange={(e) => updateField('invoiceType', e.target.value as any)}
                          className={propSelectClass}
                        >
                          <option value="invoice">
                            {t('invoices.type.invoice', { defaultValue: 'Invoice' })}
                          </option>
                          <option value="cash_invoice">
                            {t('invoices.type.cash_invoice', { defaultValue: 'Cash invoice' })}
                          </option>
                          <option value="receipt">
                            {t('invoices.type.receipt', { defaultValue: 'Receipt' })}
                          </option>
                        </NativeSelect>
                      )}
                    </div>

                    <div className={DETAIL_PROP_ROW_CLASS}>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {t('invoices.issueDate', { defaultValue: 'Issue Date' })}
                      </span>
                      <DatePicker
                        id="invoice-issue-date"
                        value={formData.issueDate}
                        onChange={(date) => updateField('issueDate', date ?? formData.issueDate)}
                        placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
                        clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
                        variant="default"
                        propWidth
                      />
                    </div>

                    <div className={DETAIL_PROP_ROW_CLASS}>
                      <div className="min-w-0 flex-1 pr-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {t('invoices.supplyDate', { defaultValue: 'Supply date' })}
                        </span>
                        <p className="mt-0.5 text-left text-xs text-muted-foreground">
                          {t('invoices.supplyDateHelp', {
                            defaultValue: 'Defaults to issue date if empty when you issue.',
                          })}
                        </p>
                      </div>
                      <DatePicker
                        id="invoice-supply-date"
                        value={formData.supplyDate}
                        onChange={(date) => updateField('supplyDate', date)}
                        placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
                        clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
                        variant="default"
                        propWidth
                      />
                    </div>

                    <div className={DETAIL_PROP_ROW_CLASS}>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {t('invoices.vatRate', { defaultValue: 'VAT' })}
                      </span>
                      <NativeSelect
                        id="invoice-vat-rate"
                        value={defaultVatRate}
                        onChange={(e) => {
                          const vatRate = resolveInvoiceVatRateFromContact(e.target.value);
                          setDefaultVatRate(vatRate);
                          setFormData((prev) => ({
                            ...prev,
                            lineItems: (prev.lineItems || []).map((item) => {
                              if (item?.kind === 'text') {
                                return item;
                              }
                              return calculateInvoiceLineItem({ ...item, vatRate });
                            }),
                          }));
                          if (validationErrors.length > 0) {
                            clearValidationErrors();
                          }
                          markDirty();
                        }}
                        disabled={(formData.status || 'draft') !== 'draft'}
                        className={propSelectClass}
                        aria-label={t('invoices.vatRate', { defaultValue: 'VAT' })}
                      >
                        {INVOICE_VAT_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </NativeSelect>
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
                        value={resolveInvoiceCurrency(formData.currency)}
                        onChange={(e) => updateField('currency', e.target.value)}
                        disabled={(formData.status || 'draft') !== 'draft'}
                        className={propSelectClass}
                        aria-label={t('invoices.currency', { defaultValue: 'Currency' })}
                      >
                        {INVOICE_CURRENCY_OPTIONS.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>

                    {showProfileRow ? (
                      <div className={DETAIL_PROP_ROW_CLASS}>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {t('invoices.contentProfile', { defaultValue: 'Document profile' })}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {derivedProfile === 'simplified'
                            ? t('invoices.contentProfileSimplified', {
                                defaultValue: 'Simplified',
                              })
                            : t('invoices.contentProfileFull', { defaultValue: 'Full' })}
                        </span>
                      </div>
                    ) : null}

                    {forenkladOverLimit ? (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {t('invoices.forenkladOverLimitHint', {
                          ceiling: FORENKLAD_TOTAL_CEILING_SEK,
                          defaultValue:
                            'Over {{ceiling}} SEK incl. VAT — full invoice fields required (not simplified).',
                        })}
                      </p>
                    ) : null}

                    <div className={DETAIL_PROP_ROW_CLASS}>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {t('invoices.propertyStatus', { defaultValue: 'Status' })}
                      </span>
                      <InvoiceStatusSelect
                        invoice={{ status: formData.status }}
                        onStatusChange={requestStatusChange}
                        hideInlineLabel
                        issuedLocked={isInvoiceIssued(currentInvoice?.status)}
                      />
                    </div>
                  </div>
                </DetailSection>
              </Card>
            </div>

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
                icon={Eye}
                subtleTitle
                className="p-6"
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('invoices.previewHelp', {
                    defaultValue:
                      'This is how the invoice will look when shared or exported as PDF.',
                  })}
                </p>
                <div className="mx-auto w-full min-w-0 max-w-[794px]">
                  <InvoiceDocumentPreview
                    formData={formData}
                    invoiceId={currentInvoice?.id}
                    invoiceNumber={currentInvoice?.invoiceNumber}
                  />
                  <div className="mt-4 flex justify-end gap-2">
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
          </>
        ) : null}

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

        {activeTab === 'lines' ? (
          <>
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

            <div className="space-y-4">
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('invoices.invoiceDiscount', { defaultValue: 'Invoice Discount' })}
                  icon={Percent}
                  iconPlugin="invoices"
                  subtleTitle
                  className="p-6"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="invoice-discount" className="sr-only">
                      {t('invoices.discountPercent', { defaultValue: 'Discount %' })}
                    </Label>
                    <Input
                      id="invoice-discount"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.invoiceDiscount}
                      onChange={(e) =>
                        updateField('invoiceDiscount', parseFloat(e.target.value) || 0)
                      }
                      className={cn(INVOICE_FORM_INPUT_CLASS, 'max-w-[8rem]')}
                      aria-label={t('invoices.discountPercent', { defaultValue: 'Discount %' })}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('invoices.discountHelp', {
                      defaultValue: 'Discount applied to subtotal after line item discounts',
                    })}
                  </p>
                </DetailSection>
              </Card>

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
                    lineItems={formData.lineItems}
                    invoiceType={formData.invoiceType}
                  />
                </DetailSection>
              </Card>
            </div>
          </>
        ) : null}
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

        <InvoiceStatusModal
          isOpen={showStatusModal}
          status={pendingStatus || ''}
          invoiceNumber={currentInvoice?.invoiceNumber || ''}
          isIssuing={(formData.status || 'draft') === 'draft'}
          onConfirm={confirmStatusChange}
          onClose={cancelStatusChange}
        />
      </>
    );
  },
);
