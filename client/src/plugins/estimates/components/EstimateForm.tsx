import {
  Calculator,
  Eye,
  FileSpreadsheet,
  Hash,
  History,
  Info,
  Link2,
  ListOrdered,
  Package,
  Percent,
  SlidersHorizontal,
  StickyNote,
  Truck,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import { EMPTY_ORGANIZATION, organizationApi } from '@/core/api/organizationApi';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DatePicker } from '@/core/ui/DatePicker';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import { runListReorderTransition } from '@/core/ui/listReorderTransition';
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
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { DEFAULT_INVOICE_LINE_ITEM_UNIT } from '@/plugins/invoices/types/invoices';
import {
  buildInvoiceCustomerBlock,
  displayNameFromEmail,
  fetchLogoAsDataUrl,
} from '@/plugins/invoices/utils/invoiceDocumentIdentity';
import { INVOICE_FORM_INPUT_CLASS } from '@/plugins/invoices/utils/invoiceLineItemStyles';
import {
  INVOICE_CURRENCY_OPTIONS,
  INVOICE_VAT_RATES,
  resolveInvoiceCurrency,
  resolveInvoiceVatRateFromContact,
} from '@/plugins/invoices/utils/invoiceMlCompliance';

import { useEstimates } from '../hooks/useEstimates';
import { Estimate, LineItem, calculateLineItem, calculateEstimateTotals } from '../types/estimate';
import {
  openEstimatePreviewWindow,
  writeEstimatePreviewWindow,
} from '../utils/openEstimatePreviewWindow';
import { generateWebHTML } from '../webTemplate';

import { EstimateCustomerSelect } from './EstimateCustomerSelect';
import { EstimateDocumentPreview } from './EstimateDocumentPreview';
import { EstimateLineItemsEditor } from './EstimateLineItemsEditor';
import { EstimatePricingSummary } from './EstimatePricingSummary';
import { EstimateStatusSelect } from './EstimateStatusSelect';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

type EstimateFormTab = 'information' | 'lines' | 'linked' | 'activity';

const ESTIMATE_FORM_TABS: EstimateFormTab[] = ['information', 'lines', 'linked', 'activity'];

const ESTIMATE_FORM_EDIT_DISABLED_TABS: ReadonlySet<EstimateFormTab> = new Set([
  'linked',
  'activity',
]);

const TAB_ERROR_FIELDS: Record<EstimateFormTab, string[]> = {
  information: ['contactId', 'currency', 'validTo', 'status', 'notes'],
  lines: ['lineItems'],
  linked: [],
  activity: [],
};

function parseEstimateFormTab(value: string | null): EstimateFormTab {
  if (value && ESTIMATE_FORM_TABS.includes(value as EstimateFormTab)) {
    return value as EstimateFormTab;
  }
  return 'information';
}

interface EstimateFormProps {
  currentEstimate?: Estimate;
  onSave: (data: any) => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
  /** Single-column layout for mail detail column. */
  stacked?: boolean;
  /** Close/Update rendered in the header card title row — matches view chrome. */
  headerTrailing?: React.ReactNode;
}

