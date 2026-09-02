import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const TASK_TABLE_COLUMN_IDS = [
  'title',
  'status',
  'priority',
  'dueDate',
  'assignedTo',
  'assignedTeam',
  'createdAt',
  'updatedAt',
] as const;

export type TaskTableColumnId = (typeof TASK_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: TASK_TABLE_COLUMN_IDS,
  requiredColumnId: 'title',
  defaultHidden: ['assignedTo', 'assignedTeam', 'createdAt', 'updatedAt'],
});

export const DEFAULT_TASK_TABLE_COLUMNS = helpers.DEFAULT;
export const isTaskTableColumnId = helpers.isColumnId;
export const normalizeTaskTableColumns = helpers.normalize;
export const resolveVisibleTaskTableColumns = helpers.resolveVisible;
export const taskTableColumnsEqual = helpers.equal;
export const reorderTaskTableColumns = helpers.reorder;
export const setTaskTableColumnHidden = helpers.setHidden;
export type TaskTableColumnsPref = ReturnType<typeof helpers.normalize>;
