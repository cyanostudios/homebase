// Mail settings as full-page content matching Core Settings layout.

import React from 'react';
import { useTranslation } from 'react-i18next';

import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

import { useMail } from '../hooks/useMail';

import { MailSettingsForm } from './MailSettingsForm';

interface MailSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function MailSettingsView({ inlineTrailing }: MailSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { closeMailSettingsView } = useMail();

  return (
    <PluginSettingsPageShell
      title={t('mail.settingsTitle')}
      subtitle={t('mail.settingsSubtitle')}
      trailing={inlineTrailing}
    >
      <MailSettingsForm onCancel={closeMailSettingsView} onSaveSuccess={closeMailSettingsView} />
    </PluginSettingsPageShell>
  );
}