export const EstimateForm = React.forwardRef<PanelFormHandle, EstimateFormProps>(
  function EstimateForm(
    { currentEstimate, onSave, onCancel, stacked: _stacked = false, headerTrailing },
    ref,
  ) {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseEstimateFormTab(searchParams.get('tab'));
    const setActiveTab = useCallback(
      (tab: EstimateFormTab, replace = false) => {
        if (ESTIMATE_FORM_EDIT_DISABLED_TABS.has(tab)) {
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
      if (!ESTIMATE_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
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

    const { validationErrors, clearValidationErrors } = useEstimates();
    const { user, contacts } = useApp();
    const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
      useGlobalNavigationGuard();

    const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
      useUnsavedChanges();

    const [formData, setFormData] = useState({
      contactId: '',
      contactName: '',
      organizationNumber: '',
      currency: 'SEK',
      lineItems: [] as LineItem[],
      estimateDiscount: 0, // NEW: Estimate-level discount percentage
      notes: '',
      orderNumber: '',
      deliveryMethod: '',
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'draft' as Estimate['status'],
    });

    // Track which items are recently duplicated for visual feedback
    const [duplicatedItemIds, setDuplicatedItemIds] = useState<Set<string>>(new Set());
    const [showSentConfirm, setShowSentConfirm] = useState(false);
    const [defaultVatRate, setDefaultVatRate] = useState(25);
    const isDraft = (formData.status || 'draft') === 'draft';
    const propSelectClass = FORM_GHOST_PROP_CONTROL_CLASS;

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

    // While create/edit is open, block list + sidebar navigation (same discard prompt as Close).
    useEffect(() => {
      const formKey = `estimate-form-${currentEstimate?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => true);

      return () => {
        unregisterUnsavedChangesChecker(formKey);
      };
    }, [currentEstimate, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
          currency: resolveInvoiceCurrency(currentEstimate.currency),
          lineItems: migratedLineItems,
          estimateDiscount: currentEstimate.estimateDiscount || 0, // NEW: Load estimate discount
          notes: currentEstimate.notes || '',
          orderNumber: currentEstimate.orderNumber || '',
          deliveryMethod: currentEstimate.deliveryMethod || '',
          validTo: new Date(currentEstimate.validTo),
          status: currentEstimate.status || 'draft',
        });
        const firstPriced = migratedLineItems.find((item) => item?.kind !== 'text');
        setDefaultVatRate(firstPriced ? resolveInvoiceVatRateFromContact(firstPriced.vatRate) : 25);
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
        orderNumber: '',
        deliveryMethod: '',
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'draft',
      });
      setDefaultVatRate(25);
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
      attemptAction(
        () => {
          setDuplicatedItemIds(new Set());
          onCancel();
        },
        { force: true },
      );
    }, [attemptAction, onCancel]);

    const openSharedStylePreview = useCallback(() => {
      const win = openEstimatePreviewWindow();
      if (!win) {
        alert(
          t('estimates.previewPopupBlocked', {
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

          const totals = calculateEstimateTotals(
            formData.lineItems || [],
            formData.estimateDiscount || 0,
          );
          const numberLabel = currentEstimate?.estimateNumber
            ? formatDisplayNumber('estimates', String(currentEstimate.estimateNumber))
            : currentEstimate?.id
              ? formatDisplayNumber('estimates', String(currentEstimate.id))
              : t('estimates.previewDraftNumber', { defaultValue: 'DRAFT' });
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

          const html = generateWebHTML({
            id: currentEstimate?.id || 'draft',
            estimateNumber: numberLabel,
            contactName: formData.contactName,
            organizationNumber: formData.organizationNumber,
            currency: formData.currency || 'SEK',
            lineItems: formData.lineItems || [],
            estimateDiscount: formData.estimateDiscount || 0,
            notes: formData.notes,
            orderNumber: formData.orderNumber,
            deliveryMethod: formData.deliveryMethod,
            validTo: formData.validTo,
            status: formData.status,
            createdAt: currentEstimate?.createdAt || new Date(),
            ...totals,
            organization,
            referencePerson: displayNameFromEmail(user?.email),
            customer,
          });

          writeEstimatePreviewWindow(win, html, `Offert ${numberLabel}`, {
            pageBreakLabel: t('estimates.previewPageBreak', { defaultValue: 'Page break' }),
          });
        } catch (error) {
          console.error('Failed to open estimate preview', error);
          try {
            win.close();
          } catch {
            /* ignore */
          }
          alert(
            t('estimates.previewOpenFailed', {
              defaultValue: 'Could not open estimate preview. Try again.',
            }),
          );
        }
      })();
    }, [contacts, currentEstimate, formData, t, user?.email]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
        preview: openSharedStylePreview,
      }),
      [handleSubmit, handleCancel, openSharedStylePreview],
    );

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

    const requestStatusChange = (nextStatus: string) => {
      if (nextStatus === 'sent' && formData.status !== 'sent') {
        setShowSentConfirm(true);
        return;
      }
      updateField('status', nextStatus);
    };

    const confirmMarkAsSent = () => {
      updateField('status', 'sent');
      setShowSentConfirm(false);
    };

    const handleContactChange = (
      contact: {
        id: string | number;
        companyName?: string;
        organizationNumber?: string;
        currency?: string;
        taxRate?: string;
        contactType?: string;
      } | null,
    ) => {
      if ((formData.status || 'draft') !== 'draft') {
        return;
      }
      if (contact) {
        const currency = resolveInvoiceCurrency(contact.currency);
        const vatRate = resolveInvoiceVatRateFromContact(
          contact.contactType === 'private' ? '0' : contact.taxRate,
        );
        setDefaultVatRate(vatRate);
        setFormData((prev) => ({
          ...prev,
          contactId: String(contact.id),
          contactName: contact.companyName || '',
          organizationNumber: contact.organizationNumber || '',
          currency,
          lineItems: (prev.lineItems || []).map((item) => {
            if (item?.kind === 'text') {
              return item;
            }
            return calculateLineItem({ ...item, vatRate });
          }),
        }));
        markDirty();
        clearValidationErrors();
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
      const newItem = calculateLineItem({
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
      const newItem = calculateLineItem({
        id: Date.now().toString(),
        kind: 'text',
        description: '',
        sortOrder: formData.lineItems.length,
      });
      updateField('lineItems', [...formData.lineItems, newItem]);
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
        if (itemToRemove.id) {
          newSet.delete(itemToRemove.id);
        }
        return newSet;
      });

      const updatedItems = formData.lineItems.filter((_, i) => i !== index);
      updateField('lineItems', updatedItems);
    };

    // Helper function to get error for a specific field
    const getFieldError = (fieldName: string) => {
      return validationErrors.find((error) => error.field === fieldName);
    };

    // Check if there are any blocking errors (non-warning)
    const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

    const tabHasError = useCallback(
      (tab: EstimateFormTab) => {
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
          label: t('estimates.tabs.information', { defaultValue: 'Information' }),
          icon: Info,
          count: null as number | null,
        },
        {
          id: 'lines' as const,
          label: t('estimates.tabs.lines'),
          icon: ListOrdered,
          count: lineItemCount > 0 ? lineItemCount : null,
        },
        {
          id: 'linked' as const,
          label: t('estimates.tabs.linked', { defaultValue: 'Linked' }),
          icon: Link2,
          count: null as number | null,
        },
        {
          id: 'activity' as const,
          label: t('estimates.tabs.activity'),
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
          const isDisabled = ESTIMATE_FORM_EDIT_DISABLED_TABS.has(tab.id);
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

    const estimateTitle = currentEstimate
      ? formatDisplayNumber('estimates', currentEstimate.estimateNumber)
      : t('estimates.newEstimate', { defaultValue: 'New estimate' });

    const formHeader = (
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0" aria-hidden>
              <SectionCategoryIcon
                icon={FileSpreadsheet}
                className="h-8 w-8 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 [&_svg]:h-4 [&_svg]:w-4"
              />
            </span>
            <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1 tracking-[0.003em]')}>
              {estimateTitle}
            </h3>
            {headerTrailing ? (
              <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
            ) : null}
          </div>
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
    );

    return (
      <>
        <div className="plugin-estimates">
          <DetailLayout gridClassName="grid-cols-1">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              {formHeader}

              {/* Validation Summary */}
              {hasBlockingErrors && (
                <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
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

              {activeTab === 'information' ? (
                <>
                  <div className="grid grid-cols-1 items-stretch gap-4">
                    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
                      <EstimateCustomerSelect
                        contactId={formData.contactId}
                        contactName={formData.contactName}
                        estimateNumber={currentEstimate?.estimateNumber || currentEstimate?.id}
                        editable={formData.status === 'draft'}
                        onCustomerChange={handleContactChange}
                        errorMessage={getFieldError('contactId')?.message ?? null}
                      />
                    </Card>

                    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                      <div className="space-y-3 px-4 py-3">
                        {currentEstimate ? (
                          <div>
                            <Label className={FACT_LABEL_CLASS}>
                              <Hash className="h-3 w-3" />
                              {t('estimates.table.number')}
                            </Label>
                            <Input
                              type="text"
                              value={formatDisplayNumber(
                                'estimates',
                                currentEstimate.estimateNumber || currentEstimate.id,
                              )}
                              readOnly
                              className={cn(FORM_GHOST_INPUT_CLASS, FORM_GHOST_READONLY_CLASS)}
                            />
                          </div>
                        ) : null}
                        <div>
                          <Label htmlFor="estimate-order-number" className={FACT_LABEL_CLASS}>
                            <Package className="h-3 w-3" />
                            {t('invoices.orderNumber', { defaultValue: 'Order number' })}
                          </Label>
                          <Input
                            id="estimate-order-number"
                            value={formData.orderNumber}
                            onChange={(e) => updateField('orderNumber', e.target.value)}
                            className={FORM_GHOST_INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <Label htmlFor="estimate-delivery-method" className={FACT_LABEL_CLASS}>
                            <Truck className="h-3 w-3" />
                            {t('invoices.deliveryMethod', { defaultValue: 'Delivery method' })}
                          </Label>
                          <Input
                            id="estimate-delivery-method"
                            value={formData.deliveryMethod}
                            onChange={(e) => updateField('deliveryMethod', e.target.value)}
                            className={FORM_GHOST_INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <Label htmlFor="estimate-notes" className={FACT_LABEL_CLASS}>
                            <StickyNote className="h-3 w-3" />
                            {t('estimates.notes')}
                          </Label>
                          <Textarea
                            id="estimate-notes"
                            value={formData.notes}
                            onChange={(e) => updateField('notes', e.target.value)}
                            rows={3}
                            className={FORM_GHOST_TEXTAREA_CLASS}
                          />
                        </div>
                      </div>
                    </Card>

                    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                      <DetailSection
                        title={t('estimates.estimateProperties')}
                        icon={SlidersHorizontal}
                        iconPlugin="estimates"
                        subtleTitle
                        className="p-6"
                      >
                        <div>
                          <div className={DETAIL_PROP_ROW_CLASS}>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {t('estimates.fieldValidTo')}
                            </span>
                            <DatePicker
                              id="estimate-valid-to"
                              value={formData.validTo}
                              onChange={(date) => updateField('validTo', date ?? formData.validTo)}
                              placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
                              clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
                              variant="default"
                              propWidth
                            />
                          </div>
                          <div className={DETAIL_PROP_ROW_CLASS}>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {t('estimates.fieldCurrency')}
                            </span>
                            <NativeSelect
                              id="estimate-currency"
                              value={resolveInvoiceCurrency(formData.currency)}
                              onChange={(e) => updateField('currency', e.target.value)}
                              disabled={!isDraft}
                              className={propSelectClass}
                              aria-label={t('estimates.fieldCurrency')}
                            >
                              {INVOICE_CURRENCY_OPTIONS.map((code) => (
                                <option key={code} value={code}>
                                  {code}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                          <div className={DETAIL_PROP_ROW_CLASS}>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {t('invoices.vatRate', { defaultValue: 'VAT' })}
                            </span>
                            <NativeSelect
                              id="estimate-vat-rate"
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
                                    return calculateLineItem({ ...item, vatRate });
                                  }),
                                }));
                                if (validationErrors.length > 0) {
                                  clearValidationErrors();
                                }
                                markDirty();
                              }}
                              disabled={!isDraft}
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
                              {t('estimates.fieldStatus')}
                            </span>
                            <EstimateStatusSelect
                              estimate={
                                {
                                  id: currentEstimate?.id || 'draft',
                                  estimateNumber: currentEstimate?.estimateNumber || '',
                                  contactId: formData.contactId || null,
                                  contactName: formData.contactName,
                                  organizationNumber: formData.organizationNumber,
                                  currency: formData.currency,
                                  lineItems: formData.lineItems,
                                  estimateDiscount: formData.estimateDiscount,
                                  notes: formData.notes,
                                  validTo: formData.validTo,
                                  status: formData.status,
                                  subtotal: 0,
                                  totalDiscount: 0,
                                  subtotalAfterDiscount: 0,
                                  estimateDiscountAmount: 0,
                                  subtotalAfterEstimateDiscount: 0,
                                  totalVat: 0,
                                  total: 0,
                                  createdAt: new Date(),
                                  updatedAt: new Date(),
                                } as Estimate
                              }
                              onStatusChange={requestStatusChange}
                              hideInlineLabel
                              disabled={formData.status === 'invoiced'}
                            />
                          </div>
                        </div>
                      </DetailSection>
                    </Card>

                    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                      <DetailSection
                        title={t('estimates.previewTitle', { defaultValue: 'Estimate preview' })}
                        icon={Eye}
                        iconPlugin="estimates"
                        subtleTitle
                        className="p-6"
                      >
                        <p className="mb-3 text-xs text-muted-foreground">
                          {t('estimates.previewHelp', {
                            defaultValue:
                              'This is how the estimate will look when shared or exported as PDF.',
                          })}
                        </p>
                        <div className="mx-auto w-full min-w-0 max-w-[794px]">
                          <EstimateDocumentPreview
                            formData={{
                              contactId: formData.contactId,
                              contactName: formData.contactName,
                              organizationNumber: formData.organizationNumber,
                              currency: formData.currency,
                              lineItems: formData.lineItems,
                              estimateDiscount: formData.estimateDiscount,
                              notes: formData.notes,
                              orderNumber: formData.orderNumber,
                              deliveryMethod: formData.deliveryMethod,
                              validTo: formData.validTo,
                              status: formData.status,
                            }}
                            estimateId={currentEstimate?.id}
                            estimateNumber={currentEstimate?.estimateNumber}
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
                  </div>
                </>
              ) : null}

              {activeTab === 'lines' ? (
                <>
                  <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                    <DetailSection
                      title={t('estimates.lineItems')}
                      icon={ListOrdered}
                      iconPlugin="estimates"
                      subtleTitle
                      className="px-3 py-6"
                    >
                      <EstimateLineItemsEditor
                        items={formData.lineItems}
                        duplicatedItemIds={duplicatedItemIds}
                        onAdd={addLineItem}
                        onAddTextField={addTextFieldLineItem}
                        onUpdate={updateLineItem}
                        onDuplicate={duplicateLineItem}
                        onRemove={removeLineItem}
                        onMoveUp={(index) => moveLineItem(index, 'up')}
                        onMoveDown={(index) => moveLineItem(index, 'down')}
                      />
                    </DetailSection>
                  </Card>

                  <div className="space-y-4">
                    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                      <DetailSection
                        title={t('estimates.discount')}
                        icon={Percent}
                        iconPlugin="estimates"
                        subtleTitle
                        className="p-6"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <Label htmlFor="estimate-discount" className="sr-only">
                            {t('invoices.discountPercent', { defaultValue: 'Discount %' })}
                          </Label>
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
                            className={cn(INVOICE_FORM_INPUT_CLASS, 'max-w-[8rem]')}
                            aria-label={t('invoices.discountPercent', {
                              defaultValue: 'Discount %',
                            })}
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
                        title={t('estimates.pricingSummary')}
                        icon={Calculator}
                        iconPlugin="estimates"
                        subtleTitle
                        className="p-6"
                      >
                        <EstimatePricingSummary
                          totals={totals}
                          currency={formData.currency}
                          estimateDiscount={formData.estimateDiscount}
                        />
                      </DetailSection>
                    </Card>
                  </div>
                </>
              ) : null}
            </form>
          </DetailLayout>
        </div>

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

        <ConfirmDialog
          isOpen={showSentConfirm}
          title={t('estimates.markAsSentTitle')}
          message={t('estimates.markAsSentMessage', {
            number: currentEstimate?.estimateNumber
              ? formatDisplayNumber('estimates', String(currentEstimate.estimateNumber))
              : t('estimates.previewDraftNumber', { defaultValue: 'DRAFT' }),
          })}
          confirmText={t('estimates.markAsSent')}
          cancelText={t('common.cancel')}
          onConfirm={confirmMarkAsSent}
          onCancel={() => setShowSentConfirm(false)}
          variant="warning"
        />
      </>
    );
  },
);
