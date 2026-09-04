// Invoices settings as full-page content matching Core Settings layout.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { TableColumnsSettingsSection } from '@/core/ui/TableColumnsSettingsSection';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

import { INVOICES_SETTINGS_KEY } from '../utils/invoiceColumnCount';
import {
  DEFAULT_INVOICE_NUMBER_START,
  formatInvoiceNumberExample,
  invoiceNumberingEqual,
  normalizeInvoiceNumbering,
  type InvoiceNumberingPref,
} from '../utils/invoiceNumbering';
import {
  invoiceTableColumnsEqual,
  isInvoiceTableColumnId,
  normalizeInvoiceTableColumns,
  reorderInvoiceTableColumns,
  setInvoiceTableColumnHidden,
  type InvoiceTableColumnId,
  type InvoiceTableColumnsPref,
} from '../utils/invoiceTableColumns';

const COLUMN_LABEL_KEYS: Record<InvoiceTableColumnId, string> = {
  invoiceNumber: 'invoices.table.number',
  contactName: 'invoices.fieldContact',
  status: 'invoices.fieldStatus',
  total: 'invoices.table.total',
  dueDate: 'invoices.fieldDueDate',
  createdAt: 'common.created',
  updatedAt: 'common.updated',
};

export type InvoiceSettingsCategory = 'columns' | 'numbering';

