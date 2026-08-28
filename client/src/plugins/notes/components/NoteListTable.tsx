import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SortableListTable } from '@/core/ui/SortableListTable';

import type { Note } from '../types/notes';
import type { NoteSortField, NoteSortOrder } from '../utils/noteListSort';

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
}: NoteListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        field: 'title' as const,
        header: t('notes.title'),
        cell: (note: Note) => (
          <span className="font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary">
            {note.title}
          </span>
        ),
      },
      {
        field: 'mentions' as const,
        header: t('notes.mentions'),
        className: 'hidden sm:table-cell',
        cell: (note: Note) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {note.mentions?.length ?? 0}
          </span>
        ),
      },
    ],
    [t],
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
