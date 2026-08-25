// Guides settings as full-page content matching Core Settings layout.

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PluginSettingsPageShell,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';

import { ContentSourcesSettings } from './ContentSourcesSettings';
import { ProductionWorkerSettingsPanel } from './ProductionWorkerSettingsPanel';

export type GuideSettingsCategory = 'production' | 'sources';

interface GuideSettingsViewProps {
  selectedCategory?: GuideSettingsCategory;
  onSelectedCategoryChange?: (category: GuideSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function GuideSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: GuideSettingsViewProps = {}) {
  const { t } = useTranslation();

  const [internalCategory, setInternalCategory] = useState<GuideSettingsCategory>('production');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'production',
        label: t('guides.settings.categories.production'),
        description: t('guides.settings.categories.productionDescription'),
        icon: SETTINGS_CATEGORY_ICONS.production,
      },
      {
        id: 'sources',
        label: t('guides.settings.categories.sources'),
        description: t('guides.settings.categories.sourcesDescription'),
        icon: SETTINGS_CATEGORY_ICONS.sources,
      },
    ],
    [t],
  );

  return (
    <PluginSettingsPageShell
      title={t('guides.settingsTitle')}
      subtitle={t('guides.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as GuideSettingsCategory)}
      onClose={onClose}
    >
      {activeCategory === 'production' && <ProductionWorkerSettingsPanel />}
      {activeCategory === 'sources' && <ContentSourcesSettings />}
    </PluginSettingsPageShell>
  );
}
