import { CalendarRange } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

const TEAMS_SETTINGS_KEY = 'teams';

export interface TeamSettingsFormProps {
  onCancel: () => void;
}

export const TeamSettingsForm = React.forwardRef<PanelFormHandle, TeamSettingsFormProps>(
  function TeamSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [activeSeason, setActiveSeason] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(TEAMS_SETTINGS_KEY);
          setActiveSeason(String(settings?.activeSeason || new Date().getFullYear()));
        } catch (error) {
          console.error('Failed to load teams settings:', error);
          setActiveSeason(String(new Date().getFullYear()));
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const handleSave = useCallback(async () => {
      try {
        await updateSettings(TEAMS_SETTINGS_KEY, { activeSeason: activeSeason.trim() });
        onCancel();
      } catch (error) {
        console.error('Failed to save teams settings:', error);
      }
    }, [activeSeason, updateSettings, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
    }

    return (
      <div className="space-y-6">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>{t('teams.settings.seasonSection')}</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">{t('teams.settings.activeSeason')}</Label>
              <p className="text-[11px] text-muted-foreground">
                {t('teams.settings.activeSeasonHint')}
              </p>
              <Input
                value={activeSeason}
                onChange={(e) => setActiveSeason(e.target.value)}
                placeholder={String(new Date().getFullYear())}
                className="max-w-[200px]"
              />
            </div>
          </DetailCard>
        </DetailSection>
      </div>
    );
  },
);
