import { StickyNote } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import {
  DETAIL_HEADER_BELOW_MENUS_CLASS,
  DETAIL_HEADER_CHIP_GAP_CLASS,
  DetailHeaderMetaRow,
} from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import type { Note } from '../types/notes';

import { NoteDetailHeaderMenus } from './NoteDetailHeaderMenus';

export function NoteQuickContextPanel({
  note,
  headerBelow = null,
  afterHeaderActions = null,
  readOnly = false,
  headerTrailing,
}: {
  note: Note;
  /** Optional row under the title (e.g. view tab chips). */
  headerBelow?: React.ReactNode;
  afterHeaderActions?: React.ReactNode;
  /** Companion / browse-only: no edit chrome. */
  readOnly?: boolean;
  /** Optional trailing control on the title row (e.g. companion Open full + Close). */
  headerTrailing?: React.ReactNode;
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
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="px-4 py-5">
        {readOnly ? (
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">{titleLeading}</div>
            {headerTrailing ? <div className="shrink-0">{headerTrailing}</div> : null}
          </div>
        ) : (
          <NoteDetailHeaderMenus
            note={note}
            leading={titleLeading}
            afterActions={afterHeaderActions}
          />
        )}
        <div
          className={cn(
            DETAIL_HEADER_BELOW_MENUS_CLASS,
            'flex min-w-0 flex-col',
            DETAIL_HEADER_CHIP_GAP_CLASS,
          )}
        >
          {updatedLabel ? (
            <DetailHeaderMetaRow className="mt-0">
              <p className="min-w-0 text-xs text-muted-foreground">
                {t('common.updated')} {updatedLabel}
              </p>
            </DetailHeaderMetaRow>
          ) : null}
          {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
        </div>
      </div>
    </Card>
  );
}
