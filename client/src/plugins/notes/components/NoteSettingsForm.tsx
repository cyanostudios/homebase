import { LayoutGrid, List } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

export type NoteViewMode = 'grid' | 'list';

export interface NoteSettingsFormProps {
  onCancel: () => void;
}

const NOTES_SETTINGS_KEY = 'notes';

const viewModes: {
  id: NoteViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
];

export const NoteSettingsForm = React.forwardRef<PanelFormHandle, NoteSettingsFormProps>(
  function NoteSettingsForm({ onCancel }, ref) {
    const { getSettings, updateSettings } = useApp();
    const [viewMode, setViewMode] = useState<NoteViewMode>('grid');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(NOTES_SETTINGS_KEY);
          if (settings?.viewMode === 'list') {
            setViewMode('list');
          } else if (settings?.viewMode === 'grid') {
            setViewMode('grid');
          }
        } catch (error) {
          console.error('Failed to load notes settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const handleSave = useCallback(async () => {
      try {
        await updateSettings(NOTES_SETTINGS_KEY, { viewMode });
        onCancel();
      } catch (error) {
        console.error('Failed to save notes settings:', error);
      }
    }, [viewMode, updateSettings, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="text-sm text-muted-foreground">Loading...</div>;
    }

    return (
      <div className="space-y-4">
        {/* Tab row – same style as Core Settings (Preferences / Profile / Activity Log / Team) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {viewModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = viewMode === mode.id;
            return (
              <Button
                key={mode.id}
                variant="ghost"
                onClick={() => !isActive && setViewMode(mode.id)}
                className={cn(
                  'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                  'flex items-center gap-1.5 sm:gap-2',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{mode.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Content – single card, same as Core Settings */}
        <Card
          padding="md"
          className="overflow-hidden border border-border/60 bg-background/50 shadow-sm"
        >
          <DetailSection title="Default view" className="pt-0">
            <p className="text-sm text-muted-foreground">
              Notes will be displayed in the selected layout by default.
            </p>
          </DetailSection>
        </Card>
      </div>
    );
  },
);
