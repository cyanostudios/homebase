import { Eye, LayoutGrid, List, Tag, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

export type ContactViewMode = 'grid' | 'list';

export interface ContactSettingsFormProps {
  onCancel: () => void;
}

const CONTACTS_SETTINGS_KEY = 'contacts';

export const ContactSettingsForm: React.FC<ContactSettingsFormProps> = ({ onCancel }) => {
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

  useEffect(() => {
    (window as any).submitContactsForm = handleSave;
    (window as any).cancelContactsForm = onCancel;
    return () => {
      delete (window as any).submitContactsForm;
      delete (window as any).cancelContactsForm;
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
              <p className="text-[11px] text-gray-500">
                How your contacts are displayed by default
              </p>
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

      <DetailSection
        title={
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" />
            <span>Tags</span>
          </div>
        }
      >
        <DetailCard className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Available tags</Label>
            <p className="text-[11px] text-gray-500">
              Tags can be assigned to contacts in Contact Properties.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag (e.g. Family, Work)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" onClick={addTag} disabled={!newTag.trim()}>
              Add
            </Button>
          </div>

          {tags.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tags yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="flex items-center gap-1">
                  {t}
                  <button
                    type="button"
                    className="ml-1 rounded hover:bg-muted p-0.5"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </DetailCard>
      </DetailSection>
    </div>
  );
};
