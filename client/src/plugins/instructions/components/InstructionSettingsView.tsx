import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

import type { InstructionSettingsTab } from '../context/InstructionContext';
import { useInstructions } from '../hooks/useInstructions';

interface InstructionSettingsViewProps {
  selectedTab?: InstructionSettingsTab;
  onSelectedTabChange?: (tab: InstructionSettingsTab) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderTabButtonsInline?: boolean;
  onClose?: () => void;
}

/** Settings shell kept for navigation; list view prefs live on the list header. */
export function InstructionSettingsView({
  selectedTab,
  onSelectedTabChange,
  onClose,
}: InstructionSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { instructionsSettingsTab } = useInstructions();

  const [internalTab, setInternalTab] = useState<InstructionSettingsTab | undefined>(undefined);
  const activeTab = selectedTab ?? internalTab;
  const setActiveTab = onSelectedTabChange ?? setInternalTab;

  useEffect(() => {
    setActiveTab(instructionsSettingsTab);
  }, [instructionsSettingsTab, setActiveTab]);

  return (
    <PluginSettingsPageShell
      title={t('instructions.settings.title')}
      subtitle={t('instructions.settingsSubtitle')}
      categories={[]}
      activeCategory={activeTab ?? ''}
      onCategoryChange={() => {}}
      onClose={onClose}
    >
      {null}
    </PluginSettingsPageShell>
  );
}
