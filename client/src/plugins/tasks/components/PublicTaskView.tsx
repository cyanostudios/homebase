import React, { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { BADGE_CHIP_CLASS, DUE_DATE_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDateTime } from '@/core/utils/dateFormat';
import { dedupeInFlightByKey } from '@/core/utils/dedupeInFlightByKey';
import { cn } from '@/lib/utils';

import { taskShareApi } from '../api/tasksApi';
import {
  formatStatusForDisplay,
  formatTaskDueDisplay,
  TASK_PRIORITY_COLORS,
  TASK_STATUS_COLORS,
  type PublicTask,
} from '../types/tasks';

interface PublicTaskViewProps {
  token: string;
}

export function PublicTaskView({ token }: PublicTaskViewProps) {
  const [task, setTask] = useState<PublicTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const publicTask = await dedupeInFlightByKey(`public-task:${token}`, () =>
          taskShareApi.getPublicTask(token),
        );
        if (!cancelled) {
          setTask(publicTask);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load task');
          setTask(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <div className="text-gray-600">Loading task…</div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Task not available</h2>
            <p className="text-gray-600 mb-4">
              {error || 'This task could not be found or the share link has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const title = (task.title || '').trim() || '—';
  const dueDisplay = formatTaskDueDisplay(task.dueDate, task.status);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-muted/30">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Shared task · link expires {formatDateTime(task.shareValidUntil)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn(BADGE_CHIP_CLASS, TASK_STATUS_COLORS[task.status] ?? '')}
              >
                {formatStatusForDisplay(task.status)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(BADGE_CHIP_CLASS, TASK_PRIORITY_COLORS[task.priority] ?? '')}
              >
                {task.priority}
              </Badge>
              {dueDisplay ? (
                <Badge
                  variant="outline"
                  className={cn(BADGE_CHIP_CLASS, dueDisplay.badgeClassName)}
                >
                  {dueDisplay.text}
                </Badge>
              ) : task.dueDate ? (
                <Badge
                  variant="outline"
                  className={cn(BADGE_CHIP_CLASS, DUE_DATE_BADGE_COLORS.muted)}
                >
                  {new Date(task.dueDate).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
            <RichTextContent content={task.content} mentions={task.mentions || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
