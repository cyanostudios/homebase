// Files settings as full-page content matching Core Settings layout.

import React from 'react';
import { useTranslation } from 'react-i18next';

import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

import { FileSettingsForm } from './FileSettingsForm';

interface FileSettingsViewProps {
  onClose?: () => void;
}

export function FileSettingsView({ onClose }: FileSettingsViewProps = {}) {
  const { t } = useTranslation();

  return (
    <PluginSettingsPageShell
      title={t('files.settingsTitle')}
      subtitle={t('files.settingsSubtitle')}
      onClose={onClose}
    >
      <FileSettingsForm />
    </PluginSettingsPageShell>
  );
}
