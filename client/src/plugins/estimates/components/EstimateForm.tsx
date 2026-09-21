import {
  Plus,
  Trash2,
  Copy,
  FileSpreadsheet,
  History,
  List,
  ListOrdered,
  Percent,
  Calculator,
  StickyNote,
  SlidersHorizontal,
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
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DatePicker } from '@/core/ui/DatePicker';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_COMPACT_INPUT_CLASS,
  FORM_COMPACT_SELECT_CLASS,
  FORM_GHOST_SELECT_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
  FORM_INPUT_ERROR_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import { Estimate, LineItem, calculateLineItem, calculateEstimateTotals } from '../types/estimate';

type EstimateFormTab = 'properties' | 'lines' | 'notes' | 'activity';

const ESTIMATE_FORM_TABS: EstimateFormTab[] = ['properties', 'lines', 'notes', 'activity'];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const ESTIMATE_FORM_EDIT_DISABLED_TABS: ReadonlySet<EstimateFormTab> = new Set(['activity']);

const TAB_ERROR_FIELDS: Record<EstimateFormTab, string[]> = {
  properties: ['contactId', 'currency', 'validTo', 'status'],
  lines: ['lineItems'],
  notes: ['notes'],
  activity: [],
};

function parseEstimateFormTab(value: string | null): EstimateFormTab {
  if (value && ESTIMATE_FORM_TABS.includes(value as EstimateFormTab)) {
    return value as EstimateFormTab;
  }
  return 'properties';
}

interface EstimateFormProps {
  currentEstimate?: Estimate;
  onSave: (data: any) => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
  /** Single-column layout for mail detail column. */
  stacked?: boolean;
}

