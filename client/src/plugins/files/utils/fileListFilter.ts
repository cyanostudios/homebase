import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { FileItem } from '../types/files';

/** Selectable filters (excluding "all", which clears the selection). */
export type FileListFilter = 'images' | 'withSize' | 'updated7d';

/** Empty array = show all files. Multiple filters are AND-combined. */
export type FileListFilterSelection = FileListFilter[];

export const FILE_LIST_FILTER_EXCLUSIVE_GROUPS = [] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function fileIsImage(file: Pick<FileItem, 'mimeType'>): boolean {
  return String(file.mimeType || '').startsWith('image/');
}

export function fileHasSize(file: Pick<FileItem, 'size'>): boolean {
  return typeof file.size === 'number' && file.size > 0;
}

export function fileIsUpdatedWithinDays(
  file: Pick<FileItem, 'updatedAt'>,
  days: number,
  nowMs: number = Date.now(),
): boolean {
  const date = file.updatedAt ? new Date(file.updatedAt).getTime() : NaN;
  return Number.isFinite(date) && nowMs - date <= days * DAY_MS;
}

export function fileMatchesSingleFilter(
  file: Pick<FileItem, 'mimeType' | 'size' | 'updatedAt'>,
  filter: FileListFilter,
  nowMs: number = Date.now(),
): boolean {
  if (filter === 'images') {
    return fileIsImage(file);
  }
  if (filter === 'withSize') {
    return fileHasSize(file);
  }
  if (filter === 'updated7d') {
    return fileIsUpdatedWithinDays(file, 7, nowMs);
  }
  return true;
}

/** AND across selected filters. Empty selection = all files. */
export function fileMatchesListFilters(
  file: Pick<FileItem, 'mimeType' | 'size' | 'updatedAt'>,
  filters: FileListFilterSelection,
  nowMs: number = Date.now(),
): boolean {
  return itemMatchesListFilters(file, filters, (item, filter) =>
    fileMatchesSingleFilter(item, filter, nowMs),
  );
}

/**
 * Toggle a filter for multi-select.
 * All file facets toggle independently (no exclusive groups).
 */
export function toggleFileListFilter(
  current: FileListFilterSelection,
  filter: FileListFilter,
): FileListFilterSelection {
  return toggleListFilterSelection(current, filter, FILE_LIST_FILTER_EXCLUSIVE_GROUPS);
}
