import { Tag, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { FORM_GHOST_PROP_CONTROL_CLASS } from '@/core/ui/formFieldStyles';
import { cn } from '@/lib/utils';

const ADD_TAG_VALUE = '__add_tag__';

function readCatalog(settings: { tags?: unknown } | null | undefined): string[] {
  return Array.isArray(settings?.tags)
    ? settings.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];
}

/**
 * Assign catalog tags on an item. New tags are created in Settings.
 */
export function ItemTagsField({
  settingsKey,
  value,
  onChange,
  className,
}: {
  settingsKey: string;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const [catalog, setCatalog] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getSettings(settingsKey)
      .then((settings) => {
        if (!cancelled) {
          setCatalog(readCatalog(settings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsKey, settingsVersion]);

  const selected = useMemo(
    () => (Array.isArray(value) ? value.filter((tag) => typeof tag === 'string') : []),
    [value],
  );
  const addable = catalog.filter(
    (tag) => !selected.some((current) => current.toLowerCase() === tag.toLowerCase()),
  );

  return (
    <div className={cn('flex min-w-0 flex-col items-stretch gap-1.5', className)}>
      <Select
        value={ADD_TAG_VALUE}
        onValueChange={(next) => {
          if (next && next !== ADD_TAG_VALUE) {
            onChange([...selected, next]);
          }
        }}
        disabled={addable.length === 0}
      >
        <SelectTrigger className={cn(FORM_GHOST_PROP_CONTROL_CLASS, 'sm:w-[180px]')}>
          <SelectValue placeholder={t('common.tagsPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ADD_TAG_VALUE}>
            {addable.length === 0 ? t('common.noMoreTags') : t('common.tagsPlaceholder')}
          </SelectItem>
          {addable.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <Badge
              key={tag}
              className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Tag className="h-3 w-3" />
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-5 min-w-5 rounded p-0 hover:bg-muted"
                onClick={() => onChange(selected.filter((entry) => entry !== tag))}
                aria-label={t('common.removeTag', { tag })}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">{t('common.tagsEmptyHint')}</span>
      )}
    </div>
  );
}
