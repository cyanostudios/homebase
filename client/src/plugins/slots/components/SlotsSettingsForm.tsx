import { Eye, LayoutGrid, List } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

import { useSlotSettings } from '../hooks/useSlotSettings';

export interface SlotsSettingsFormProps {
  onCancel: () => void;
}

export function SlotsSettingsForm({ onCancel }: SlotsSettingsFormProps) {
  const { viewMode, setViewMode, isLoading, save } = useSlotSettings();
  const saveRef = useRef(save);
  const cancelRef = useRef(onCancel);
  saveRef.current = save;
  cancelRef.current = onCancel;

  useEffect(() => {
    (window as unknown as { submitSlotsForm?: () => void }).submitSlotsForm = () =>
      saveRef.current?.().then(() => cancelRef.current?.());
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
