// client/src/core/ui/SettingsForms/ProfileSettingsForm.tsx
// Profile settings form – actions are in panel footer

import React, { useState, useEffect, useCallback } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { useSettingsContext } from '@/plugins/settings/context/SettingsContext';

interface ProfileSettingsFormProps {
  onCancel: () => void;
}

export function ProfileSettingsForm({ onCancel }: ProfileSettingsFormProps) {
  const { user, getSettings, updateSettings } = useApp();
  const { registerSaveHandler, setIsSaving, setHasChanges } = useSettingsContext();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    email: user?.email || '',
  });
  const [initialFormData, setInitialFormData] = useState({ name: '', title: '' });

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings('profile', {
        name: formData.name,
        title: formData.title,
      });
      setInitialFormData({ name: formData.name, title: formData.title });
      setHasChanges(false);
      onCancel();
    } catch (error) {
      console.error('Failed to save profile settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [formData.name, formData.title, onCancel, updateSettings, setIsSaving, setHasChanges]);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSettings('profile');
      const name = settings?.name || '';
      const title = settings?.title || '';
      setFormData({
        name,
        title,
        email: user?.email || '',
      });
      setInitialFormData({ name, title });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load profile settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty =
    formData.name !== initialFormData.name || formData.title !== initialFormData.title;

  useEffect(() => {
    setHasChanges(isDirty);
    return () => setHasChanges(false);
  }, [isDirty, setHasChanges]);

  useEffect(() => {
    registerSaveHandler(handleSave);
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSave]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <DetailSection title="Profile Information" className="pt-0">
      <div className="space-y-3">
        <div>
          <Label htmlFor="profile-name" className="mb-1">
            Name
          </Label>
          <Input
            id="profile-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your name"
          />
        </div>
        <div>
          <Label htmlFor="profile-title" className="mb-1">
            Title
          </Label>
          <Input
            id="profile-title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter your job title"
          />
        </div>
        <div>
          <Label htmlFor="profile-email" className="mb-1">
            Email
          </Label>
          <Input
            id="profile-email"
            type="email"
            value={formData.email}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
        </div>
      </div>
    </DetailSection>
  );
}
