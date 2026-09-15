// Estimates settings as full-page content matching Core Settings layout.

import React from 'react';
import { useTranslation } from 'react-i18next';

import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

/** @deprecated No settings categories remain; kept for call-site compatibility. */
export type EstimateSettingsCategory = never;

interface EstimateSettingsViewProps {
  selectedCategory?: EstimateSettingsCategory;
  onSelectedCategoryChange?: (category: EstimateSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function EstimateSettingsView({ onClose }: EstimateSettingsViewProps = {}) {
  const { t } = useTranslation();

  return (
    <PluginSettingsPageShell
      title={t('estimates.settingsTitle')}
      subtitle={t('estimates.settingsSubtitle')}
      categories={[]}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">{t('estimates.settingsEmpty')}</p>
    </PluginSettingsPageShell>
  );
}
