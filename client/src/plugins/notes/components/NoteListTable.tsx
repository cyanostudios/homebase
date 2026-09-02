import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SortableListTable } from '@/core/ui/SortableListTable';
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
        cell: (note: Note) => (
          <span className="font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary">
            {note.title}
          </span>
        ),
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