interface InvoiceSettingsViewProps {
  selectedCategory?: InvoiceSettingsCategory;
  onSelectedCategoryChange?: (category: InvoiceSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function InvoiceSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: InvoiceSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();

  const [internalCategory, setInternalCategory] = useState<InvoiceSettingsCategory>('columns');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tableColumns, setTableColumns] = useState<InvoiceTableColumnsPref>(() =>
    normalizeInvoiceTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<InvoiceTableColumnsPref>(() =>
    normalizeInvoiceTableColumns(null),
  );
  const [numbering, setNumbering] = useState<InvoiceNumberingPref>(() =>
    normalizeInvoiceNumbering(null),
  );
  const [initialNumbering, setInitialNumbering] = useState<InvoiceNumberingPref>(() =>
    normalizeInvoiceNumbering(null),
  );
  const [numberStartDraft, setNumberStartDraft] = useState(String(DEFAULT_INVOICE_NUMBER_START));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'columns',
        label: t('invoices.settingsCategories.columns'),
        description: t('invoices.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
      {
        id: 'numbering',
        label: t('invoices.settingsCategories.numbering'),
        description: t('invoices.settingsCategories.numberingDescription'),
        icon: SETTINGS_CATEGORY_ICONS.numbering,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(INVOICES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedColumns = normalizeInvoiceTableColumns(settings?.tableColumns);
        const loadedNumbering = normalizeInvoiceNumbering(settings);
        setTableColumns(loadedColumns);
        setInitialTableColumns(loadedColumns);
        setNumbering(loadedNumbering);
        setInitialNumbering(loadedNumbering);
        setNumberStartDraft(String(loadedNumbering.numberStart));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const numberingForCompare = useMemo(
    () =>
      normalizeInvoiceNumbering({
        numberPrefix: numbering.numberPrefix,
        numberStart: numberStartDraft,
        includeYear: numbering.includeYear,
      }),
    [numberStartDraft, numbering.includeYear, numbering.numberPrefix],
  );

  const isDirty =
    (activeCategory === 'columns' &&
      !invoiceTableColumnsEqual(tableColumns, initialTableColumns)) ||
    (activeCategory === 'numbering' &&
      !invoiceNumberingEqual(numberingForCompare, initialNumbering));

  const handleSave = useCallback(async () => {
    if (activeCategory === 'columns') {
      setIsSaving(true);
      try {
        const next = normalizeInvoiceTableColumns(tableColumns);
        await updateSettings(INVOICES_SETTINGS_KEY, { tableColumns: next });
        setTableColumns(next);
        setInitialTableColumns(next);
      } catch (error) {
        console.error('Failed to save invoices table columns:', error);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (activeCategory !== 'numbering') {
      return;
    }

    setIsSaving(true);
    try {
      const next = normalizeInvoiceNumbering({
        numberPrefix: numbering.numberPrefix,
        numberStart: numberStartDraft,
        includeYear: numbering.includeYear,
      });
      await updateSettings(INVOICES_SETTINGS_KEY, {
        numberPrefix: next.numberPrefix,
        numberStart: next.numberStart,
        includeYear: next.includeYear,
      });
      setNumbering(next);
      setInitialNumbering(next);
      setNumberStartDraft(String(next.numberStart));
    } catch (error) {
      console.error('Failed to save invoices numbering settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    activeCategory,
    numberStartDraft,
    numbering.includeYear,
    numbering.numberPrefix,
    tableColumns,
    updateSettings,
  ]);

  const currentYear = new Date().getFullYear();
  const numberExample = formatInvoiceNumberExample(numberingForCompare, currentYear);
  const displayExample = numberingForCompare.numberPrefix ? numberExample : `INV-${numberExample}`;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('invoices.settingsTitle')}
      subtitle={t('invoices.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as InvoiceSettingsCategory)}
      onClose={onClose}
      onSave={isDirty ? () => void handleSave() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton
            onClick={() => void handleSave()}
            isSaving={isSaving}
            label={t('common.save')}
            savingLabel={t('common.saving')}
          />
        ) : null
      }
    >
      {activeCategory === 'columns' && (
        <TableColumnsSettingsSection
          title={t('invoices.settingsCategories.columns')}
          hint={t('invoices.settingsCategories.columnsHint')}
          pref={tableColumns}
          requiredColumnId="invoiceNumber"
          labelFor={(id) => t(COLUMN_LABEL_KEYS[id])}
          isColumnId={isInvoiceTableColumnId}
          reorder={reorderInvoiceTableColumns}
          setHidden={setInvoiceTableColumnHidden}
          onChange={setTableColumns}
        />
      )}

      {activeCategory === 'numbering' && (
        <DetailSection title={t('invoices.settingsCategories.numbering')} className="pt-0">
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">
              {t('invoices.settingsCategories.numberingHint')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="invoice-number-prefix">
                {t('invoices.settingsCategories.numberPrefix')}
              </Label>
              <Input
                id="invoice-number-prefix"
                value={numbering.numberPrefix}
                onChange={(e) =>
                  setNumbering((prev) =>
                    normalizeInvoiceNumbering({
                      ...prev,
                      numberPrefix: e.target.value,
                    }),
                  )
                }
                placeholder={t('invoices.settingsCategories.numberPrefixPlaceholder')}
                maxLength={12}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-number-year">
                {t('invoices.settingsCategories.numberYear')}
              </Label>
              <Input
                id="invoice-number-year"
                type="text"
                value={String(currentYear)}
                readOnly
                disabled={!numbering.includeYear}
                className="cursor-default"
              />
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm">
                <Checkbox
                  checked={numbering.includeYear}
                  onChange={(e) =>
                    setNumbering((prev) =>
                      normalizeInvoiceNumbering({
                        ...prev,
                        includeYear: e.target.checked,
                      }),
                    )
                  }
                  className={cn(CHECKBOX_SM_CLASS, 'cursor-pointer')}
                  aria-label={t('invoices.settingsCategories.includeYear', {
                    defaultValue: 'Show year in invoice number',
                  })}
                />
                <span className="truncate">
                  {t('invoices.settingsCategories.includeYear', {
                    defaultValue: 'Show year in invoice number',
                  })}
                </span>
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-number-start">
                {t('invoices.settingsCategories.numberStart')}
              </Label>
              <Input
                id="invoice-number-start"
                type="number"
                min={1}
                max={999999}
                value={numberStartDraft}
                onChange={(e) => setNumberStartDraft(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('invoices.settingsCategories.numberExample', { example: displayExample })}
            </p>
          </div>
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
