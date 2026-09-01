import { Download, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import {
  PluginSettingsPageShell,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';

import { useGarments } from '../hooks/useGarments';
import {
  GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS,
  getGarmentInventoryImportSchema,
} from '../utils/inventoryImportSchema';

export type GarmentsInventorySettingsCategory = 'import';

interface GarmentsInventorySettingsViewProps {
  selectedCategory?: GarmentsInventorySettingsCategory;
  onSelectedCategoryChange?: (category: GarmentsInventorySettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function GarmentsInventorySettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: GarmentsInventorySettingsViewProps = {}) {
  const { t } = useTranslation();
  const { importInventoryItems } = useGarments();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] =
    useState<GarmentsInventorySettingsCategory>('import');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const importSchema = useMemo(() => getGarmentInventoryImportSchema(), []);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'import',
        label: t('common.import'),
        description: t('garments.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
      },
    ],
    [t],
  );

  return (
    <>
      <PluginSettingsPageShell
        title={t('garments.settingsInventory')}
        subtitle={t('garments.settingsInventorySubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as GarmentsInventorySettingsCategory)}
        onClose={onClose}
      >
        {activeCategory === 'import' && (
          <DetailSection title={t('garments.importInventory')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">
              {t('garments.importInventoryDescription')}
            </p>
            <div className="flex flex-wrap gap-2">
              <RoundIconLabelButton
                type="button"
                icon={Download}
                label={t('importWizard.downloadTemplate')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={() =>
                  downloadImportCsvTemplate({
                    schema: importSchema,
                    filename: 'garments-inventory-import-template.csv',
                    exampleRows: GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS,
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('garments.importInventory')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={() => setIsImportWizardOpen(true)}
              />
            </div>
          </DetailSection>
        )}
      </PluginSettingsPageShell>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importInventoryItems}
        schema={importSchema}
        title={t('garments.importInventory')}
      />
    </>
  );
}
