/**
 * Free-form include/exclude tag chips for the Pages table filter.
 * Type a term and press Enter (or comma) to add; click X to remove.
 */
import { X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  normalizeSiteAuditPageFilterTerm,
  parseSiteAuditPageFilterTerms,
} from '../utils/siteAuditPageFilter';

function addTerms(current: readonly string[], draft: string): string[] {
  const next = [...current];
  const seen = new Set(current.map((term) => term.toLowerCase()));
  for (const term of parseSiteAuditPageFilterTerms(draft)) {
    if (seen.has(term)) continue;
    seen.add(term);
    next.push(term);
  }
  return next;
}

export function SiteAuditPageFilterTags({
  label,
  inputId,
  placeholder,
  tags,
  onChange,
  className,
}: {
  label: string;
  inputId: string;
  placeholder: string;
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const next = addTerms(tags, draft);
    if (next.length !== tags.length) {
      onChange(next);
    } else {
      const single = normalizeSiteAuditPageFilterTerm(draft);
      if (single && !tags.some((tag) => tag.toLowerCase() === single)) {
        onChange([...tags, single]);
      }
    }
    setDraft('');
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={inputId} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={inputId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commitDraft();
            return;
          }
          if (event.key === 'Backspace' && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
        placeholder={placeholder}
        className="h-8 text-xs"
        autoComplete="off"
        spellCheck={false}
      />
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag}
              className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-5 min-w-5 rounded p-0 hover:bg-muted"
                onClick={() => onChange(tags.filter((entry) => entry !== tag))}
                aria-label={t('common.removeTag', { tag })}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
