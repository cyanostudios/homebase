import { Grid3x3, List as ListIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
} from '@/core/ui/PluginSettingsPageShell';
import { cn } from '@/lib/utils';

const YOUR_ITEMS_SETTINGS_KEY = 'your-items';

type ViewMode = 'grid' | 'list';

interface YourItemsSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function YourItemsSettingsView({ inlineTrailing }: YourItemsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [initialViewMode, setInitialViewMode] = useState<ViewMode>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(YOUR_ITEMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = settings?.viewMode === 'grid' ? 'grid' : 'list';
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
  }, [getSettings, settingsVersion]);

  const hasChanges = viewMode !== initialViewMode;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(YOUR_ITEMS_SETTINGS_KEY, { viewMode });
      setInitialViewMode(viewMode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('your-items:viewMode', viewMode);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <PluginSettingsPageShell
      title="Plugin settings"
      subtitle="Choose defaults for this plugin."
      trailing={inlineTrailing}
      saveAction={
        hasChanges ? (
          <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
        ) : null
      }
    >
      <DetailSection title="Default list view" className="pt-0">
        <p className="mb-4 text-sm text-muted-foreground">
          Choose whether the list opens in table or grid mode.
        </p>
        <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={ListIcon}
            className={cn(
              'h-7 rounded-[6px] px-2 text-xs',
              viewMode === 'list'
                ? 'bg-background text-foreground shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Grid3x3}
            className={cn(
              'h-7 rounded-[6px] px-2 text-xs',
              viewMode === 'grid'
                ? 'bg-background text-foreground shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
        </div>
      </DetailSection>
    </PluginSettingsPageShell>
  );
}