export const EstimateForm = React.forwardRef<PanelFormHandle, EstimateFormProps>(
  function EstimateForm({ currentEstimate, onSave, onCancel, stacked: _stacked = false }, ref) {
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
            if (tab === 'properties') {
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
    const { contacts } = useApp(); // Cross-plugin data access
    const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
      useGlobalNavigationGuard();

    // Safety check for contacts
    const safeContacts = contacts || [];
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
      attemptAction(
        () => {
          setDuplicatedItemIds(new Set());
          onCancel();
        },
        { force: true },
      );
    }, [attemptAction, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
      }),
      [handleSubmit, handleCancel],
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
          id: 'properties' as const,
          label: t('estimates.tabs.properties'),
          icon: SlidersHorizontal,
          count: null as number | null,
        },
        {
          id: 'lines' as const,
          label: t('estimates.tabs.lines'),
          icon: List,
          count: lineItemCount > 0 ? lineItemCount : null,
        },
        {
          id: 'notes' as const,
          label: t('estimates.tabs.notes'),
          icon: StickyNote,
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
            <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
              {estimateTitle}
            </h3>
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
              className="space-y-6"
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

              {activeTab === 'properties' ? (
                <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                  <DetailSection
                    title={t('estimates.estimateProperties')}
                    icon={SlidersHorizontal}
                    subtleTitle
                    className="p-6"
                  >
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="estimate-contact" className={DETAIL_FIELD_LABEL_CLASS}>
                          {t('estimates.fieldContact')}
                        </Label>
                        <NativeSelect
                          id="estimate-contact"
                          value={formData.contactId}
                          onChange={(e) => handleContactChange(e.target.value)}
                          className={cn(
                            FORM_GHOST_SELECT_CLASS,
                            getFieldError('contactId') && FORM_INPUT_ERROR_CLASS,
                          )}
                          required
                        >
                          <option value="">{t('estimates.selectContact')}</option>
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
                        <Label htmlFor="estimate-currency" className={DETAIL_FIELD_LABEL_CLASS}>
                          {t('estimates.fieldCurrency')}
                        </Label>
                        <NativeSelect
                          id="estimate-currency"
                          value={formData.currency}
                          onChange={(e) => updateField('currency', e.target.value)}
                          className={FORM_GHOST_SELECT_CLASS}
                        >
                          <option value="SEK">SEK (Swedish Krona)</option>
                          <option value="EUR">EUR (Euro)</option>
                          <option value="USD">USD (US Dollar)</option>
                          <option value="NOK">NOK (Norwegian Krone)</option>
                          <option value="DKK">DKK (Danish Krone)</option>
                        </NativeSelect>
                      </div>

                      <div>
                        <Label htmlFor="estimate-valid-to" className={DETAIL_FIELD_LABEL_CLASS}>
                          {t('estimates.fieldValidTo')}
                        </Label>
                        <DatePicker
                          id="estimate-valid-to"
                          value={formData.validTo}
                          onChange={(date) => updateField('validTo', date ?? formData.validTo)}
                          placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
                          clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
                          variant="default"
                          fullWidth
                        />
                      </div>

                      <div>
                        <Label htmlFor="estimate-status" className={DETAIL_FIELD_LABEL_CLASS}>
                          {t('estimates.fieldStatus')}
                        </Label>
                        <NativeSelect
                          id="estimate-status"
                          value={formData.status}
                          onChange={(e) => updateField('status', e.target.value)}
                          className={FORM_GHOST_SELECT_CLASS}
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
              ) : null}

              {activeTab === 'lines' ? (
                <>
                  {/* Line Items — compact chrome unchanged */}
                  <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                    <DetailSection
                      title={t('estimates.lineItems')}
                      icon={ListOrdered}
                      iconPlugin="estimates"
                      className="p-6"
                    >
                      <div className="flex items-center justify-end mb-3">
                        <RoundIconLabelButton
                          type="button"
                          icon={Plus}
                          label="Add Item"
                          variant="soft"
                          size="xs"
                          alwaysExpanded
                          onClick={addLineItem}
                        />
                      </div>

                      {formData.lineItems.length === 0 ? (
                        <p className={DETAIL_EMPTY_STATE_CLASS}>No line items added yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {formData.lineItems.map((item, index) => (
                            <div
                              key={item.id}
                              className={`rounded-lg border border-border p-3 ${
                                duplicatedItemIds.has(item.id)
                                  ? 'bg-green-50 dark:bg-green-950/30'
                                  : ''
                              }`}
                            >
                              {/* Row 1: Item number + Description + Action */}
                              <div className="flex items-center gap-3 mb-2">
                                <span className="w-12 flex-shrink-0 text-sm font-medium text-foreground">
                                  Item {index + 1}
                                </span>
                                <Textarea
                                  value={item.description}
                                  onChange={(e) =>
                                    updateLineItem(index, 'description', e.target.value)
                                  }
                                  placeholder="Service or product description"
                                  rows={1}
                                  className={cn(
                                    FORM_TEXTAREA_CLASS,
                                    'flex-1 resize-none h-auto min-h-[2.5rem]',
                                  )}
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
                                  <thead className="bg-muted/40">
                                    <tr>
                                      <th className="px-2 py-1 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Qty
                                      </th>
                                      <th className="px-2 py-1 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Unit Price
                                      </th>
                                      <th className="px-2 py-1 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Discount %
                                      </th>
                                      <th className="px-2 py-1 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        VAT %
                                      </th>
                                      <th className="px-2 py-1 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Discount
                                      </th>
                                      <th className="px-2 py-1 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        VAT
                                      </th>
                                      <th className="px-2 py-1 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                                            updateLineItem(
                                              index,
                                              'quantity',
                                              parseFloat(e.target.value) || 0,
                                            )
                                          }
                                          className={cn(FORM_COMPACT_INPUT_CLASS, 'w-16')}
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
                                          className={cn(FORM_COMPACT_INPUT_CLASS, 'w-20')}
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
                                            updateLineItem(
                                              index,
                                              'discount',
                                              parseFloat(e.target.value) || 0,
                                            )
                                          }
                                          className={cn(FORM_COMPACT_INPUT_CLASS, 'w-16')}
                                        />
                                      </td>
                                      <td className="px-2 py-1">
                                        <NativeSelect
                                          value={item.vatRate}
                                          onChange={(e) =>
                                            updateLineItem(
                                              index,
                                              'vatRate',
                                              parseFloat(e.target.value),
                                            )
                                          }
                                          className={cn(FORM_COMPACT_SELECT_CLASS, 'w-16')}
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
                    </DetailSection>
                  </Card>

                  {/* Estimate Discount - After line items, before totals */}
                  {formData.lineItems.length > 0 && (
                    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                      <DetailSection
                        title={t('estimates.discount')}
                        icon={Percent}
                        iconPlugin="estimates"
                        className="p-6"
                      >
                        <div className="flex items-center gap-4 mb-2">
                          <Label htmlFor="estimate-discount" className={DETAIL_FIELD_LABEL_CLASS}>
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
                              className={FORM_COMPACT_INPUT_CLASS}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Discount applied to subtotal after line item discounts
                        </p>
                      </DetailSection>
                    </Card>
                  )}

                  {/* Totals Summary */}
                  {formData.lineItems.length > 0 && (
                    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                      <DetailSection
                        title={t('estimates.summary')}
                        icon={Calculator}
                        iconPlugin="estimates"
                        className="p-6"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Subtotal:</span>
                            <span className="text-sm font-medium text-foreground">
                              {(totals.subtotal || 0).toFixed(2)} {formData.currency}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">
                              Total Line Item Discounts:
                            </span>
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
                          {/* NEW: Show estimate discount if applied */}
                          {formData.estimateDiscount > 0 && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">
                                  Estimate Discount ({formData.estimateDiscount}%):
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  -{(totals.estimateDiscountAmount || 0).toFixed(2)}{' '}
                                  {formData.currency}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-border pt-2">
                                <span className="text-sm text-muted-foreground">
                                  Subtotal after estimate discount:
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  {(totals.subtotalAfterEstimateDiscount || 0).toFixed(2)}{' '}
                                  {formData.currency}
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
                          <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
                            <span>Total:</span>
                            <span>
                              {(totals.total || 0).toFixed(2)} {formData.currency}
                            </span>
                          </div>
                        </div>
                      </DetailSection>
                    </Card>
                  )}
                </>
              ) : null}

              {activeTab === 'notes' ? (
                <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                  <DetailSection
                    title={t('estimates.notes')}
                    icon={StickyNote}
                    iconPlugin="estimates"
                    className="p-6"
                  >
                    <div>
                      <Label htmlFor="estimate-notes" className={DETAIL_FIELD_LABEL_CLASS}>
                        Additional Notes
                      </Label>
                      <Textarea
                        id="estimate-notes"
                        value={formData.notes}
                        onChange={(e) => updateField('notes', e.target.value)}
                        placeholder="Additional notes or terms..."
                        rows={4}
                        className={cn(FORM_GHOST_TEXTAREA_CLASS)}
                      />
                    </div>
                  </DetailSection>
                </Card>
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
      </>
    );
  },
);
