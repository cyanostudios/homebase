import { CheckSquare } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { GroupedList } from '@/core/ui/GroupedList';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, formatStatusForDisplay } from '../types/tasks';

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const TaskList: React.FC = () => {
  const { tasks, openTaskForView, deleteTask } = useTasks();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: '',
    taskTitle: '',
  });

  const [sortField] = useState<SortField>('updatedAt');
  const [sortOrder] = useState<SortOrder>('desc');

  const sortedTasks = useMemo(() => {
    const filtered = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.priority.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.mentions &&
          task.mentions.some((mention: any) =>
            mention.contactName.toLowerCase().includes(searchTerm.toLowerCase()),
          )),
    );

    return [...filtered].sort((a, b) => {
      let aValue: string | Date | null;
      let bValue: string | Date | null;

      if (sortField === 'title') {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      } else if (sortField === 'status') {
        aValue = a.status;
        bValue = b.status;
      } else if (sortField === 'priority') {
        const priorityOrder = { High: 3, Medium: 2, Low: 1 };
        aValue = priorityOrder[a.priority].toString();
        bValue = priorityOrder[b.priority].toString();
      } else if (sortField === 'dueDate') {
        aValue = a.dueDate;
        bValue = b.dueDate;
      } else if (sortField === 'createdAt') {
        aValue = a.createdAt;
        bValue = b.createdAt;
      } else {
        aValue = a.updatedAt;
        bValue = b.updatedAt;
      }

      if (sortField === 'title' || sortField === 'status' || sortField === 'priority') {
        if (sortOrder === 'asc') {
          return (aValue as string).localeCompare(bValue as string);
        } else {
          return (bValue as string).localeCompare(aValue as string);
        }
      } else {
        if (!aValue && !bValue) {
          return 0;
        }
        if (!aValue) {
          return sortOrder === 'asc' ? 1 : -1;
        }
        if (!bValue) {
          return sortOrder === 'asc' ? -1 : 1;
        }

        if (sortOrder === 'asc') {
          return (aValue as Date).getTime() - (bValue as Date).getTime();
        } else {
          return (bValue as Date).getTime() - (aValue as Date).getTime();
        }
      }
    });
  }, [tasks, searchTerm, sortField, sortOrder]);

  const _handleDelete = (id: string, title: string) => {
    setDeleteConfirm({
      isOpen: true,
      taskId: id,
      taskTitle: title,
    });
  };

  const confirmDelete = () => {
    deleteTask(deleteConfirm.taskId);
    setDeleteConfirm({
      isOpen: false,
      taskId: '',
      taskTitle: '',
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      taskId: '',
      taskTitle: '',
    });
  };

  const formatDueDate = (dueDate: Date | null) => {
    if (!dueDate) {
      return null;
    }
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `${Math.abs(diffDays)} days overdue`,
        className: 'text-destructive font-medium',
      };
    } else if (diffDays === 0) {
      return { text: 'Due today', className: 'text-orange-600 dark:text-orange-400 font-medium' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', className: 'text-yellow-600 dark:text-yellow-400' };
    } else {
      return { text: due.toLocaleDateString(), className: 'text-muted-foreground' };
    }
  };

  // Protected navigation handlers
  const handleOpenForView = (task: any) => {
    attemptNavigation(() => {
      openTaskForView(task);
    });
  };

  return (
    <div className="space-y-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search tasks..."
      />

      <Card className="shadow-none">
        <GroupedList
          items={sortedTasks}
          groupConfig={{
            getGroupKey: (task) => (task.priority || 'Medium').toLowerCase(),
            getGroupLabel: (groupKey) => {
              const priorityLabels: Record<string, string> = {
                high: 'High Priority',
                medium: 'Medium Priority',
                low: 'Low Priority',
              };
              return (
                priorityLabels[groupKey] ||
                `${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)} Priority`
              );
            },
            getGroupOrder: (groupKey) => {
              // High first, then Medium, then Low
              const order: Record<string, number> = {
                high: 0,
                medium: 1,
                low: 2,
              };
              return order[groupKey.toLowerCase()] ?? 1;
            },
            defaultOpen: true,
          }}
          emptyMessage={
            searchTerm
              ? 'No tasks found matching your search.'
              : 'No tasks yet. Click "Add Task" to get started.'
          }
          renderItem={(task, idx) => (
            <div
              key={task.id}
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
              tabIndex={0}
              data-list-item={JSON.stringify(task)}
              data-plugin-name="tasks"
              role="button"
              aria-label={`Open task ${task.title}`}
              onClick={(e) => {
                e.preventDefault();
                handleOpenForView(task);
              }}
            >
              {/* Rad 1: Icon + Title + Badges */}
              <div className="flex items-center gap-2 mb-1.5">
                <CheckSquare className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                  {task.title}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge className={TASK_STATUS_COLORS[task.status]}>
                    {formatStatusForDisplay(task.status)}
                  </Badge>
                  <Badge className={TASK_PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                </div>
              </div>

              {/* Rad 2: Due Date + Mentions */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {task.dueDate ? (
                  <div
                    className={`flex items-center gap-1.5 ${formatDueDate(task.dueDate)?.className || ''}`}
                  >
                    <span>📅 {formatDueDate(task.dueDate)?.text}</span>
                  </div>
                ) : (
                  <span>No due date</span>
                )}
                {task.mentions && task.mentions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span>•</span>
                    <span>
                      @{task.mentions[0].contactName}
                      {task.mentions.length > 1 && ` +${task.mentions.length - 1}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Rad 3: Updated Date (optional) */}
              <div className="mt-1 text-xs text-muted-foreground">
                Updated {new Date(task.updatedAt).toLocaleDateString()}
              </div>
            </div>
          )}
        />
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteConfirm.taskTitle}"? This action cannot undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
