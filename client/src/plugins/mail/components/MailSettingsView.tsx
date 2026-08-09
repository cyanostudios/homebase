// Mail settings as full-page content matching Core Settings layout.

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
} from '@/core/ui/PluginSettingsPageShell';

import { useMail } from '../hooks/useMail';

import { MailSettingsForm } from './MailSettingsForm';

interface MailSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function MailSettingsView({ inlineTrailing }: MailSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { closeMailSettingsView } = useMail();
  const formRef = useRef<PanelFormHandle>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    void formRef.current?.submit();
  }, []);

  return (
    <PluginSettingsPageShell
      title={t('mail.settingsTitle')}
      subtitle={t('mail.settingsSubtitle')}
      trailing={inlineTrailing}
      saveAction={
        isDirty ? <SettingsHeaderSaveButton onClick={handleSave} isSaving={isSaving} /> : null
      }
    >
      <MailSettingsForm
        ref={formRef}
        onCancel={closeMailSettingsView}
        onDirtyChange={setIsDirty}
        onSavingChange={setIsSaving}
      />
    </PluginSettingsPageShell>
  );
}
