// Renders Profile / Preferences / ActivityLog form based on selected category.
// Buttons live in panel footer; Save is triggered via window.submitSettingsForm.

import React, { useEffect } from 'react';

import { ActivityLogForm } from '@/core/ui/SettingsForms/ActivityLogForm';
import { PreferencesSettingsForm } from '@/core/ui/SettingsForms/PreferencesSettingsForm';
import { ProfileSettingsForm } from '@/core/ui/SettingsForms/ProfileSettingsForm';
import { TeamSettingsForm } from '@/core/ui/SettingsForms/TeamSettingsForm';

import { useSettingsContext } from '../context/SettingsContext';

interface SettingsFormProps {
  currentSetting?: { category: string } | null;
  currentItem?: { category: string } | null;
  onCancel: () => void;
  onSave?: (data: any) => Promise<boolean>;
}

export function SettingsForm({ currentSetting, currentItem, onCancel }: SettingsFormProps) {
  const { submitSave } = useSettingsContext();

  useEffect(() => {
    (window as unknown as { submitSettingsForm?: () => Promise<void> }).submitSettingsForm =
      submitSave;
    return () => {
      (window as unknown as { submitSettingsForm?: null }).submitSettingsForm = null;
    };
  }, [submitSave]);

  const category = currentSetting?.category ?? currentItem?.category;
  if (!category) {
    return null;
  }
  if (category === 'profile') {
    return <ProfileSettingsForm onCancel={onCancel} />;
  }
  if (category === 'preferences') {
    return <PreferencesSettingsForm onCancel={onCancel} />;
  }
  if (category === 'activity-log') {
    return <ActivityLogForm onCancel={onCancel} />;
  }
  if (category === 'team') {
    return <TeamSettingsForm onCancel={onCancel} />;
  }
  return null;
}
