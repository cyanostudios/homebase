// Invoices settings as full-page content matching Core Settings layout.

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

import { INVOICES_SETTINGS_KEY } from '../utils/invoiceColumnCount';
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

export type InvoiceSettingsCategory = 'columns';

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
        const loaded = normalizeInvoiceTableColumns(settings?.tableColumns);
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
    activeCategory === 'columns' && !invoiceTableColumnsEqual(tableColumns, initialTableColumns);

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'columns') {
      return;
    }
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
  }, [activeCategory, tableColumns, updateSettings]);

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
    </PluginSettingsPageShell>
  );
}
