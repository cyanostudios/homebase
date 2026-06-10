// Teams settings as full-page content: header + card + save footer.

import { CalendarRange, Check } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';

const TEAMS_SETTINGS_KEY = 'teams';

interface TeamsSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function TeamsSettingsView({ inlineTrailing }: TeamsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();

  const [activeSeason, setActiveSeason] = useState('');
  const [initialSeason, setInitialSeason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(TEAMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = String(settings?.activeSeason || new Date().getFullYear());
        setActiveSeason(loaded);
        setInitialSeason(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = String(new Date().getFullYear());
          setActiveSeason(fallback);
          setInitialSeason(fallback);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings]);

  const isDirty = activeSeason !== initialSeason;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(TEAMS_SETTINGS_KEY, { activeSeason: activeSeason.trim() });
      setInitialSeason(activeSeason);
    } catch (error) {
      console.error('Failed to save teams settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeSeason, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('teams.settings.title')}
          </h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">{inlineTrailing}</div>
      </div>

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <CalendarRange className="h-3.5 w-3.5" />
              <span>{t('teams.settings.seasonSection')}</span>
            </div>
          }
          className="pt-0"
        >
          <div className="space-y-1">
            <Input
              value={activeSeason}
              onChange={(e) => setActiveSeason(e.target.value)}
              placeholder={String(new Date().getFullYear())}
              className="max-w-[200px]"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {t('teams.settings.activeSeasonHint')}
            </p>
          </div>
        </DetailSection>
      </Card>

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
