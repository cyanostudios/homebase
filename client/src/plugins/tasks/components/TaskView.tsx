import React, { useState, useEffect } from 'react';
import { CheckSquare, User, Copy, Calendar, AlertCircle, Flag } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { MentionContent } from './MentionContent';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useTasks } from '../hooks/useTasks';
import { useApp } from '@/core/api/AppContext';
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from '../types/tasks';

interface TaskViewProps {
  task: any;
}

export const TaskView: React.FC<TaskViewProps> = ({ task }) => {
  // Use ContactContext for opening contacts
  const { openContactForView } = useContacts();
  
  // Use TaskContext to close task panel when navigating
  const { closeTaskPanel, duplicateTask } = useTasks();
  
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
    
    // Get contact data via fetch since AppContext has the data but doesn't expose it directly
    try {
      const response = await fetch('/api/contacts', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const contactsData = await response.json();
        const contact = contactsData.find((c: any) => c.id === contactId);
        
        if (contact) {
          // Transform the contact data to match expected format
          const transformedContact = {
            ...contact,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          };
          
          closeTaskPanel(); // Close task panel first
          openContactForView(transformedContact); // Then open contact panel with full data
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
    }
  };

  const handleDuplicateTask = async () => {
    try {
      await duplicateTask(task);
    } catch (error) {
      console.error('Failed to duplicate task:', error);
      alert('Failed to duplicate task. Please try again.');
    }
  };

  const formatDueDate = (dueDate: Date | null) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        text: `${Math.abs(diffDays)} days overdue`, 
        className: 'text-red-600 font-medium',
        icon: AlertCircle,
        iconClass: 'text-red-500'
      };
    } else if (diffDays === 0) {
      return { 
        text: 'Due today', 
        className: 'text-orange-600 font-medium',
        icon: AlertCircle,
        iconClass: 'text-orange-500'
      };
    } else if (diffDays === 1) {
      return { 
        text: 'Due tomorrow', 
        className: 'text-yellow-600',
        icon: Calendar,
        iconClass: 'text-yellow-500'
      };
    } else {
      return { 
        text: due.toLocaleDateString(), 
        className: 'text-gray-600',
        icon: Calendar,
        iconClass: 'text-gray-500'
      };
    }
  };

  // Get assigned contact information
  const getAssignedContact = () => {
    if (!task.assignedTo) return null;
    return contacts.find(contact => contact.id === task.assignedTo);
  };

  // FIXED: Helper function to get display text without hooks
  const getDisplayText = (mention: any) => {
    const contactData = mentionContactsData[mention.contactId];
    
    if (!contactData) {
      // Contact was deleted or not found
      const contactNumber = `#${mention.contactId}`;
      const name = mention.contactName;
      return `${contactNumber} • ${name} (deleted contact)`;
    }
    
    const contactNumber = `#${contactData.contactNumber || contactData.id}`;
    const name = mention.contactName;
    const orgPersonNumber = contactData.organizationNumber || contactData.personalNumber || '';
    
    return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
  };

  const assignedContact = getAssignedContact();
  const dueDateInfo = formatDueDate(task.dueDate);

  if (!task) return null;

  return (
    <div className="space-y-4">
      {/* Task Status and Priority */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Task Status</Heading>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TASK_STATUS_COLORS[task.status]}`}>
              {task.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Priority:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TASK_PRIORITY_COLORS[task.priority]}`}>
              <Flag className="w-3 h-3 mr-1" />
              {task.priority}
            </span>
          </div>
        </div>
      </Card>

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
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Task Content with clickable mentions */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Description</Heading>
        <div className="prose prose-sm max-w-none text-sm">
          <MentionContent content={task.content} mentions={task.mentions || []} />
        </div>
      </Card>

      <hr className="border-gray-100" />

      {/* Mentioned Contacts - FIXED: No hooks in map loop */}
      {task.mentions && task.mentions.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Mentioned Contacts</Heading>
            <div className="space-y-2">
              {task.mentions.map((mention: any, index: number) => {
                const contactData = mentionContactsData[mention.contactId];

                return (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                    contactData 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <User className={`w-4 h-4 flex-shrink-0 ${
                        contactData ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">
                          {getDisplayText(mention)}
                        </span>
                        {mention.companyName && mention.companyName !== mention.contactName && contactData && (
                          <div className="text-xs text-gray-500">({mention.companyName})</div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
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