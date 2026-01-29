import { StickyNote, Calculator, CheckSquare } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';

interface ContactViewProps {
  contact: any;
}

export const ContactView: React.FC<ContactViewProps> = ({ contact }) => {
  // Use AppContext only for cross-plugin data fetching
  const {
    getNotesForContact,
    getEstimatesForContact,
    getTasksForContact,
    getTasksWithMentionsForContact,
  } = useApp();

  // Use NoteContext for opening notes
  const { openNoteForView } = useNotes();

  // Use EstimateContext for opening estimates
  const { openEstimateForView } = useEstimates();

  // Use TaskContext for opening tasks
  const { openTaskForView } = useTasks();

  // Use ContactContext to close contact panel when navigating
  const { closeContactPanel } = useContacts();

  // State for cross-plugin data
  const [mentionedInNotes, setMentionedInNotes] = useState<any[]>([]);
  const [relatedEstimates, setRelatedEstimates] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [mentionedInTasks, setMentionedInTasks] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingTaskMentions, setLoadingTaskMentions] = useState(false);

  // Load cross-plugin data when contact changes
  useEffect(() => {
    if (!contact?.id) {
      return;
    }

    // Load notes (async)
    const loadNotes = async () => {
      setLoadingNotes(true);
      try {
        const notes = await getNotesForContact(contact.id);
        setMentionedInNotes(notes);
      } catch (error) {
        console.error('Failed to load notes for contact:', error);
        setMentionedInNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    };

    // Load estimates (async)
    const loadEstimates = async () => {
      setLoadingEstimates(true);
      try {
        const estimates = await getEstimatesForContact(contact.id);
        setRelatedEstimates(estimates);
      } catch (error) {
        console.error('Failed to load estimates for contact:', error);
        setRelatedEstimates([]);
      } finally {
        setLoadingEstimates(false);
      }
    };

    // Load tasks (async) - assigned to contact
    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const tasks = await getTasksForContact(contact.id);
        setAssignedTasks(tasks);
      } catch (error) {
        console.error('Failed to load tasks for contact:', error);
        setAssignedTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    // Load task mentions (async) - contact mentioned in tasks
    const loadTaskMentions = async () => {
      setLoadingTaskMentions(true);
      try {
        const tasks = await getTasksWithMentionsForContact(contact.id);
        setMentionedInTasks(tasks);
      } catch (error) {
        console.error('Failed to load task mentions for contact:', error);
        setMentionedInTasks([]);
      } finally {
        setLoadingTaskMentions(false);
      }
    };

    loadNotes();
    loadEstimates();
    loadTasks();
    loadTaskMentions();
  }, [
    contact?.id,
    getNotesForContact,
    getEstimatesForContact,
    getTasksForContact,
    getTasksWithMentionsForContact,
  ]);

  if (!contact) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Contact Details */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Contact Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contact.email && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">{contact.email}</div>
              </div>
            )}

            {contact.website && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Website</div>
                <a
                  href={
                    contact.website.startsWith('http')
                      ? contact.website
                      : `https://${contact.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                >
                  {contact.website}
                </a>
              </div>
            )}

            {contact.phone && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Phone 1</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">{contact.phone}</div>
              </div>
            )}

            {contact.phone2 && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Phone 2</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">{contact.phone2}</div>
              </div>
            )}
          </div>
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Addresses */}
      {contact.addresses && contact.addresses.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title="Addresses">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {contact.addresses.map((address: any, index: number) => (
                <div key={address.id || index}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {address.type}
                    </div>
                  </div>
                  <div className="ml-0 space-y-1">
                    {address.addressLine1 && (
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {address.addressLine1}
                      </div>
                    )}
                    {address.addressLine2 && (
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {address.addressLine2}
                      </div>
                    )}
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {[address.postalCode, address.city].filter(Boolean).join(' ')}
                    </div>
                    {address.region && (
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {address.region}
                      </div>
                    )}
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {address.country}
                    </div>
                    {address.email && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {address.email}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>
        </Card>
      )}

      {/* Contact Persons */}
      {contact.contactType === 'company' &&
        contact.contactPersons &&
        contact.contactPersons.length > 0 && (
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title="Contact Persons">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {contact.contactPersons.map((person: any, index: number) => (
                  <div key={person.id || index}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {person.name}
                      </div>
                      {person.title && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          • {person.title}
                        </span>
                      )}
                    </div>
                    <div className="ml-0 space-y-1">
                      {person.email && (
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {person.email}
                          </div>
                        </div>
                      )}
                      {person.phone && (
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {person.phone}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          </Card>
        )}

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Tax & Business Settings */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Business Settings">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Tax Rate</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">{contact.taxRate}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Payment Terms</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {contact.paymentTerms} days
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Currency</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">{contact.currency}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">F-Tax</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {contact.fTax === 'yes' ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>

      {/* Notes */}
      {contact.notes && (
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title="Notes">
            <div className="text-sm text-gray-900 dark:text-gray-100">{contact.notes}</div>
          </DetailSection>
        </Card>
      )}

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Cross-plugin references - Assigned Tasks */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Assigned Tasks">
          {loadingTasks ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading tasks...</div>
          ) : assignedTasks.length > 0 ? (
            <div className="space-y-2">
              {assignedTasks.map((task: any) => {
                const getStatusBadge = (status: string) => {
                  const statusColors = {
                    'not started': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
                    'in progress':
                      'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
                    Done: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
                    Canceled: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
                  };
                  const colorClass =
                    statusColors[status as keyof typeof statusColors] ||
                    statusColors['not started'];
                  return (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
                    >
                      {status}
                    </span>
                  );
                };

                const getPriorityBadge = (priority: string) => {
                  const priorityColors = {
                    Low: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
                    Medium:
                      'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
                    High: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
                  };
                  const colorClass =
                    priorityColors[priority as keyof typeof priorityColors] ||
                    priorityColors['Medium'];
                  return (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
                    >
                      {priority}
                    </span>
                  );
                };

                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CheckSquare className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {task.title}
                        </span>
                        {task.dueDate && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        closeContactPanel(); // Close contact panel first
                        openTaskForView(task); // Then open task panel
                      }}
                      className="text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 ml-3 flex-shrink-0"
                    >
                      View Task
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No tasks assigned to this contact.
            </div>
          )}
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Cross-plugin references - Mentioned in Tasks */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Mentioned in Tasks">
          {loadingTaskMentions ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading tasks...</div>
          ) : mentionedInTasks.length > 0 ? (
            <div className="space-y-2">
              {mentionedInTasks.map((task: any) => {
                const getStatusBadge = (status: string) => {
                  const statusColors = {
                    'not started': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
                    'in progress':
                      'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
                    Done: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
                    Canceled: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
                  };
                  const colorClass =
                    statusColors[status as keyof typeof statusColors] ||
                    statusColors['not started'];
                  return (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
                    >
                      {status}
                    </span>
                  );
                };

                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {task.title}
                        </span>
                        {task.dueDate && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        closeContactPanel(); // Close contact panel first
                        openTaskForView(task); // Then open task panel
                      }}
                      className="text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 ml-3 flex-shrink-0"
                    >
                      View Task
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              This contact is not mentioned in any tasks.
            </div>
          )}
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Cross-plugin references - Related Estimates */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Related Estimates">
          {loadingEstimates ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading estimates...</div>
          ) : relatedEstimates.length > 0 ? (
            <div className="space-y-2">
              {relatedEstimates.map((estimate: any) => {
                const getStatusBadge = (status: string) => {
                  const statusColors = {
                    draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
                    sent: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
                    accepted:
                      'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
                    rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
                  };
                  const colorClass =
                    statusColors[status as keyof typeof statusColors] || statusColors.draft;
                  return (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  );
                };

                return (
                  <div
                    key={estimate.id}
                    className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatDisplayNumber('estimates', estimate.estimateNumber)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(estimate.status)}
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {estimate.total?.toFixed(2)} {estimate.currency}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        closeContactPanel(); // Close contact panel first
                        openEstimateForView(estimate); // Then open estimate panel
                      }}
                      className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 ml-3 flex-shrink-0"
                    >
                      View Estimate
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No estimates found for this contact.
            </div>
          )}
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Cross-plugin references - Mentioned in Notes */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Mentioned in Notes">
          {loadingNotes ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading notes...</div>
          ) : mentionedInNotes.length > 0 ? (
            <div className="space-y-2">
              {mentionedInNotes.map((note: any) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StickyNote className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {note.title}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      closeContactPanel(); // Close contact panel first
                      openNoteForView(note); // Then open note panel
                    }}
                    className="text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 ml-3 flex-shrink-0"
                  >
                    View Note
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              This contact is not mentioned in any notes.
            </div>
          )}
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Contact Information">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">System ID</div>
              <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {formatDisplayNumber('contacts', contact.id)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(contact.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Last Updated</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(contact.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  );
};
