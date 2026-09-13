import { AtSign, StickyNote } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';
import { formatDateTimeShort } from '@/core/utils/dateFormat';

import type { Note } from '../types/notes';
import type { NoteSortField, NoteSortOrder } from '../utils/noteListSort';
import {
  DEFAULT_NOTE_TABLE_COLUMNS,
  type NoteTableColumnId,
  resolveVisibleNoteTableColumns,
} from '../utils/noteTableColumns';

export type NoteListTableProps = {
  notes: Note[];
  primarySort: NoteSortField;
  sortOrder: NoteSortOrder;
  onSort: (field: NoteSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (note: Note) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedNoteId: string | null;
  /** When false, the selection checkbox column is hidden (e.g. quick context open). */
  selectionEnabled?: boolean;
  activeNoteId?: string | number | null;
  visibleColumnIds?: NoteTableColumnId[];
};

export function NoteListTable({
  notes,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedNoteId,
  selectionEnabled = true,
  activeNoteId = null,
  visibleColumnIds,
}: NoteListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleNoteTableColumns({ tableColumns: DEFAULT_NOTE_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<
      NoteTableColumnId,
      {
        field: NoteSortField;
        header: React.ReactNode;
        className?: string;
        cell: (note: Note) => React.ReactNode;
      }
    > = {
      title: {
        field: 'title',
        header: t('notes.title'),
        cell: (note: Note) => {
          const mentionCount = note.mentions?.length ?? 0;
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.note')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={StickyNote}
                    className="h-5 w-5 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={note.title}
                >
                  {note.title}
                </span>
              </div>
              {mentionCount > 0 ? (
                <div className="flex min-w-0 items-center gap-1.5 pl-0.5">
                  <span title={t('notes.mentions')} className="inline-flex shrink-0">
                    <SectionCategoryIcon
                      icon={AtSign}
                      className={cn(
                        'h-4 w-4 bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 [&_svg]:h-2.5 [&_svg]:w-2.5',
                      )}
                    />
                  </span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {mentionCount}
                  </span>
                </div>
              ) : null}
            </div>
          );
        },
      },
      mentions: {
        field: 'mentions',
        header: t('notes.mentions'),
        className: 'hidden sm:table-cell',
        cell: (note: Note) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {note.mentions?.length ?? 0}
          </span>
        ),
      },
      createdAt: {
        field: 'createdAt',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        cell: (note: Note) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(note.createdAt) || '—'}
          </span>
        ),
      },
      updatedAt: {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (note: Note) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(note.updatedAt) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is (typeof columnDefs)[NoteTableColumnId] => Boolean(col)),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={notes}
      columns={columns}
      getRowId={(note) => String(note.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(note) => note.title}
      rowClassName={(note) =>
        recentlyDuplicatedNoteId === String(note.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(note) => activeNoteId != null && String(note.id) === String(activeNoteId)}
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      selection={
        selectionEnabled
          ? {
              isSelected,
              onCheckboxMouseDown,
              onCheckboxChange,
              allVisibleSelected,
              onHeaderCheckboxChange,
              selectAllAriaLabel: t('common.selectAllVisible'),
              selectRowAriaLabel: (selected) =>
                selected ? t('common.unselectRow') : t('common.selectRow'),
            }
          : undefined
      }
      pluginName="notes"
      dataListItem={(note) => note}
    />
  );
}
