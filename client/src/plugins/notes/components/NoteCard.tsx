import { AtSign, ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Note } from '../types/notes';

function stripHtml(html: string): string {
  if (!html) {
    return '';
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

function truncateContent(content: string, maxLength = 150): string {
  const plain = stripHtml(content);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.substring(0, maxLength)}…`;
}

export function NoteCard({
  note,
  selected,
  highlighted,
  onClick,
  checkbox,
}: {
  note: Note;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const mentionCount = note.mentions?.length ?? 0;
  const preview = truncateContent(note.content);
  const updatedLabel = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : null;

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      data-list-item={JSON.stringify(note)}
      data-plugin-name="notes"
      role="button"
      aria-label={`Open note ${note.title}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {checkbox}
            <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug">
              {note.title}
            </h3>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {mentionCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {mentionCount}
              </span>
            ) : null}
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>

        {preview ? <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p> : null}

        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <AtSign className="h-3.5 w-3.5 flex-shrink-0" />
          {mentionCount > 0 ? (
            <span className="min-w-0 truncate font-medium text-plugin">
              @{note.mentions[0].contactName}
              {mentionCount > 1 ? ` +${mentionCount - 1}` : ''}
            </span>
          ) : (
            <span>{t('notes.noMentions')}</span>
          )}
        </div>

        {updatedLabel ? (
          <div className="mt-auto border-t border-border/60 pt-2.5">
            <span className="text-xs text-muted-foreground">
              {t('common.updated')}: {updatedLabel}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
