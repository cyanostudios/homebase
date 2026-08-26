import { Check, Plus, Tag, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';

export interface ContactSettingsFormProps {
  onCancel: () => void;
}

export const ContactSettingsForm = React.forwardRef<PanelFormHandle, ContactSettingsFormProps>(
  function ContactSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [initialTags, setInitialTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(CONTACTS_SETTINGS_KEY);
          const loadedTags = Array.isArray(settings?.tags)
            ? settings.tags
                .filter((tag: unknown) => typeof tag === 'string')
                .map((tag: string) => tag.trim())
                .filter(Boolean)
            : [];
          setTags(loadedTags);
          setInitialTags(loadedTags);
        } catch (error) {
          console.error('Failed to load contacts settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const tagsEqual =
      tags.length === initialTags.length && tags.every((tag, i) => tag === initialTags[i]);
    const isDirty = !tagsEqual;

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        await updateSettings(CONTACTS_SETTINGS_KEY, { tags });
        setInitialTags([...tags]);
        onCancel();
      } catch (error) {
        console.error('Failed to save contacts settings:', error);
      } finally {
        setIsSaving(false);
      }
    }, [tags, updateSettings, onCancel]);

    const addTag = () => {
      const next = newTag.trim();
      if (!next) {
        return;
      }
      const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
      if (exists) {
        setNewTag('');
        return;
      }
      setTags((prev) => [...prev, next]);
      setNewTag('');
    };

    const removeTag = (tag: string) => {
      setTags((prev) => prev.filter((x) => x !== tag));
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
      return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
    }

    return (
      <div className="space-y-6">
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
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>{tag}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 min-w-5 p-0 rounded hover:bg-muted"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </DetailCard>
        </DetailSection>

        {isDirty && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              variant="primary"
              size="sm"
              icon={Check}
              disabled={isSaving}
              className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </div>
    );
  },
);
