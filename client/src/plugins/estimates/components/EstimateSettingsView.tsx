import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

import { ESTIMATES_SETTINGS_KEY } from '../utils/estimateColumnCount';
import {
  DEFAULT_ESTIMATE_NUMBER_START,
  estimateNumberingEqual,
  formatEstimateNumberExample,
  normalizeEstimateNumbering,
  sanitizeEstimateNumberStart,
} from '../utils/estimateNumbering';

export type EstimateSettingsCategory = 'numbering';

interface EstimateSettingsViewProps {
  selectedCategory?: EstimateSettingsCategory;
  onSelectedCategoryChange?: (category: EstimateSettingsCategory) => void;
  onClose?: () => void;
}

export function EstimateSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: EstimateSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();

  const [internalCategory, setInternalCategory] = useState<EstimateSettingsCategory>('numbering');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [numbering, setNumbering] = useState(() => normalizeEstimateNumbering(null));
  const [initialNumbering, setInitialNumbering] = useState(() => normalizeEstimateNumbering(null));
  const [numberStartDraft, setNumberStartDraft] = useState(String(DEFAULT_ESTIMATE_NUMBER_START));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'numbering',
        label: t('estimates.settingsCategories.numbering', { defaultValue: 'Numbering' }),
        description: t('estimates.settingsCategories.numberingDescription', {
          defaultValue: 'Configure how estimate numbers are generated.',
        }),
        icon: SETTINGS_CATEGORY_ICONS.numbering,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeEstimateNumbering(settings);
        setNumbering(loaded);
        setInitialNumbering(loaded);
        setNumberStartDraft(String(loaded.numberStart));
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

  const numberingForSave = useMemo(
    () =>
      normalizeEstimateNumbering({
        numberPrefix: numbering.numberPrefix,
        numberStart: numberStartDraft,
        includeYear: numbering.includeYear,
      }),
    [numberStartDraft, numbering.includeYear, numbering.numberPrefix],
  );

  const isDirty =
    activeCategory === 'numbering' && !estimateNumberingEqual(numberingForSave, initialNumbering);

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'numbering') {
      return;
    }
    setIsSaving(true);
    try {
      await updateSettings(ESTIMATES_SETTINGS_KEY, {
        numberPrefix: numberingForSave.numberPrefix,
        numberStart: numberingForSave.numberStart,
        includeYear: numberingForSave.includeYear,
      });
      setNumbering(numberingForSave);
      setInitialNumbering(numberingForSave);
      setNumberStartDraft(String(numberingForSave.numberStart));
    } catch (error) {
      console.error('Failed to save estimate numbering settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, numberingForSave, updateSettings]);

  const currentYear = new Date().getFullYear();
  const numberExample = formatEstimateNumberExample(numberingForSave, currentYear);
  const displayExample = numberingForSave.numberPrefix ? numberExample : `EST-${numberExample}`;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('estimates.settingsTitle')}
      subtitle={t('estimates.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as EstimateSettingsCategory)}
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
      {activeCategory === 'numbering' ? (
        <DetailSection
          title={t('estimates.settingsCategories.numbering')}
          icon={SETTINGS_CATEGORY_ICONS.numbering}
          subtleTitle
          className="pt-0"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('estimates.settingsCategories.numberingHint', {
                defaultValue: 'Prefix, year, and start number for new estimates.',
              })}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="estimate-number-prefix">
                  {t('invoices.settingsCategories.numberPrefix', { defaultValue: 'Prefix' })}
                </Label>
                <Input
                  id="estimate-number-prefix"
                  value={numbering.numberPrefix}
                  onChange={(e) =>
                    setNumbering((prev) =>
                      normalizeEstimateNumbering({
                        ...prev,
                        numberPrefix: e.target.value,
                      }),
                    )
                  }
                  maxLength={12}
                  className={FORM_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate-number-start">
                  {t('invoices.settingsCategories.numberStart', { defaultValue: 'Start number' })}
                </Label>
                <Input
                  id="estimate-number-start"
                  type="number"
                  min={1}
                  value={numberStartDraft}
                  onChange={(e) => setNumberStartDraft(e.target.value)}
                  onBlur={() => {
                    const sanitized = sanitizeEstimateNumberStart(numberStartDraft);
                    setNumberStartDraft(String(sanitized));
                  }}
                  className={FORM_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t('invoices.settingsCategories.example', { defaultValue: 'Example' })}
                </Label>
                <Input value={displayExample} readOnly className={FORM_INPUT_READONLY_CLASS} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm">
              <Checkbox
                checked={numbering.includeYear}
                onChange={(e) =>
                  setNumbering((prev) =>
                    normalizeEstimateNumbering({
                      ...prev,
                      includeYear: e.target.checked,
                    }),
                  )
                }
                className={CHECKBOX_SM_CLASS}
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
        </DetailSection>
      ) : null}
    </PluginSettingsPageShell>
  );
}
