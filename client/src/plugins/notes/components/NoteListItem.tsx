import { AtSign } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { htmlToPlainTextWithBreaks } from '@/core/utils/textUtils';
import { cn } from '@/lib/utils';

import type { Note } from '../types/notes';

function truncateContent(content: string, maxLength = 150): string {
  const plain = htmlToPlainTextWithBreaks(content);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.substring(0, maxLength)}…`;
}

export function NoteListItem({
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
  const excerpt = note.content ? truncateContent(note.content) : '';
  const updatedLabel = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : null;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(note)}
      data-plugin-name="notes"
      role="button"
      tabIndex={0}
      aria-label={`Open note ${note.title}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {checkbox}
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
            {note.title}
          </h3>
        </div>

        {excerpt ? (
          <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
            {excerpt}
          </p>
        ) : null}

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5 flex-shrink-0" />
            {mentionCount > 0 ? (
              <span className="min-w-0 truncate font-medium text-plugin">
                @{note.mentions[0].contactName}
                {mentionCount > 1 ? ` +${mentionCount - 1}` : ''}
              </span>
            ) : (
              <span>{t('notes.noMentions')}</span>
            )}
          </span>
          {updatedLabel ? (
            <span className="truncate">
              {t('common.updated')}: {updatedLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
