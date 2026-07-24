import { Check, Eye, Plus, Tag, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';

import {
  resolveContactColumnCount,
  CONTACTS_COLUMN_COUNT_STORAGE_KEY,
  CONTACTS_SETTINGS_KEY,
  type ContactColumnCount,
} from '../utils/contactColumnCount';

export interface ContactSettingsFormProps {
  onCancel: () => void;
}

const COLUMN_OPTIONS: ContactColumnCount[] = [1, 2, 3];

export const ContactSettingsForm = React.forwardRef<PanelFormHandle, ContactSettingsFormProps>(
  function ContactSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [columnCount, setColumnCount] = useState<ContactColumnCount>(1);
    const [initialColumnCount, setInitialColumnCount] = useState<ContactColumnCount>(1);
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
          const loaded = resolveContactColumnCount(settings);
          setColumnCount(loaded);
          setInitialColumnCount(loaded);
          const loadedTags = Array.isArray(settings?.tags)
            ? settings.tags
                .filter((tag: any) => typeof tag === 'string')
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
    const isDirty = columnCount !== initialColumnCount || !tagsEqual;

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        await updateSettings(CONTACTS_SETTINGS_KEY, { columnCount, tags });
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        }
        setInitialColumnCount(columnCount);
        setInitialTags([...tags]);
        onCancel();
      } catch (error) {
        console.error('Failed to save contacts settings:', error);
      } finally {
        setIsSaving(false);
      }
    }, [columnCount, tags, updateSettings, onCancel]);

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
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              <span>{t('contacts.defaultColumns')}</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">{t('contacts.columnsLabel')}</Label>
                <p className="text-[11px] text-gray-500">{t('contacts.columnsHelp')}</p>
              </div>
              <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
                {COLUMN_OPTIONS.map((count) => (
                  <Button
                    key={count}
                    variant={columnCount === count ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-8 min-w-8 px-3 text-[10px] font-bold tracking-tight',
                      columnCount !== count &&
                        'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                    )}
                    onClick={() => setColumnCount(count)}
                    aria-label={t(`contacts.columns${count}`)}
                  >
                    {count}
                  </Button>
                ))}
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
