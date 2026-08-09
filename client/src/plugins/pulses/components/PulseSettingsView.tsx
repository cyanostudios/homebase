// Pulse settings as full-page content matching Core Settings layout.

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
} from '@/core/ui/PluginSettingsPageShell';

import { usePulses } from '../hooks/usePulses';

import { PulseSettingsForm } from './PulseSettingsForm';

interface PulseSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function PulseSettingsView({ inlineTrailing }: PulseSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { closePulseSettingsView } = usePulses();
  const formRef = useRef<PanelFormHandle>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    void formRef.current?.submit();
  }, []);

  return (
    <PluginSettingsPageShell
      title={t('pulses.settingsTitle')}
      subtitle={t('pulses.settingsSubtitle')}
      trailing={inlineTrailing}
      saveAction={
        isDirty ? <SettingsHeaderSaveButton onClick={handleSave} isSaving={isSaving} /> : null
      }
    >
      <PulseSettingsForm
        ref={formRef}
        onCancel={closePulseSettingsView}
        onDirtyChange={setIsDirty}
        onSavingChange={setIsSaving}
      />
    </PluginSettingsPageShell>
  );
}
