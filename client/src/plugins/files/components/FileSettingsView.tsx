// Files settings as full-page content matching Core Settings layout.

import { Cloud } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PluginSettingsPageShell,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { SettingsTagsSection } from '@/core/ui/SettingsTagsSection';

import { FileSettingsForm } from './FileSettingsForm';

const FILES_SETTINGS_KEY = 'files';

export type FileSettingsCategory = 'tags' | 'cloud';

interface FileSettingsViewProps {
  selectedCategory?: FileSettingsCategory;
  onSelectedCategoryChange?: (category: FileSettingsCategory) => void;
  onClose?: () => void;
}

export function FileSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: FileSettingsViewProps = {}) {
  const { t } = useTranslation();

  const [internalCategory, setInternalCategory] = useState<FileSettingsCategory>('cloud');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'tags',
        label: t('common.tags'),
        description: t('common.tagsSettingsHint'),
        icon: SETTINGS_CATEGORY_ICONS.tags,
      },
      {
        id: 'cloud',
        label: t('files.cloudStorageTitle'),
        description: t('files.settingsSubtitle'),
        icon: Cloud,
      },
    ],
    [t],
  );

  return (
    <PluginSettingsPageShell
      title={t('files.settingsTitle')}
      subtitle={t('files.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as FileSettingsCategory)}
      onClose={onClose}
    >
      {activeCategory === 'tags' && <SettingsTagsSection settingsKey={FILES_SETTINGS_KEY} />}
      {activeCategory === 'cloud' && <FileSettingsForm />}
    </PluginSettingsPageShell>
  );
}
