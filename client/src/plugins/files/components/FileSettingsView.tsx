// Files settings as full-page content matching Core Settings layout.

import React from 'react';
import { useTranslation } from 'react-i18next';

import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

import { FileSettingsForm } from './FileSettingsForm';

interface FileSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function FileSettingsView({ inlineTrailing }: FileSettingsViewProps = {}) {
  const { t } = useTranslation();

  return (
    <PluginSettingsPageShell
      title={t('files.settingsTitle')}
      subtitle={t('files.settingsSubtitle')}
      trailing={inlineTrailing}
    >
      <FileSettingsForm />
    </PluginSettingsPageShell>
  );
}
