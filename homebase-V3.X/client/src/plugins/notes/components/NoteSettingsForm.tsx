import { Eye, LayoutGrid, List } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

export type NoteViewMode = 'grid' | 'list';

export interface NoteSettingsFormProps {
  onCancel: () => void;
}

const NOTES_SETTINGS_KEY = 'notes';

export const NoteSettingsForm: React.FC<NoteSettingsFormProps> = ({ onCancel }) => {
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

  useEffect(() => {
    (window as any).submitNotesForm = handleSave;
    (window as any).cancelNotesForm = onCancel;
    return () => {
      delete (window as any).submitNotesForm;
      delete (window as any).cancelNotesForm;
    };
  }, [handleSave, onCancel]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <DetailSection
        title={
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            <span>Default view</span>
          </div>
        }
      >
        <DetailCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">View mode</Label>
              <p className="text-[11px] text-gray-500">How your notes are displayed by default</p>
            </div>
            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className={
                  viewMode === 'grid'
                    ? 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight'
                    : 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className={
                  viewMode === 'list'
                    ? 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight'
                    : 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }
                onClick={() => setViewMode('list')}
              >
                <List className="w-3.5 h-3.5" />
                List
              </Button>
            </div>
          </div>
        </DetailCard>
      </DetailSection>
    </div>
  );
};
