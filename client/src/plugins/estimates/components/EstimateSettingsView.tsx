// Estimates settings as full-page content matching Core Settings layout.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { TableColumnsSettingsSection } from '@/core/ui/TableColumnsSettingsSection';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';

import { ESTIMATES_SETTINGS_KEY } from '../utils/estimateColumnCount';
import {
  estimateTableColumnsEqual,
  isEstimateTableColumnId,
  normalizeEstimateTableColumns,
  reorderEstimateTableColumns,
  setEstimateTableColumnHidden,
  type EstimateTableColumnId,
  type EstimateTableColumnsPref,
} from '../utils/estimateTableColumns';

const COLUMN_LABEL_KEYS: Record<EstimateTableColumnId, string> = {
  estimateNumber: 'estimates.table.number',
  contactName: 'estimates.fieldContact',
  status: 'estimates.fieldStatus',
  total: 'estimates.table.total',
  validTo: 'estimates.fieldValidTo',
  createdAt: 'common.created',
  updatedAt: 'common.updated',
};

export type EstimateSettingsCategory = 'columns';

interface EstimateSettingsViewProps {
  selectedCategory?: EstimateSettingsCategory;
  onSelectedCategoryChange?: (category: EstimateSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function EstimateSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: EstimateSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();

  const [internalCategory, setInternalCategory] = useState<EstimateSettingsCategory>('columns');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tableColumns, setTableColumns] = useState<EstimateTableColumnsPref>(() =>
    normalizeEstimateTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<EstimateTableColumnsPref>(() =>
    normalizeEstimateTableColumns(null),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'columns',
        label: t('estimates.settingsCategories.columns'),
        description: t('estimates.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
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
        const loaded = normalizeEstimateTableColumns(settings?.tableColumns);
        setTableColumns(loaded);
        setInitialTableColumns(loaded);
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

  const isDirty =
    activeCategory === 'columns' && !estimateTableColumnsEqual(tableColumns, initialTableColumns);

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'columns') {
      return;
    }
    setIsSaving(true);
    try {
      const next = normalizeEstimateTableColumns(tableColumns);
      await updateSettings(ESTIMATES_SETTINGS_KEY, { tableColumns: next });
      setTableColumns(next);
      setInitialTableColumns(next);
    } catch (error) {
      console.error('Failed to save estimates table columns:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, tableColumns, updateSettings]);

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
      {activeCategory === 'columns' && (
        <TableColumnsSettingsSection
          title={t('estimates.settingsCategories.columns')}
          hint={t('estimates.settingsCategories.columnsHint')}
          pref={tableColumns}
          requiredColumnId="estimateNumber"
          labelFor={(id) => t(COLUMN_LABEL_KEYS[id])}
          isColumnId={isEstimateTableColumnId}
          reorder={reorderEstimateTableColumns}
          setHidden={setEstimateTableColumnHidden}
          onChange={setTableColumns}
        />
      )}
    </PluginSettingsPageShell>
  );
}
