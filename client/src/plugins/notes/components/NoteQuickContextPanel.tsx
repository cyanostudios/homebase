import { StickyNote } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import type { Note } from '../types/notes';

import { NoteDetailHeaderMenus } from './NoteDetailHeaderMenus';

export function NoteQuickContextPanel({
  note,
  afterHeaderActions = null,
  children = null,
  cardClassName,
}: {
  note: Note;
  afterHeaderActions?: React.ReactNode;
  children?: React.ReactNode;
  cardClassName?: string;
}) {
  const { t } = useTranslation();
  const updatedLabel = note.updatedAt
    ? new Date(note.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.note')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={StickyNote}
          className="h-8 w-8 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {note.title || '—'}
      </h3>
    </div>
  );

  return (
    <Card
      padding="none"
      className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col', cardClassName)}
    >
      <div className="border-b border-border/50 px-4 py-5">
        <NoteDetailHeaderMenus
          note={note}
          leading={titleLeading}
          afterActions={afterHeaderActions}
        />
      </div>

      <div className="min-w-0 space-y-4 overflow-x-hidden px-4 py-4">
        {updatedLabel ? (
          <p className="text-xs text-muted-foreground">
            {t('common.updated')} {updatedLabel}
          </p>
        ) : null}

        {children ? (
          <div className="min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden">
            {children}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
