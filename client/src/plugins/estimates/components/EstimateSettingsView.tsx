// Estimates settings as full-page content matching Core Settings layout.

import { LayoutGrid, List } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
} from '@/core/ui/PluginSettingsPageShell';
import { cn } from '@/lib/utils';

const ESTIMATES_SETTINGS_KEY = 'estimates';

type EstimateViewMode = 'grid' | 'list';

interface EstimateSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function EstimateSettingsView({ inlineTrailing }: EstimateSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();

  const [viewMode, setViewMode] = useState<EstimateViewMode>('grid');
  const [initialViewMode, setInitialViewMode] = useState<EstimateViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = settings?.viewMode === 'list' ? 'list' : 'grid';
        setViewMode(loaded);
        setInitialViewMode(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings]);

  const isDirty = viewMode !== initialViewMode;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(ESTIMATES_SETTINGS_KEY, { viewMode });
      setInitialViewMode(viewMode);
    } catch (error) {
      console.error('Failed to save estimates settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [viewMode, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const viewModes: {
    id: EstimateViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
  ];

  return (
    <PluginSettingsPageShell
      title={t('estimates.settingsTitle')}
      subtitle={t('estimates.settingsSubtitle')}
      trailing={inlineTrailing}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
        ) : null
      }
    >
      <DetailSection title="Default view" className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {viewModes.map((mode) => {
            const ModeIcon = mode.icon;
            const isActive = viewMode === mode.id;
            return (
              <Button
                key={mode.id}
                variant="ghost"
                onClick={() => setViewMode(mode.id)}
                className={cn(
                  'h-9 text-xs px-3 rounded-lg font-medium',
                  'flex items-center gap-1.5',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                )}
              >
                <ModeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{mode.label}</span>
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Estimates will be displayed in the selected layout by default.
        </p>
      </DetailSection>
    </PluginSettingsPageShell>
  );
}
