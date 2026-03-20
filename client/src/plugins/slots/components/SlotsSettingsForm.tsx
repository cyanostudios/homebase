import { Eye, LayoutGrid, List, Plus, Tag, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

import { useSlotSettings } from '../hooks/useSlotSettings';

export interface SlotsSettingsFormProps {
  onCancel: () => void;
}

export function SlotsSettingsForm({ onCancel }: SlotsSettingsFormProps) {
  const { viewMode, setViewMode, tags, setTags, isLoading, save } = useSlotSettings();
  const [newTag, setNewTag] = useState('');
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

  const addTag = () => {
    const next = newTag.trim();
    if (!next) {
      return;
    }
    const exists = tags.some((t) => t.toLowerCase() === next.toLowerCase());
    if (exists) {
      setNewTag('');
      return;
    }
    setTags((prev) => [...prev, next]);
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

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

      <DetailSection
        title={
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" />
            <span>Categories</span>
          </div>
        }
      >
        <DetailCard className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Available categories</Label>
            <p className="text-[11px] text-muted-foreground">
              Categories can be assigned to slots in Slot form.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a category (e.g. VIP, Stand A)"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addTag}
              disabled={!newTag.trim()}
              icon={Plus}
              className="h-9 text-xs px-3"
            >
              Add
            </Button>
          </div>

          {tags.length === 0 ? (
            <div className="text-sm text-muted-foreground">No categories yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="flex items-center gap-1 pr-1">
                  <span>{t}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 min-w-5 p-0 rounded hover:bg-muted"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove category ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </DetailCard>
      </DetailSection>
    </div>
  );
}
