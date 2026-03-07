import {
  CheckSquare,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  Upload,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { ImportWizard } from '@/core/ui/ImportWizard';
import { exportItems } from '@/core/utils/exportUtils';
import type { ImportSchema } from '@/core/utils/importUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, formatStatusForDisplay } from '../types/tasks';
import { getTasksExportConfig } from '../utils/taskExportConfig';

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const TASK_VIEW_MODE_KEY = 'homebase-tasks-view-mode';

const TASK_IMPORT_SCHEMA: ImportSchema = {
  fields: [
    { key: 'title', label: 'Title', required: true },
    { key: 'content', label: 'Content', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'priority', label: 'Priority', required: false },
  ],
};

export const TaskList: React.FC = () => {
  const { tasks, openTaskForView, deleteTask, deleteTasks, importTasks } = useTasks();
  const { contacts } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const s = localStorage.getItem(TASK_VIEW_MODE_KEY);
      return s === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  const [showImportWizard, setShowImportWizard] = useState(false);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(TASK_VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search tasks..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="h-4 w-4" />
              List
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowImportWizard(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing]);

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

  const selectedCount = selectedIds.size;
  const allSelected = sortedTasks.length > 0 && sortedTasks.every((t) => selectedIds.has(t.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTasks.map((t) => t.id)));
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    try {
      await deleteTasks(ids);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedIds.size === 0) {
      alert('Please select tasks to export');
      return;
    }
    const selectedTasks = tasks.filter((t) => selectedIds.has(t.id));
    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}`;
    exportItems({
      items: selectedTasks,
      format: 'csv',
      config: getTasksExportConfig(contacts ?? []),
      filename,
      title: 'Tasks Export',
    });
  };

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) {
      alert('Please select tasks to export');
      return;
    }
    const selectedTasks = tasks.filter((t) => selectedIds.has(t.id));
    const filename = `tasks-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: selectedTasks,
      format: 'pdf',
      config: getTasksExportConfig(contacts ?? []),
      filename,
      title: 'Tasks Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      await (result as Promise<void>).catch((err) => {
        console.error('PDF export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
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
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          {
            label: 'Export PDF',
            icon: FileText,
            onClick: handleExportPDF,
            variant: 'default',
          },
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setBulkDeleteOpen(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none">
        {sortedTasks.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No tasks found matching your search.'
              : 'No tasks yet. Click "Add Task" to get started.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedTasks.map((task) => {
              const taskIsSelected = selectedIds.has(task.id);
              const assignedContact = task.assignedTo
                ? contacts.find((c: any) => String(c.id) === String(task.assignedTo))
                : null;
              return (
                <Card
                  key={task.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[160px] border-transparent',
                    taskIsSelected
                      ? 'plugin-tasks bg-plugin-subtle ring-1 border-plugin-subtle ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:plugin-tasks hover:shadow-md',
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    e.preventDefault();
                    handleOpenForView(task);
                  }}
                  data-list-item={JSON.stringify(task)}
                  data-plugin-name="tasks"
                  role="button"
                  aria-label={`Open task ${task.title}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={taskIsSelected}
                        onChange={() => toggleSelectOne(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                      />
                      <h3 className="font-semibold text-base line-clamp-1">{task.title}</h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge className={TASK_STATUS_COLORS[task.status]}>
                      {formatStatusForDisplay(task.status)}
                    </Badge>
                    <Badge className={TASK_PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                  </div>
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      {task.dueDate && (
                        <div className={formatDueDate(task.dueDate)?.className || ''}>
                          {formatDueDate(task.dueDate)?.text}
                        </div>
                      )}
                      {assignedContact && (
                        <div className="plugin-contacts text-plugin font-medium truncate">
                          Assigned: {assignedContact.companyName}
                        </div>
                      )}
                      <div>Updated {new Date(task.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
                  />
                </TableHead>
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
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
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
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelectOne(task.id)}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Select ${task.title}`}
                    />
                  </TableCell>
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

      <ImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImport={importTasks}
        schema={TASK_IMPORT_SCHEMA}
        title="Import Tasks"
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteConfirm.taskTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />

      <BulkDeleteModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        itemCount={selectedCount}
        itemLabel="tasks"
        isLoading={bulkDeleting}
      />
    </div>
  );
};
