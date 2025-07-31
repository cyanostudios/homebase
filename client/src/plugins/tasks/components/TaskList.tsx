import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, CheckSquare, ChevronUp, ChevronDown, Search, Copy } from 'lucide-react';
import { useTasks } from '../hooks/useTasks';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from '../types/tasks';

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const TaskList: React.FC = () => {
  const { tasks, openTaskPanel, openTaskForEdit, openTaskForView, deleteTask, duplicateTask } = useTasks();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: '',
    taskTitle: ''
  });
  
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isMobileView, setIsMobileView] = useState(false);

  // Check screen size for responsive view
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768); // md breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedTasks = useMemo(() => {
    const filtered = tasks.filter(task => 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.priority.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.mentions && task.mentions.some((mention: any) => 
        mention.contactName.toLowerCase().includes(searchTerm.toLowerCase())
      ))
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
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        aValue = priorityOrder[a.priority].toString();
        bValue = priorityOrder[b.priority].toString();
      } else if (sortField === 'dueDate') {
        aValue = a.dueDate;
        bValue = b.dueDate;
      } else if (sortField === 'createdAt') {
        aValue = a.createdAt;
        bValue = b.createdAt;
      } else { // updatedAt
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
        // Handle null dates by putting them at the end
        if (!aValue && !bValue) return 0;
        if (!aValue) return sortOrder === 'asc' ? 1 : -1;
        if (!bValue) return sortOrder === 'asc' ? -1 : 1;
        
        if (sortOrder === 'asc') {
          return (aValue as Date).getTime() - (bValue as Date).getTime();
        } else {
          return (bValue as Date).getTime() - (aValue as Date).getTime();
        }
      }
    });
  }, [tasks, searchTerm, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteConfirm({
      isOpen: true,
      taskId: id,
      taskTitle: title
    });
  };

  const confirmDelete = () => {
    deleteTask(deleteConfirm.taskId);
    setDeleteConfirm({
      isOpen: false,
      taskId: '',
      taskTitle: ''
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      taskId: '',
      taskTitle: ''
    });
  };

  // Handle duplicate with event prevention
  const handleDuplicate = async (e: React.MouseEvent, task: any) => {
    e.stopPropagation(); // Prevent row click
    try {
      await duplicateTask(task);
    } catch (error) {
      console.error('Failed to duplicate task:', error);
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const formatDueDate = (dueDate: Date | null) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} days overdue`, className: 'text-red-600 font-medium' };
    } else if (diffDays === 0) {
      return { text: 'Due today', className: 'text-orange-600 font-medium' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', className: 'text-yellow-600' };
    } else {
      return { text: due.toLocaleDateString(), className: 'text-gray-600' };
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Tasks</Heading>
          <Text variant="caption">Manage your tasks and projects</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Search Controls */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button
            onClick={() => openTaskPanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add Task
          </Button>
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    Title
                    <SortIcon field="title" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center gap-1">
                    Priority
                    <SortIcon field="priority" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-1">
                    Due Date
                    <SortIcon field="dueDate" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mentions
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center gap-1">
                    Updated
                    <SortIcon field="updatedAt" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm ? 'No tasks found matching your search.' : 'No tasks yet. Click "Add Task" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedTasks.map((task, idx) => (
                  <tr 
                    key={task.id} 
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                    tabIndex={0}
                    data-list-item={JSON.stringify(task)}
                    data-plugin-name="tasks"
                    role="button"
                    aria-label={`Open task ${task.title}`}
                    onClick={() => openTaskForView(task)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TASK_STATUS_COLORS[task.status]}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TASK_PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.dueDate ? (
                        <div className={`text-sm ${formatDueDate(task.dueDate)?.className}`}>
                          {formatDueDate(task.dueDate)?.text}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">No due date</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.mentions && task.mentions.length > 0 && (
                        <div className="flex flex-col items-start gap-0.5">
                          {task.mentions.slice(0, 2).map((mention: any, index: number) => (
                            <span key={index} className="text-xs text-blue-600">
                              @{mention.contactName}
                            </span>
                          ))}
                          {task.mentions.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{task.mentions.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskForView(task);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          onClick={(e) => handleDuplicate(e, task)}
                          title="Duplicate task"
                        >
                          Duplicate
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={Edit}
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskForEdit(task);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Mobile Card View */
          <div className="divide-y divide-gray-200">
            {sortedTasks.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchTerm ? 'No tasks found matching your search.' : 'No tasks yet. Click "Add Task" to get started.'}
              </div>
            ) : (
              sortedTasks.map((task) => (
                <div key={task.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <CheckSquare className="w-4 h-4 text-blue-500" />
                      <div className="text-xs text-gray-500">
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TASK_STATUS_COLORS[task.status]}`}>
                            {task.status}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TASK_PRIORITY_COLORS[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      
                      {/* Task content and details */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">
                          {truncateContent(task.content, 80)}
                        </div>
                        {task.dueDate && (
                          <div className={`text-xs ${formatDueDate(task.dueDate)?.className}`}>
                            📅 {formatDueDate(task.dueDate)?.text}
                          </div>
                        )}
                        {/* Mobile @mention indicator */}
                        {task.mentions && task.mentions.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {task.mentions.slice(0, 2).map((mention: any, index: number) => (
                              <span key={index} className="text-xs text-blue-600">
                                @{mention.contactName}
                              </span>
                            ))}
                            {task.mentions.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{task.mentions.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Action buttons in mobile */}
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Eye}
                        onClick={() => openTaskForView(task)}
                        className="h-8 px-3"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
};