import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const NOTE_TABLE_COLUMN_IDS = ['title', 'mentions', 'createdAt', 'updatedAt'] as const;

export type NoteTableColumnId = (typeof NOTE_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: NOTE_TABLE_COLUMN_IDS,
  requiredColumnId: 'title',
  defaultHidden: ['createdAt', 'updatedAt'],
});

export const DEFAULT_NOTE_TABLE_COLUMNS = helpers.DEFAULT;
export const isNoteTableColumnId = helpers.isColumnId;
export const normalizeNoteTableColumns = helpers.normalize;
export const resolveVisibleNoteTableColumns = helpers.resolveVisible;
export const noteTableColumnsEqual = helpers.equal;
export const reorderNoteTableColumns = helpers.reorder;
export const setNoteTableColumnHidden = helpers.setHidden;
export type NoteTableColumnsPref = ReturnType<typeof helpers.normalize>;
