import { CalendarDays, User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
import { TASK_PRIORITY_COLORS } from '../types/tasks';
import type { TaskColumnCount } from '../utils/taskColumnCount';

import { TaskStatusSelect } from './TaskStatusSelect';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

function truncateContent(content: string, maxLength = 150): string {
  const plain = htmlToPlainTextWithBreaks(content);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.substring(0, maxLength)}…`;
}

function formatDueDate(dueDate: Date | null) {
  if (!dueDate) {
    return null;
  }
  const today = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} days overdue`,
      className: 'text-destructive font-medium',
      badgeClassName: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    };
  }
  if (diffDays === 0) {
    return {
      text: 'Due today',
      className: 'text-orange-600 dark:text-orange-400 font-medium',
      badgeClassName: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    };
  }
  if (diffDays === 1) {
    return {
      text: 'Due tomorrow',
      className: 'text-yellow-600 dark:text-yellow-400',
      badgeClassName: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    };
  }
  return {
    text: due.toLocaleDateString(),
    className: 'text-muted-foreground',
    badgeClassName: 'bg-muted text-muted-foreground',
  };
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
  const showDue = Boolean(task.dueDate) && task.status !== 'completed';
  const dueDate = showDue && task.dueDate ? formatDueDate(new Date(task.dueDate)) : null;
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
              className={cn(BADGE_CLASS, TASK_PRIORITY_COLORS[task.priority])}
            >
              {task.priority}
            </Badge>
            {/* Due badge only when meta stays below (2/3 cols); 1-col shows due in meta instead. */}
            {!metaOnTop && dueDate ? (
              <Badge variant="outline" className={cn(BADGE_CLASS, dueDate.badgeClassName)}>
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
