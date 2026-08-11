import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';
import { stripHtml } from '@/core/utils/textUtils';

import type { Note } from '../types/notes';

/** Selectable filters (excluding "all", which clears the selection). */
export type NoteListFilter = 'withMentions' | 'withContent' | 'recentlyUpdated';

/** Empty array = show all notes. Multiple filters are AND-combined. */
export type NoteListFilterSelection = NoteListFilter[];

export const NOTE_LIST_FILTER_EXCLUSIVE_GROUPS = [] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function noteHasMentions(note: Pick<Note, 'mentions'>): boolean {
  return (note.mentions?.length ?? 0) > 0;
}

export function noteHasContent(note: Pick<Note, 'content'>): boolean {
  return stripHtml(note.content || '').trim().length > 0;
}

export function noteIsRecentlyUpdated(
  note: Pick<Note, 'updatedAt'>,
  nowMs: number = Date.now(),
): boolean {
  const updated = note.updatedAt ? new Date(note.updatedAt).getTime() : NaN;
  return Number.isFinite(updated) && nowMs - updated <= 7 * DAY_MS;
}

export function noteMatchesSingleFilter(
  note: Pick<Note, 'mentions' | 'content' | 'updatedAt'>,
  filter: NoteListFilter,
  nowMs: number = Date.now(),
): boolean {
  if (filter === 'withMentions') {
    return noteHasMentions(note);
  }
  if (filter === 'withContent') {
    return noteHasContent(note);
  }
  if (filter === 'recentlyUpdated') {
    return noteIsRecentlyUpdated(note, nowMs);
  }
  return true;
}

/** AND across selected filters. Empty selection = all notes. */
export function noteMatchesListFilters(
  note: Pick<Note, 'mentions' | 'content' | 'updatedAt'>,
  filters: NoteListFilterSelection,
  nowMs: number = Date.now(),
): boolean {
  return itemMatchesListFilters(note, filters, (item, filter) =>
    noteMatchesSingleFilter(item, filter, nowMs),
  );
}

/**
 * Toggle a filter for multi-select.
 * All note facets toggle independently (no exclusive groups).
 */
export function toggleNoteListFilter(
  current: NoteListFilterSelection,
  filter: NoteListFilter,
): NoteListFilterSelection {
  return toggleListFilterSelection(current, filter, NOTE_LIST_FILTER_EXCLUSIVE_GROUPS);
}
