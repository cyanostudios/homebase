import { Mail, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

interface ContactViewProps {
  contact: any;
}

export const ContactView: React.FC<ContactViewProps> = ({ contact }) => {
  const {
    getNotesForContact,
    getEstimatesForContact,
    getTasksForContact,
    getTasksWithMentionsForContact,
    openNoteForView,
    openTaskForView,
    openEstimateForView,
  } = useApp();

  const { closeContactPanel } = useContacts();

  // State for cross-plugin data
  const [mentionedInNotes, setMentionedInNotes] = useState<any[]>([]);
  const [relatedEstimates, setRelatedEstimates] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [mentionedInTasks, setMentionedInTasks] = useState<any[]>([]);
  const [_loadingNotes, setLoadingNotes] = useState(false);
  const [_loadingEstimates, setLoadingEstimates] = useState(false);
  const [_loadingTasks, setLoadingTasks] = useState(false);
  const [_loadingTaskMentions, setLoadingTaskMentions] = useState(false);
  const [timeEntries, setTimeEntries] = useState<
    { id: string; seconds: number; loggedAt: string }[]
  >([]);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const loadTimeEntries = useCallback(async (contactId: string) => {
    try {
      const res = await fetch(`/api/contacts/${contactId}/time-entries`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTimeEntries(data);
      } else {
        setTimeEntries([]);
      }
    } catch {
      setTimeEntries([]);
    }
  }, []);

  useEffect(() => {
    if (contact?.id) {
      loadTimeEntries(contact.id);
    } else {
      setTimeEntries([]);
    }
  }, [contact?.id, loadTimeEntries]);

  const handleDeleteTimeEntry = async (entryId: string) => {
    if (!contact?.id) {
      return;
    }
    setDeletingEntryId(entryId);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/time-entries/${entryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
      }
    } finally {
      setDeletingEntryId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m} min`;
  };

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

  const _getStatusBadge = (status: string, plugin: 'task' | 'estimate') => {
    const statusColors: any = {
      task: {
        'not started': 'bg-muted text-muted-foreground',
        'in progress': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        Done: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
        Canceled: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      },
      estimate: {
        draft: 'bg-muted text-muted-foreground',
        sent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        accepted: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-blue-300',
        rejected: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-blue-300',
      },
    };
    const colorClass =
      statusColors[plugin][status] || statusColors[plugin][Object.keys(statusColors[plugin])[0]];
    return (
      <span
        className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', colorClass)}
      >
        {status}
      </span>
    );
  };

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-6">
          {openTaskForView && (assignedTasks.length > 0 || mentionedInTasks.length > 0) && (
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Tasks" className="p-4">
                <div className="space-y-3">
                  {assignedTasks.length > 0 && (
                    <div className="space-y-2">
                      {assignedTasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="flex justify-between items-center text-[11px] plugin-tasks bg-plugin-subtle px-2 py-1.5 rounded-md border border-border/50"
                        >
                          <span className="text-muted-foreground truncate mr-4">{task.title}</span>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => {
                              closeContactPanel();
                              openTaskForView(task);
                            }}
                            className="h-auto p-0 text-[10px] shrink-0 font-medium text-plugin"
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {mentionedInTasks.length > 0 && (
                    <div className="space-y-2">
                      {mentionedInTasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="flex justify-between items-center text-[11px] plugin-tasks bg-plugin-subtle/50 px-2 py-1.5 rounded-md border border-border/50"
                        >
                          <span className="text-muted-foreground truncate mr-4">{task.title}</span>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => {
                              closeContactPanel();
                              openTaskForView(task);
                            }}
                            className="h-auto p-0 text-[10px] shrink-0 font-medium text-plugin"
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>
          )}

          {openEstimateForView && relatedEstimates.length > 0 && (
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Estimates" className="p-4">
                <div className="space-y-2">
                  {relatedEstimates.map((estimate: any) => (
                    <div
                      key={estimate.id}
                      className="flex justify-between items-center text-[11px] plugin-estimates bg-plugin-subtle px-2 py-1.5 rounded-md border border-border/50"
                    >
                      <span className="text-muted-foreground truncate mr-4">
                        {formatDisplayNumber('estimates', estimate.estimateNumber)}
                      </span>
                      <Button
                        size="sm"
                        variant="link"
                        onClick={() => {
                          closeContactPanel();
                          openEstimateForView(estimate);
                        }}
                        className="h-auto p-0 text-[10px] shrink-0 font-medium text-plugin"
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          )}

          {openNoteForView && mentionedInNotes.length > 0 && (
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Note Mentions" className="p-4">
                <div className="space-y-2">
                  {mentionedInNotes.map((note: any) => (
                    <div
                      key={note.id}
                      className="flex justify-between items-center text-[11px] plugin-notes bg-plugin-subtle px-2 py-1.5 rounded-md border border-border/50"
                    >
                      <span className="text-muted-foreground truncate mr-4">{note.title}</span>
                      <Button
                        size="sm"
                        variant="link"
                        onClick={() => {
                          closeContactPanel();
                          openNoteForView(note);
                        }}
                        className="h-auto p-0 text-[10px] shrink-0 font-medium text-plugin"
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          )}

          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Time log" className="p-4">
              <div className="space-y-2">
                {timeEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No time entries</p>
                ) : (
                  timeEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center text-[11px] bg-muted/50 px-2 py-1.5 rounded-md border border-border/50"
                    >
                      <span className="text-foreground">
                        {formatDuration(entry.seconds)} ·{' '}
                        {new Date(entry.loggedAt).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTimeEntry(entry.id)}
                        disabled={deletingEntryId === entry.id}
                        aria-label="Delete time entry"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Information" className="p-4 text-xs font-semibold">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">System ID</span>
                  <span className="font-mono font-medium">
                    {formatDisplayNumber('contacts', contact.id)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(contact.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">
                    {new Date(contact.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Basic Information at the top */}
        <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
          <DetailSection title="Basic Information" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              {contact.email && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Email</div>
                  <div className="font-medium truncate">{contact.email}</div>
                </div>
              )}
              {contact.phone && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Phone</div>
                  <div className="font-medium">{contact.phone}</div>
                </div>
              )}
              {contact.website && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Website</div>
                  <a
                    href={
                      contact.website.startsWith('http')
                        ? contact.website
                        : `https://${contact.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium truncate block"
                  >
                    {contact.website}
                  </a>
                </div>
              )}
            </div>
          </DetailSection>
        </Card>

        {contact.notes && (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Internal Notes" className="p-6">
              <div className="text-sm text-muted-foreground italic leading-relaxed">
                "{contact.notes}"
              </div>
            </DetailSection>
          </Card>
        )}

        {/* Business Settings */}
        <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
          <DetailSection title="Business Settings" className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Tax Rate</div>
                <div className="font-medium">{contact.taxRate}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Payment Terms</div>
                <div className="font-medium">{contact.paymentTerms} Days</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Currency</div>
                <div className="font-medium">{contact.currency}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">F-Tax</div>
                <div className="font-medium">{contact.fTax === 'yes' ? 'Registered' : 'No'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Assignable</div>
                <div className="font-medium">
                  {contact.isAssignable ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      No
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DetailSection>
        </Card>

        {/* Addresses */}
        {contact.addresses && contact.addresses.length > 0 && (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Addresses" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {contact.addresses.map((address: any) => (
                  <div key={address.id} className="text-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                        {address.type}
                      </span>
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <div className="text-foreground font-medium">{address.addressLine1}</div>
                      {address.addressLine2 && <div>{address.addressLine2}</div>}
                      <div>{[address.postalCode, address.city].filter(Boolean).join(' ')}</div>
                      <div>{address.country}</div>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          </Card>
        )}

        {/* Contact Persons */}
        {contact.contactType === 'company' && contact.contactPersons?.length > 0 && (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Contact Persons" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {contact.contactPersons.map((person: any) => (
                  <div key={person.id} className="text-sm flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground">{person.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {person.title || 'No title'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {person.email || '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          </Card>
        )}
      </div>
    </DetailLayout>
  );
};
