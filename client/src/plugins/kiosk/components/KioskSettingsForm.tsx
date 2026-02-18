import { Eye, LayoutGrid, List } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

export type KioskViewMode = 'grid' | 'list';

export interface KioskSettingsFormProps {
  onCancel: () => void;
}

const SLOTS_SETTINGS_KEY = 'slots';

export function KioskSettingsForm({ onCancel }: KioskSettingsFormProps) {
  const { getSettings, updateSettings } = useApp();
  const [viewMode, setViewMode] = useState<KioskViewMode>('list');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const settings = await getSettings(SLOTS_SETTINGS_KEY);
        if (settings?.viewMode === 'list') {
          setViewMode('list');
        } else if (settings?.viewMode === 'grid') {
          setViewMode('grid');
        }
      } catch (error) {
        console.error('Failed to load kiosk settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [getSettings]);

  const handleSave = useCallback(async () => {
    try {
      await updateSettings(SLOTS_SETTINGS_KEY, { viewMode });
      onCancel();
    } catch (error) {
      console.error('Failed to save kiosk settings:', error);
    }
  }, [viewMode, updateSettings, onCancel]);

  const saveRef = useRef(handleSave);
  const cancelRef = useRef(onCancel);
  saveRef.current = handleSave;
  cancelRef.current = onCancel;

  useEffect(() => {
    (window as unknown as { submitSlotsForm?: () => void }).submitSlotsForm = () =>
      saveRef.current?.();
    (window as unknown as { cancelSlotsForm?: () => void }).cancelSlotsForm = () =>
      cancelRef.current?.();
    return () => {
      delete (window as unknown as { submitSlotsForm?: () => void }).submitSlotsForm;
      delete (window as unknown as { cancelSlotsForm?: () => void }).cancelSlotsForm;
    };
  }, []);

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
              <p className="text-[11px] text-muted-foreground">
                How slots are shown by default (list or grid)
              </p>
            </div>
            <div className="flex bg-background p-1 rounded-lg border border-border">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 text-[10px] uppercase font-bold tracking-tight"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 text-[10px] uppercase font-bold tracking-tight text-muted-foreground hover:text-foreground"
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
}
