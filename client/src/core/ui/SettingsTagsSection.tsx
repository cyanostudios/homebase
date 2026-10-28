import { Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

function readTags(settings: { tags?: unknown } | null | undefined): string[] {
  return Array.isArray(settings?.tags)
    ? settings.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];
}

/**
 * Plugin settings category body: create and remove catalog tags.
 * Add/remove saves immediately so the list filter can pick them up.
 */
export function SettingsTagsSection({ settingsKey }: { settingsKey: string }) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSettings(settingsKey)
      .then((settings) => {
        if (!cancelled) {
          setTags(readTags(settings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTags([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsKey, settingsVersion]);

  const persist = useCallback(
    async (next: string[]) => {
      setTags(next);
      await updateSettings(settingsKey, { tags: next });
    },
    [settingsKey, updateSettings],
  );

  const addTag = useCallback(() => {
    const next = newTag.trim();
    if (!next) {
      return;
    }
    if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setNewTag('');
      return;
    }
    setNewTag('');
    void persist([...tags, next]);
  }, [newTag, persist, tags]);

  const removeTag = useCallback(
    (tag: string) => {
      void persist(tags.filter((entry) => entry !== tag));
    },
    [persist, tags],
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  return (
    <DetailSection
      title={t('common.tags')}
      icon={SETTINGS_CATEGORY_ICONS.tags}
      subtleTitle
      className="pt-0"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('common.tagsSettingsHint')}</p>
        <div className="flex items-center gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder={t('common.tagsPlaceholder')}
            className={cn(FORM_INPUT_CLASS, 'flex-1')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <RoundIconLabelButton
            type="button"
            icon={Plus}
            label={t('common.add')}
            variant="secondary"
            size="xs"
            alwaysExpanded
            onClick={addTag}
            disabled={!newTag.trim()}
          />
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.tagsEmptyHint')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                <span>{tag}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 min-w-5 rounded p-0 hover:bg-muted"
                  onClick={() => removeTag(tag)}
                  aria-label={t('common.removeTag', { tag })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </DetailSection>
  );
}
