import { CheckSquare, ArrowUp, ArrowDown } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, formatStatusForDisplay } from '../types/tasks';

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const TaskList: React.FC = () => {
  const { tasks, openTaskForView, deleteTask } = useTasks();
  const { contacts } = useApp();
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

  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.priority.toLowerCase().includes(searchTerm.toLowerCase());

      // Search in assigned contact
      if (task.assignedTo && contacts.length > 0) {
        const assignedContact = contacts.find((c: any) => {
          const contactId = String(c.id);
          const assignedId = String(task.assignedTo);
          return contactId === assignedId;
        });
        if (
          assignedContact &&
          assignedContact.companyName.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return true;
        }
      }

      return matchesSearch;
    });

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
  }, [tasks, searchTerm, sortField, sortOrder, contacts]);

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
        {sortedTasks.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No tasks found matching your search.'
              : 'No tasks yet. Click "Add Task" to get started.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    <span>Title</span>
                    {sortField === 'title' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    <span>Status</span>
                    {sortField === 'status' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center gap-2">
                    <span>Priority</span>
                    {sortField === 'priority' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-2">
                    <span>Due Date</span>
                    {sortField === 'dueDate' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center gap-2">
                    <span>Updated</span>
                    {sortField === 'updatedAt' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-accent"
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
                  <TableCell className="w-12">
                    <CheckSquare className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  </TableCell>
                  <TableCell className="font-semibold">{task.title}</TableCell>
                  <TableCell>
                    <Badge className={TASK_STATUS_COLORS[task.status]}>
                      {formatStatusForDisplay(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={TASK_PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.dueDate ? (
                      <div className={formatDueDate(task.dueDate)?.className || ''}>
                        {formatDueDate(task.dueDate)?.text}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assignedTo ? (
                      (() => {
                        const assignedContact = contacts.find((c: any) => {
                          const contactId = String(c.id);
                          const assignedId = String(task.assignedTo);
                          return contactId === assignedId;
                        });
                        return assignedContact ? (
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            {assignedContact.companyName}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
