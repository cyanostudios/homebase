import { Eye, LayoutGrid, List, Plus, Tag, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

export type ContactViewMode = 'grid' | 'list';

export interface ContactSettingsFormProps {
  onCancel: () => void;
}

const CONTACTS_SETTINGS_KEY = 'contacts';

export const ContactSettingsForm = React.forwardRef<PanelFormHandle, ContactSettingsFormProps>(
  function ContactSettingsForm({ onCancel }, ref) {
    const { getSettings, updateSettings } = useApp();
    const [viewMode, setViewMode] = useState<ContactViewMode>('grid');
    const [isLoading, setIsLoading] = useState(true);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(CONTACTS_SETTINGS_KEY);
          if (settings?.viewMode === 'list') {
            setViewMode('list');
          } else if (settings?.viewMode === 'grid') {
            setViewMode('grid');
          }
          if (Array.isArray(settings?.tags)) {
            setTags(
              settings.tags
                .filter((t: any) => typeof t === 'string')
                .map((t: string) => t.trim())
                .filter(Boolean),
            );
          } else {
            setTags([]);
          }
        } catch (error) {
          console.error('Failed to load contacts settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const handleSave = useCallback(async () => {
      try {
        await updateSettings(CONTACTS_SETTINGS_KEY, { viewMode, tags });
        onCancel();
      } catch (error) {
        console.error('Failed to save contacts settings:', error);
      }
    }, [viewMode, tags, updateSettings, onCancel]);

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

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
    }

    return (
      <div className="space-y-6">
        <DetailSection title="Default view" icon={Eye}>
          <DetailCard className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">View mode</Label>
                <p className="text-[11px] text-muted-foreground">
                  How your contacts are displayed by default
                </p>
              </div>
              <div className="flex rounded-lg border border-input bg-muted/30 p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  icon={LayoutGrid}
                  className="h-9 text-xs px-3"
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  icon={List}
                  className="h-9 text-xs px-3"
                  onClick={() => setViewMode('list')}
                >
                  List
                </Button>
              </div>
            </div>
          </DetailCard>
        </DetailSection>

        <DetailSection title="Tags" icon={Tag} iconPlugin="contacts">
          <DetailCard className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Available tags</Label>
              <p className="text-[11px] text-muted-foreground">
                Tags can be assigned to contacts in Contact Properties.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag (e.g. Family, Work)"
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
                icon={Plus}
                onClick={addTag}
                disabled={!newTag.trim()}
                className="h-9 text-xs px-3"
              >
                Add
              </Button>
            </div>

            {tags.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tags yet.</div>
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
                      aria-label={`Remove tag ${t}`}
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
  },
);
