import React, { useState, useEffect } from 'react';
import { CheckSquare, User, Copy, Calendar, AlertCircle, Flag } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { MentionContent } from './MentionContent';
import { TaskStatusButtons } from './TaskStatusButtons';
import { TaskPriorityButtons } from './TaskPriorityButtons';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useTasks } from '../hooks/useTasks';
import { useApp } from '@/core/api/AppContext';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS, formatStatusForDisplay } from '../types/tasks';

interface TaskViewProps {
  task: any;
}

export const TaskView: React.FC<TaskViewProps> = ({ task }) => {
  // Use ContactContext for opening contacts
  const { openContactForView } = useContacts();
  
  // Use TaskContext to close task panel when navigating
  const { closeTaskPanel, duplicateTask, saveTask } = useTasks();
  
  // Get contacts from AppContext for cross-plugin references
  const { refreshData, contacts } = useApp();

  // FIXED: Move hooks outside of map - fetch ALL contact data at component level
  const [mentionContactsData, setMentionContactsData] = useState<{[key: string]: any}>({});

  // FIXED: Single useEffect to fetch all mentioned contacts data
  useEffect(() => {
    const fetchMentionContactsData = async () => {
      if (!task.mentions || task.mentions.length === 0) return;
      
      try {
        const response = await fetch('/api/contacts', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const contactsData = await response.json();
          const mentionContactsMap: {[key: string]: any} = {};
          
          task.mentions.forEach((mention: any) => {
            const contact = contactsData.find((c: any) => c.id === mention.contactId);
            if (contact) {
              mentionContactsMap[mention.contactId] = contact;
            }
          });
          
          setMentionContactsData(mentionContactsMap);
        }
      } catch (error) {
        console.error('Failed to load contact data:', error);
      }
    };
    
    fetchMentionContactsData();
  }, [task.mentions]);

  const handleContactClick = async (contactId: string) => {
    // Refresh data to get latest contacts
    await refreshData();
    
    // Close task panel
    closeTaskPanel();
    
    // Open contact
    openContactForView(contactId);
  };

  const handleDuplicateTask = () => {
    duplicateTask(task);
  };

  // Format due date
  const formatDueDate = (dueDate: any) => {
    if (!dueDate) return null;
    
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const dateString = due.toLocaleDateString();
    
    if (diffDays < 0) {
      return {
        text: `${dateString} (${Math.abs(diffDays)} days overdue)`,
        className: 'text-red-600 font-medium',
        icon: AlertCircle,
        iconClass: 'text-red-500'
      };
    } else if (diffDays === 0) {
      return {
        text: `${dateString} (Due today)`,
        className: 'text-orange-600 font-medium',
        icon: AlertCircle,
        iconClass: 'text-orange-500'
      };
    } else if (diffDays <= 3) {
      return {
        text: `${dateString} (Due in ${diffDays} day${diffDays === 1 ? '' : 's'})`,
        className: 'text-yellow-600 font-medium',
        icon: Calendar,
        iconClass: 'text-yellow-500'
      };
    } else {
      return {
        text: dateString,
        className: 'text-gray-900',
        icon: Calendar,
        iconClass: 'text-gray-500'
      };
    }
  };

  // Get assigned contact details
  const getAssignedContact = () => {
    if (!task.assignedTo) return null;
    
    const contact = contacts.find((c: any) => c.id === task.assignedTo);
    if (!contact) return null;
    
    return {
      id: contact.id,
      companyName: contact.companyName,
      orgPersonNumber: contact.orgPersonNumber
    };
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === task.status) return;
    
    try {
      const updatedData = {
        title: task.title,
        content: task.content,
        mentions: task.mentions,
        status: newStatus,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo,
      };

      const success = await saveTask(updatedData);
      
      if (!success) {
        alert('Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  // Handle priority change
  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === task.priority) return;
    
    try {
      const updatedData = {
        title: task.title,
        content: task.content,
        mentions: task.mentions,
        status: task.status,
        priority: newPriority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo,
      };

      const success = await saveTask(updatedData);
      
      if (!success) {
        alert('Failed to update priority. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update priority:', error);
      alert('Failed to update priority. Please try again.');
    }
  };

  const assignedContact = getAssignedContact();
  const dueDateInfo = formatDueDate(task.dueDate);

  if (!task) return null;

  return (
    <div className="space-y-4">
      {/* Task Scheduling Information */}
      {(task.dueDate || assignedContact) && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Scheduling</Heading>
          <div className="space-y-3">
            {task.dueDate && dueDateInfo && (
              <div className="flex items-center gap-2">
                <dueDateInfo.icon className={`w-4 h-4 ${dueDateInfo.iconClass}`} />
                <span className="text-xs text-gray-500">Due:</span>
                <span className={`text-sm ${dueDateInfo.className}`}>
                  {dueDateInfo.text}
                </span>
              </div>
            )}
            
            {assignedContact && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500">Assigned to:</span>
                <button
                  onClick={() => handleContactClick(assignedContact.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {assignedContact.companyName}
                  {assignedContact.orgPersonNumber ? ` • ${assignedContact.orgPersonNumber}` : ''}
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Task Content */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Content</Heading>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-900 whitespace-pre-wrap">
            <MentionContent content={task.content} mentions={task.mentions} />
          </div>
        </div>
      </Card>

      {/* Cross-references */}
      {task.mentions && task.mentions.length > 0 && (
        <>
          <hr className="border-gray-100" />
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Referenced Contacts</Heading>
            <div className="space-y-3">
              {task.mentions.map((mention: any, index: number) => {
                const contactData = mentionContactsData[mention.contactId];
                
                return (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{mention.contactName}</span>
                      {mention.companyName && mention.companyName !== mention.contactName && (
                        <span className="text-gray-500 ml-2">• {mention.companyName}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => contactData ? handleContactClick(mention.contactId) : null}
                      disabled={!contactData}
                      className={`ml-3 flex-shrink-0 ${
                        contactData 
                          ? 'text-blue-700 hover:text-blue-800' 
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {contactData ? 'View Contact' : 'Deleted'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <hr className="border-gray-100" />
        </>
      )}

      {/* Quick Actions */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</Heading>
        
        {/* Status Actions */}
        <TaskStatusButtons 
          task={task} 
          onStatusChange={handleStatusChange} 
        />

        {/* Priority Actions */}
        <TaskPriorityButtons 
          task={task} 
          onPriorityChange={handlePriorityChange} 
        />
        
        {/* Task Actions */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Task Actions</div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              icon={Copy}
              onClick={handleDuplicateTask}
            >
              Duplicate Task
            </Button>
          </div>
        </div>
      </Card>

      <hr className="border-gray-100" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Task Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(task.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(task.updatedAt).toLocaleDateString()}</div>
          </div>
          {task.createdFromNote && (
            <div className="sm:col-span-2">
              <div className="text-xs text-gray-500">Created from Note</div>
              <div className="text-sm text-blue-600">Note ID: {task.createdFromNote}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};