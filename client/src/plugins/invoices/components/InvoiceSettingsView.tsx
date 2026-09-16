// Invoices settings as full-page content matching Core Settings layout.

import { Banknote, FileMinus, FileText, Receipt } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';
import { FORM_INPUT_CLASS, FORM_INPUT_READONLY_CLASS } from '@/core/ui/formFieldStyles';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

import { INVOICES_SETTINGS_KEY } from '../utils/invoiceColumnCount';
import {
  DEFAULT_INVOICE_NUMBER_START,
  INVOICE_NUMBERING_TYPES,
  buildInvoiceNumberingSettingsPayload,
  findInvoiceNumberingSeriesCollisions,
  formatInvoiceNumberExample,
  invoiceNumberingByTypeEqual,
  normalizeInvoiceNumbering,
  normalizeInvoiceNumberingByType,
  type InvoiceNumberingByType,
  type InvoiceNumberingType,
} from '../utils/invoiceNumbering';

const NUMBERING_TYPE_ICONS = {
  invoice: FileText,
  credit_note: FileMinus,
  cash_invoice: Banknote,
  receipt: Receipt,
} as const;

export type InvoiceSettingsCategory = 'numbering';

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

  const [internalCategory, setInternalCategory] = useState<InvoiceSettingsCategory>('numbering');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [numberingByType, setNumberingByType] = useState<InvoiceNumberingByType>(() =>
    normalizeInvoiceNumberingByType(null),
  );
  const [initialNumberingByType, setInitialNumberingByType] = useState<InvoiceNumberingByType>(() =>
    normalizeInvoiceNumberingByType(null),
  );
  const [activeNumberingType, setActiveNumberingType] = useState<InvoiceNumberingType>('invoice');
  const [numberStartDraftByType, setNumberStartDraftByType] = useState<
    Record<InvoiceNumberingType, string>
  >(
    () =>
      Object.fromEntries(
        INVOICE_NUMBERING_TYPES.map((type) => [type, String(DEFAULT_INVOICE_NUMBER_START)]),
      ) as Record<InvoiceNumberingType, string>,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
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
        const loadedNumbering = normalizeInvoiceNumberingByType(settings);
        setNumberingByType(loadedNumbering);
        setInitialNumberingByType(loadedNumbering);
        setNumberStartDraftByType(
          Object.fromEntries(
            INVOICE_NUMBERING_TYPES.map((type) => [
              type,
              String(loadedNumbering[type].numberStart),
            ]),
          ) as Record<InvoiceNumberingType, string>,
        );
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

  const numberingForCompare = useMemo(() => {
    const next = { ...numberingByType };
    for (const type of INVOICE_NUMBERING_TYPES) {
      next[type] = normalizeInvoiceNumbering({
        numberPrefix: numberingByType[type].numberPrefix,
        numberStart: numberStartDraftByType[type],
        includeYear: numberingByType[type].includeYear,
      });
    }
    return next;
  }, [numberStartDraftByType, numberingByType]);

  const isDirty =
    activeCategory === 'numbering' &&
    !invoiceNumberingByTypeEqual(numberingForCompare, initialNumberingByType);

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'numbering') {
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildInvoiceNumberingSettingsPayload(numberingForCompare);
      await updateSettings(INVOICES_SETTINGS_KEY, payload);
      setNumberingByType(payload.numberingByType);
      setInitialNumberingByType(payload.numberingByType);
      setNumberStartDraftByType(
        Object.fromEntries(
          INVOICE_NUMBERING_TYPES.map((type) => [
            type,
            String(payload.numberingByType[type].numberStart),
          ]),
        ) as Record<InvoiceNumberingType, string>,
      );
    } catch (error) {
      console.error('Failed to save invoices numbering settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, numberingForCompare, updateSettings]);

  const currentYear = new Date().getFullYear();
  const activeSeries = numberingForCompare[activeNumberingType];
  const numberExample = formatInvoiceNumberExample(activeSeries, currentYear);
  const displayExample = activeSeries.numberPrefix ? numberExample : `INV-${numberExample}`;
  const collisions = findInvoiceNumberingSeriesCollisions(numberingForCompare, activeNumberingType);

  const updateActiveSeries = (patch: Partial<{ numberPrefix: string; includeYear: boolean }>) => {
    setNumberingByType((prev) => ({
      ...prev,
      [activeNumberingType]: normalizeInvoiceNumbering({
        ...prev[activeNumberingType],
        ...patch,
      }),
    }));
  };

  const numberingTypeSubmenu =
    activeCategory === 'numbering' ? (
      <>
        {INVOICE_NUMBERING_TYPES.map((type) => {
          const isActive = activeNumberingType === type;
          return (
            <RoundIconLabelButton
              key={type}
              type="button"
              icon={NUMBERING_TYPE_ICONS[type]}
              label={t(`invoices.type.${type}`)}
              alwaysExpanded
              className="shrink-0"
              variant={isActive ? 'primary' : 'secondary'}
              onClick={() => setActiveNumberingType(type)}
              aria-pressed={isActive}
            />
          );
        })}
      </>
    ) : null;

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
      headerSubmenu={numberingTypeSubmenu}
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
      {activeCategory === 'numbering' && (
        <DetailSection title={t('invoices.settingsCategories.numbering')} className="pt-0">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('invoices.settingsCategories.numberingHint')}
            </p>

            {/* Phone: header is hidden; keep type switcher in the body. Desktop uses headerSubmenu. */}
            <div className="flex flex-wrap items-center gap-1 md:hidden">
              {INVOICE_NUMBERING_TYPES.map((type) => {
                const isActive = activeNumberingType === type;
                return (
                  <RoundIconLabelButton
                    key={type}
                    type="button"
                    icon={NUMBERING_TYPE_ICONS[type]}
                    label={t(`invoices.type.${type}`)}
                    alwaysExpanded
                    className="shrink-0"
                    variant={isActive ? 'primary' : 'secondary'}
                    onClick={() => setActiveNumberingType(type)}
                    aria-pressed={isActive}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invoice-number-prefix">
                  {t('invoices.settingsCategories.numberPrefix')}
                </Label>
                <Input
                  id="invoice-number-prefix"
                  value={numberingByType[activeNumberingType].numberPrefix}
                  onChange={(e) => updateActiveSeries({ numberPrefix: e.target.value })}
                  placeholder={t('invoices.settingsCategories.numberPrefixPlaceholder')}
                  maxLength={12}
                  autoComplete="off"
                  className={FORM_INPUT_CLASS}
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
                  disabled={!numberingByType[activeNumberingType].includeYear}
                  className={cn(FORM_INPUT_CLASS, FORM_INPUT_READONLY_CLASS, 'cursor-default')}
                />
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm">
                  <Checkbox
                    checked={numberingByType[activeNumberingType].includeYear}
                    onChange={(e) => updateActiveSeries({ includeYear: e.target.checked })}
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
                  value={numberStartDraftByType[activeNumberingType]}
                  onChange={(e) =>
                    setNumberStartDraftByType((prev) => ({
                      ...prev,
                      [activeNumberingType]: e.target.value,
                    }))
                  }
                  className={FORM_INPUT_CLASS}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('invoices.settingsCategories.numberExample', { example: displayExample })}
            </p>
            {collisions.length > 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('invoices.settingsCategories.numberingCollision', {
                  types: collisions.map((type) => t(`invoices.type.${type}`)).join(', '),
                  defaultValue:
                    'Same series as: {{types}}. Use different prefixes to keep sequences separate.',
                })}
              </p>
            ) : null}
          </div>
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
