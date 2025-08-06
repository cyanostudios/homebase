import React, { useState, useEffect } from 'react';
import { Building, User, MapPin, Phone, Mail, Globe, CreditCard, StickyNote, Calculator, CheckSquare } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { useApp } from '@/core/api/AppContext';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useEstimates } from '@/plugins/estimates/hooks/useEstimates';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { Button } from '@/core/ui/Button';

interface ContactViewProps {
  contact: any;
}

export const ContactView: React.FC<ContactViewProps> = ({ contact }) => {
  // Use AppContext only for cross-plugin data fetching
  const { getNotesForContact, getEstimatesForContact, getTasksForContact, getTasksWithMentionsForContact } = useApp();
  
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
    if (!contact?.id) return;
    
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
  }, [contact?.id, getNotesForContact, getEstimatesForContact, getTasksForContact, getTasksWithMentionsForContact]);
  
  if (!contact) return null;

  return (
    <div className="space-y-4">
      {/* Contact Details */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Contact Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contact.email && (
            <div>
              <div className="text-xs text-gray-500">Email</div>
              <div className="text-sm text-gray-900">{contact.email}</div>
            </div>
          )}
          
          {contact.website && (
            <div>
              <div className="text-xs text-gray-500">Website</div>
              <a 
                href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {contact.website}
              </a>
            </div>
          )}
          
          {contact.phone && (
            <div>
              <div className="text-xs text-gray-500">Phone 1</div>
              <div className="text-sm text-gray-900">{contact.phone}</div>
            </div>
          )}
          
          {contact.phone2 && (
            <div>
              <div className="text-xs text-gray-500">Phone 2</div>
              <div className="text-sm text-gray-900">{contact.phone2}</div>
            </div>
          )}
        </div>
      </Card>

      <hr className="border-gray-100" />

      {/* Addresses */}
      {contact.addresses && contact.addresses.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Addresses</Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {contact.addresses.map((address: any, index: number) => (
              <div key={address.id || index}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium text-gray-900">{address.type}</div>
                </div>
                <div className="ml-0 space-y-1">
                  {address.addressLine1 && <div className="text-sm text-gray-900">{address.addressLine1}</div>}
                  {address.addressLine2 && <div className="text-sm text-gray-900">{address.addressLine2}</div>}
                  <div className="text-sm text-gray-900">
                    {[address.postalCode, address.city].filter(Boolean).join(' ')}
                  </div>
                  {address.region && <div className="text-sm text-gray-900">{address.region}</div>}
                  <div className="text-sm text-gray-900">{address.country}</div>
                  {address.email && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-600">{address.email}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contact Persons */}
      {contact.contactType === 'company' && contact.contactPersons && contact.contactPersons.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Contact Persons</Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {contact.contactPersons.map((person: any, index: number) => (
              <div key={person.id || index}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium text-gray-900">{person.name}</div>
                  {person.title && (
                    <span className="text-sm text-gray-500">• {person.title}</span>
                  )}
                </div>
                <div className="ml-0 space-y-1">
                  {person.email && (
                    <div>
                      <div className="text-sm text-gray-600">{person.email}</div>
                    </div>
                  )}
                  {person.phone && (
                    <div>
                      <div className="text-sm text-gray-600">{person.phone}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <hr className="border-gray-100" />

      {/* Tax & Business Settings */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Business Settings</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Tax Rate</div>
            <div className="text-sm text-gray-900">{contact.taxRate}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Payment Terms</div>
            <div className="text-sm text-gray-900">{contact.paymentTerms} days</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Currency</div>
            <div className="text-sm text-gray-900">{contact.currency}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">F-Tax</div>
            <div className="text-sm text-gray-900">{contact.fTax === 'yes' ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {contact.notes && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Notes</Heading>
          <div className="text-sm text-gray-900">{contact.notes}</div>
        </Card>
      )}

      <hr className="border-gray-100" />

      {/* Cross-plugin references - Assigned Tasks */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Assigned Tasks</Heading>
        {loadingTasks ? (
          <div className="text-sm text-gray-500">Loading tasks...</div>
        ) : assignedTasks.length > 0 ? (
          <div className="space-y-2">
            {assignedTasks.map((task: any) => {
              const getStatusBadge = (status: string) => {
                const statusColors = {
                  'not started': 'bg-gray-100 text-gray-800',
                  'in progress': 'bg-blue-100 text-blue-800',
                  'Done': 'bg-green-100 text-green-800',
                  'Canceled': 'bg-red-100 text-red-800',
                };
                const colorClass = statusColors[status as keyof typeof statusColors] || statusColors['not started'];
                return (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
                    {status}
                  </span>
                );
              };

              const getPriorityBadge = (priority: string) => {
                const priorityColors = {
                  'Low': 'bg-gray-100 text-gray-600',
                  'Medium': 'bg-yellow-100 text-yellow-700',
                  'High': 'bg-red-100 text-red-700',
                };
                const colorClass = priorityColors[priority as keyof typeof priorityColors] || priorityColors['Medium'];
                return (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
                    {priority}
                  </span>
                );
              };

              return (
                <div key={task.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{task.title}</span>
                      {task.dueDate && (
                        <div className="text-xs text-gray-600 mt-1">
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
                    className="text-green-700 hover:text-green-800 ml-3 flex-shrink-0"
                  >
                    View Task
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No tasks assigned to this contact.</div>
        )}
      </Card>

      <hr className="border-gray-100" />

      {/* Cross-plugin references - Mentioned in Tasks */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Mentioned in Tasks</Heading>
        {loadingTaskMentions ? (
          <div className="text-sm text-gray-500">Loading tasks...</div>
        ) : mentionedInTasks.length > 0 ? (
          <div className="space-y-2">
            {mentionedInTasks.map((task: any) => {
              const getStatusBadge = (status: string) => {
                const statusColors = {
                  'not started': 'bg-gray-100 text-gray-800',
                  'in progress': 'bg-blue-100 text-blue-800',
                  'Done': 'bg-green-100 text-green-800',
                  'Canceled': 'bg-red-100 text-red-800',
                };
                const colorClass = statusColors[status as keyof typeof statusColors] || statusColors['not started'];
                return (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
                    {status}
                  </span>
                );
              };

              return (
                <div key={task.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CheckSquare className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{task.title}</span>
                      {task.dueDate && (
                        <div className="text-xs text-gray-600 mt-1">
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
                    className="text-purple-700 hover:text-purple-800 ml-3 flex-shrink-0"
                  >
                    View Task
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">This contact is not mentioned in any tasks.</div>
        )}
      </Card>

      <hr className="border-gray-100" />

      {/* Cross-plugin references - Related Estimates */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Related Estimates</Heading>
        {loadingEstimates ? (
          <div className="text-sm text-gray-500">Loading estimates...</div>
        ) : relatedEstimates.length > 0 ? (
          <div className="space-y-2">
            {relatedEstimates.map((estimate: any) => {
              const getStatusBadge = (status: string) => {
                const statusColors = {
                  draft: 'bg-gray-100 text-gray-800',
                  sent: 'bg-blue-100 text-blue-800',
                  accepted: 'bg-green-100 text-green-800',
                  rejected: 'bg-red-100 text-red-800',
                };
                const colorClass = statusColors[status as keyof typeof statusColors] || statusColors.draft;
                return (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                );
              };

              return (
                <div key={estimate.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Calculator className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{estimate.estimateNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusBadge(estimate.status)}
                      <span className="text-sm font-medium text-gray-900">
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
                    className="text-blue-700 hover:text-blue-800 ml-3 flex-shrink-0"
                  >
                    View Estimate
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No estimates found for this contact.</div>
        )}
      </Card>

      <hr className="border-gray-100" />

      {/* Cross-plugin references - Mentioned in Notes */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Mentioned in Notes</Heading>
        {loadingNotes ? (
          <div className="text-sm text-gray-500">Loading notes...</div>
        ) : mentionedInNotes.length > 0 ? (
          <div className="space-y-2">
            {mentionedInNotes.map((note: any) => (
              <div key={note.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <StickyNote className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{note.title}</span>
                  </div>
                  <div className="text-xs text-gray-600 flex-shrink-0">
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
                  className="text-yellow-700 hover:text-yellow-800 ml-3 flex-shrink-0"
                >
                  View Note
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">This contact is not mentioned in any notes.</div>
        )}
      </Card>

      <hr className="border-gray-100" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Contact Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{contact.id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(contact.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(contact.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};