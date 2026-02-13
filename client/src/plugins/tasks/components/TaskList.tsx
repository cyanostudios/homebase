import {
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect } from 'react';

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
import { exportItems } from '@/core/utils/exportUtils';
import { getTasksExportConfig } from '../utils/taskExportConfig';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, formatStatusForDisplay } from '../types/tasks';

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export const TaskList: React.FC = () => {
  const {
    tasks,
    openTaskForView,
    deleteTask,
    deleteTasks,
    selectedTaskIds,
    toggleTaskSelected,
    selectAllTasks,
    clearTaskSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedTaskId,
  } = useTasks();
  const { contacts } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
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
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('homebase:tasks:viewMode');
    return (saved as ViewMode) || 'list';
  });

  // Save viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('homebase:tasks:viewMode', viewMode);
  }, [viewMode]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Visible task IDs for selection
  const visibleTaskIds = useMemo(() => sortedTasks.map((task) => String(task.id)), [sortedTasks]);

  // Selection helpers
  const allVisibleSelected = useMemo(
    () => visibleTaskIds.length > 0 && visibleTaskIds.every((id) => isSelected(id)),
    [visibleTaskIds, isSelected],
  );

  const someVisibleSelected = useMemo(
    () => visibleTaskIds.some((id) => isSelected(id)),
    [visibleTaskIds, isSelected],
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearTaskSelection();
    } else {
      selectAllTasks(visibleTaskIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      await deleteTasks(selectedTaskIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

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

  const handleExportCSV = () => {
    if (selectedTaskIds.length === 0) {
      alert('Please select tasks to export');
      return;
    }
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(String(task.id)));
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
    if (selectedTaskIds.length === 0) {
      alert('Please select tasks to export');
      return;
    }
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(String(task.id)));
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

  // Set header trailing (search + view mode toggle) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search tasks..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="h-9 w-9"
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="h-9 w-9"
              title="List view"
            >
              <ListIcon className="w-4 h-4" />
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing]);

  // Protected navigation handlers
  const handleOpenForView = (task: any) => {
    attemptNavigation(() => {
      openTaskForView(task);
    });
  };

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearTaskSelection}
        actions={[
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          { label: 'Export PDF', icon: FileText, onClick: handleExportPDF, variant: 'default' },
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setShowBulkDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none border-none bg-transparent">
        {sortedTasks.length === 0 ? (
          <Card className="shadow-none">
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm
                ? 'No tasks found matching your search.'
                : 'No tasks yet. Click "Add Task" to get started.'}
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedTasks.map((task) => {
              const taskIsSelected = isSelected(task.id);
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
                    recentlyDuplicatedTaskId === String(task.id) &&
                      'bg-green-50 dark:bg-green-950/30',
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
                        onChange={() => toggleTaskSelected(task.id)}
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
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t">
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
        ) : isMobile ? (
          // Mobile: Card layout
          <Card className="shadow-none">
            <div className="space-y-2 p-4">
              {sortedTasks.map((task) => {
                const taskIsSelected = isSelected(task.id);
                const assignedContact = task.assignedTo
                  ? contacts.find((c: any) => String(c.id) === String(task.assignedTo))
                  : null;
                return (
                  <Card
                    key={task.id}
                    className={cn(
                      'p-4 cursor-pointer hover:bg-accent transition-colors',
                      recentlyDuplicatedTaskId === String(task.id) &&
                        'bg-green-50 dark:bg-green-950/30',
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={taskIsSelected}
                            onChange={() => toggleTaskSelected(task.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                            aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                          />
                          <h3 className="font-semibold text-base truncate">{task.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={TASK_STATUS_COLORS[task.status]}>
                            {formatStatusForDisplay(task.status)}
                          </Badge>
                          <Badge className={TASK_PRIORITY_COLORS[task.priority]}>
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm">
                          {task.dueDate && (
                            <div className={formatDueDate(task.dueDate)?.className || ''}>
                              {formatDueDate(task.dueDate)?.text}
                            </div>
                          )}
                          {assignedContact && (
                            <div className="plugin-contacts text-plugin">
                              Assigned: {assignedContact.companyName}
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            Updated {new Date(task.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        ) : (
          // Desktop: Table layout
          <Card className="shadow-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleHeaderCheckboxChange}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={allVisibleSelected ? 'Deselect all tasks' : 'Select all tasks'}
                    />
                  </TableHead>
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
                {sortedTasks.map((task) => {
                  const taskIsSelected = isSelected(task.id);
                  return (
                    <TableRow
                      key={task.id}
                      className={cn(
                        'cursor-pointer hover:bg-accent',
                        recentlyDuplicatedTaskId === String(task.id) &&
                          'bg-green-50 dark:bg-green-950/30',
                      )}
                      tabIndex={0}
                      data-list-item={JSON.stringify(task)}
                      data-plugin-name="tasks"
                      role="button"
                      aria-label={`Open task ${task.title}`}
                      onClick={(e) => {
                        // Don't open if clicking checkbox
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        e.preventDefault();
                        handleOpenForView(task);
                      }}
                    >
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={taskIsSelected}
                          onChange={() => toggleTaskSelected(task.id)}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={taskIsSelected ? 'Unselect task' : 'Select task'}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{task.title}</TableCell>
                      <TableCell>
                        <Badge className={TASK_STATUS_COLORS[task.status]}>
                          {formatStatusForDisplay(task.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={TASK_PRIORITY_COLORS[task.priority]}>
                          {task.priority}
                        </Badge>
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
                              <div className="text-sm plugin-contacts text-plugin">
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
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </Card>

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="tasks"
        isLoading={deleting}
      />

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
