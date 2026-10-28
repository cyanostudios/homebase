import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PluginSettingsPageShell,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { SettingsTagsSection } from '@/core/ui/SettingsTagsSection';

import type { InstructionSettingsTab } from '../context/InstructionContext';

const INSTRUCTIONS_SETTINGS_KEY = 'instructions';

export type InstructionSettingsCategory = 'tags';

interface InstructionSettingsViewProps {
  selectedTab?: InstructionSettingsTab;
  onSelectedTabChange?: (tab: InstructionSettingsTab) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderTabButtonsInline?: boolean;
  onClose?: () => void;
}

/** Settings shell; tag catalog and list view prefs. */
export function InstructionSettingsView({
  selectedTab,
  onSelectedTabChange,
  onClose,
}: InstructionSettingsViewProps = {}) {
  const { t } = useTranslation();

  const [internalCategory, setInternalCategory] = useState<InstructionSettingsCategory>('tags');
  const activeCategory = (selectedTab ?? internalCategory) as InstructionSettingsCategory;
  const setActiveCategory = (onSelectedTabChange ?? setInternalCategory) as (
    category: InstructionSettingsCategory,
  ) => void;

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'tags',
        label: t('common.tags'),
        description: t('common.tagsSettingsHint'),
        icon: SETTINGS_CATEGORY_ICONS.tags,
      },
    ],
    [t],
  );

  return (
    <PluginSettingsPageShell
      title={t('instructions.settings.title')}
      subtitle={t('instructions.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as InstructionSettingsCategory)}
      onClose={onClose}
    >
      {activeCategory === 'tags' && <SettingsTagsSection settingsKey={INSTRUCTIONS_SETTINGS_KEY} />}
    </PluginSettingsPageShell>
  );
}
