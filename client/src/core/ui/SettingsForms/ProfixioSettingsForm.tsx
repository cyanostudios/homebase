// client/src/core/ui/SettingsForms/ProfixioSettingsForm.tsx

import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSection } from '@/core/ui/DetailSection';
import { profixioApi } from '@/plugins/profixio/api/profixioApi';
import { ProfixioSettings } from '@/plugins/profixio/types/profixio';

interface ProfixioSettingsFormProps {
  onCancel: () => void;
}

export function ProfixioSettingsForm({ onCancel }: ProfixioSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProfixioSettings>({
    apiKey: '',
    defaultTeamFilter: 'IFK Malmö',
    defaultSeasonId: null,
    defaultTournamentId: null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await profixioApi.getSettings();
      setFormData({
        apiKey: response.settings.apiKey || '',
        defaultTeamFilter: response.settings.defaultTeamFilter || 'IFK Malmö',
        defaultSeasonId: response.settings.defaultSeasonId || null,
        defaultTournamentId: response.settings.defaultTournamentId || null,
      });
    } catch (error) {
      console.error('Failed to load Profixio settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await profixioApi.updateSettings(formData);
      onCancel();
    } catch (error) {
      console.error('Failed to save Profixio settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Profixio API Configuration">
          <div className="space-y-3">
            <div>
              <Label htmlFor="profixio-api-key" className="mb-1">
                API Key *
              </Label>
              <Input
                id="profixio-api-key"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Enter your Profixio API key"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Contact Profixio to get an API token
              </p>
            </div>
          </div>
        </DetailSection>
      </Card>

      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Default Filters">
          <div className="space-y-3">
            <div>
              <Label htmlFor="profixio-team-filter" className="mb-1">
                Default Team Filter
              </Label>
              <Input
                id="profixio-team-filter"
                type="text"
                value={formData.defaultTeamFilter}
                onChange={(e) => setFormData({ ...formData, defaultTeamFilter: e.target.value })}
                placeholder="IFK Malmö"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default team to filter matches by (e.g., "IFK Malmö")
              </p>
            </div>
            <div>
              <Label htmlFor="profixio-season-id" className="mb-1">
                Default Season ID (optional)
              </Label>
              <Input
                id="profixio-season-id"
                type="number"
                value={formData.defaultSeasonId || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultSeasonId: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Season ID"
              />
            </div>
            <div>
              <Label htmlFor="profixio-tournament-id" className="mb-1">
                Default Tournament ID (optional)
              </Label>
              <Input
                id="profixio-tournament-id"
                type="number"
                value={formData.defaultTournamentId || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultTournamentId: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Tournament ID"
              />
            </div>
          </div>
        </DetailSection>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !formData.apiKey.trim()}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
