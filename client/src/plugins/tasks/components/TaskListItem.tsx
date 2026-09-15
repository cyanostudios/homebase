import { CalendarDays, User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { htmlToPlainTextWithBreaks } from '@/core/utils/textUtils';
import { cn } from '@/lib/utils';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { Task } from '../types/tasks';
import { TASK_PRIORITY_COLORS, formatTaskDueDisplay } from '../types/tasks';
import type { TaskColumnCount } from '../utils/taskColumnCount';

import { TaskStatusSelect } from './TaskStatusSelect';

function truncateContent(content: string, maxLength = 150): string {
  const plain = htmlToPlainTextWithBreaks(content);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.substring(0, maxLength)}…`;
}

export function TaskListItem({
  task,
  selected,
  highlighted,
  active,
  onClick,
  checkbox,
  assignedNames = [],
  assignedTeamName = null,
  onStatusChange,
  columnCount = 1,
}: {
  task: Task;
  selected?: boolean;
  highlighted?: boolean;
  active?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  assignedNames?: string[];
  /** Resolved team label when task has teamId; null if none. */
  assignedTeamName?: string | null;
  onStatusChange: (status: string) => void;
  /** When 1, meta sits on the top row; 2/3 keep meta below title/excerpt. */
  columnCount?: TaskColumnCount;
}) {
  const { t } = useTranslation();
  const showDue =
    Boolean(task.dueDate) && task.status !== 'completed' && task.status !== 'cancelled';
  const dueDisplay = showDue ? formatTaskDueDisplay(task.dueDate, task.status) : null;
  const dueDate = dueDisplay
    ? {
        text: dueDisplay.text,
        className: dueDisplay.textClassName,
        badgeClassName: dueDisplay.badgeClassName,
      }
    : null;
  const excerpt = task.content ? truncateContent(task.content) : '';
  const updatedLabel = task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : null;
  const metaOnTop = columnCount === 1;
  const hasMeta = Boolean(dueDate || assignedNames.length > 0 || assignedTeamName || updatedLabel);

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  const metaRow = hasMeta ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      {dueDate ? (
        <span className={cn('inline-flex min-w-0 items-center gap-1.5', dueDate.className)}>
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{dueDate.text}</span>
        </span>
      ) : null}
      {assignedNames.length > 0 ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <User className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{assignedNames.join(', ')}</span>
        </span>
      ) : null}
      {assignedTeamName ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Users className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{assignedTeamName}</span>
        </span>
      ) : null}
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        active && 'bg-primary/5 ring-1 ring-primary/40',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'input[type="checkbox"], button, [role="combobox"], [data-radix-collection-item]',
          )
        ) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(task)}
      data-plugin-name="tasks"
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      aria-label={`Open task ${task.title}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(BADGE_CHIP_CLASS, TASK_PRIORITY_COLORS[task.priority])}
            >
              {task.priority}
            </Badge>
            {/* Due badge only when meta stays below (2/3 cols); 1-col shows due in meta instead. */}
            {!metaOnTop && dueDate ? (
              <Badge variant="outline" className={cn(BADGE_CHIP_CLASS, dueDate.badgeClassName)}>
                {dueDate.text}
              </Badge>
            ) : null}
            {metaOnTop ? metaRow : null}
          </div>
          <div
            className="flex shrink-0 justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TaskStatusSelect task={task} onStatusChange={onStatusChange} hideInlineLabel compact />
          </div>
        </div>

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{task.title}</h3>

        {excerpt ? (
          <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
            {excerpt}
          </p>
        ) : null}

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
