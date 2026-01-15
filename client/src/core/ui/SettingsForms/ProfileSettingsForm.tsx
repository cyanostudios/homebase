// client/src/core/ui/SettingsForms/ProfileSettingsForm.tsx
// Profile settings form component

import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { Heading } from '@/core/ui/Typography';

interface ProfileSettingsFormProps {
  onCancel: () => void;
}

export function ProfileSettingsForm({ onCancel }: ProfileSettingsFormProps) {
  const { user, getSettings, updateSettings } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
  });

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSettings('profile');
      setFormData({
        name: settings?.name || '',
        email: user?.email || '',
      });
    } catch (error) {
      console.error('Failed to load profile settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings('profile', {
        name: formData.name,
      });
      onCancel();
    } catch (error) {
      console.error('Failed to save profile settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Profile Information
        </Heading>
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
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
