// Renders Profile / Preferences / ActivityLog form based on selected category.
// Buttons live in panel footer and invoke the form handle.

import React, { useImperativeHandle } from 'react';

import type { PanelFormHandle } from '@/core/types/panelFormHandle';
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

export const SettingsForm = React.forwardRef<PanelFormHandle, SettingsFormProps>(
  function SettingsForm({ currentSetting, currentItem, onCancel }, ref) {
    const { submitSave } = useSettingsContext();

    useImperativeHandle(
      ref,
      () => ({
        submit: () => submitSave(),
        cancel: onCancel,
      }),
      [submitSave, onCancel],
    );

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
  },
);
