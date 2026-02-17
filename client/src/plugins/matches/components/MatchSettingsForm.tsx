import { CloudDownload, Eye, LayoutGrid, List } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

export type MatchViewMode = 'grid' | 'list';

export interface MatchSettingsFormProps {
  onCancel: () => void;
}

const MATCHES_SETTINGS_KEY = 'matches';

export function MatchSettingsForm({ onCancel }: MatchSettingsFormProps) {
  const { getSettings, updateSettings } = useApp();
  const [viewMode, setViewMode] = useState<MatchViewMode>('list');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const settings = await getSettings(MATCHES_SETTINGS_KEY);
        if (settings?.viewMode === 'list') {
          setViewMode('list');
        } else if (settings?.viewMode === 'grid') {
          setViewMode('grid');
        }
      } catch (error) {
        console.error('Failed to load matches settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [getSettings]);

  const handleSave = useCallback(async () => {
    try {
      await updateSettings(MATCHES_SETTINGS_KEY, { viewMode });
      onCancel();
    } catch (error) {
      console.error('Failed to save matches settings:', error);
    }
  }, [viewMode, updateSettings, onCancel]);

  const saveRef = useRef(handleSave);
  const cancelRef = useRef(onCancel);
  saveRef.current = handleSave;
  cancelRef.current = onCancel;

  // Refs so footer Save/Cancel always work; effect once so globals are not torn down when deps change
  useEffect(() => {
    (window as any).submitMatchesForm = () => saveRef.current?.();
    (window as any).cancelMatchesForm = () => cancelRef.current?.();
    return () => {
      delete (window as any).submitMatchesForm;
      delete (window as any).cancelMatchesForm;
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
                How matches are shown by default (list or grid)
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

      <DetailSection
        title={
          <div className="flex items-center gap-2">
            <CloudDownload className="w-3.5 h-3.5" />
            <span>Import from API</span>
          </div>
        }
      >
        <DetailCard className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Importing matches from external APIs will be available in a future version. You can add
            matches manually via &quot;Add match&quot; for now.
          </p>
          <Button variant="secondary" size="sm" disabled className="gap-1.5">
            <CloudDownload className="w-4 h-4" />
            Import from API (coming soon)
          </Button>
        </DetailCard>
      </DetailSection>
    </div>
  );
}
