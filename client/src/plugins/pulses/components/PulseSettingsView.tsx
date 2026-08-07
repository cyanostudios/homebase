// Pulse settings as full-page content matching Core Settings layout.

import React from 'react';
import { useTranslation } from 'react-i18next';

import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';

import { usePulses } from '../hooks/usePulses';

import { PulseSettingsForm } from './PulseSettingsForm';

interface PulseSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function PulseSettingsView({ inlineTrailing }: PulseSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { closePulseSettingsView } = usePulses();

  return (
    <PluginSettingsPageShell
      title={t('pulses.settingsTitle')}
      subtitle={t('pulses.settingsSubtitle')}
      trailing={inlineTrailing}
    >
      <PulseSettingsForm onCancel={closePulseSettingsView} onSaveSuccess={closePulseSettingsView} />
    </PluginSettingsPageShell>
  );
}
