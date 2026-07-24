import { CalendarDays, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { htmlToPlainTextWithBreaks } from '@/core/utils/textUtils';
import { cn } from '@/lib/utils';

import type { Task } from '../types/tasks';
import { TASK_PRIORITY_COLORS } from '../types/tasks';

import { TaskStatusSelect } from './TaskStatusSelect';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

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
  onClick,
  checkbox,
  assignedNames = [],
  onStatusChange,
}: {
  task: Task;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  assignedNames?: string[];
  onStatusChange: (status: string) => void;
}) {
  const { t } = useTranslation();
  const showDue = Boolean(task.dueDate) && task.status !== 'completed';
  const dueDate = showDue && task.dueDate ? formatDueDate(new Date(task.dueDate)) : null;
  const excerpt = task.content ? truncateContent(task.content) : '';
  const updatedLabel = task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : null;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
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
      aria-label={`Open task ${task.title}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            <Badge
              variant="outline"
              className={cn(BADGE_CLASS, TASK_PRIORITY_COLORS[task.priority])}
            >
              {task.priority}
            </Badge>
            {dueDate ? (
              <Badge variant="outline" className={cn(BADGE_CLASS, dueDate.badgeClassName)}>
                {dueDate.text}
              </Badge>
            ) : null}
          </div>
          <div
            className="flex shrink-0 justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TaskStatusSelect task={task} onStatusChange={onStatusChange} hideInlineLabel compact />
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {task.title}
        </h3>

        {excerpt ? (
          <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
            {excerpt}
          </p>
        ) : null}

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          {dueDate ? (
            <span className={cn('inline-flex min-w-0 items-center gap-1.5', dueDate.className)}>
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{dueDate.text}</span>
            </span>
          ) : null}
          {assignedNames.length > 0 ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{assignedNames.join(', ')}</span>
            </span>
          ) : null}
          {updatedLabel ? (
            <span className="truncate">
              {t('common.updated')}: {updatedLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
