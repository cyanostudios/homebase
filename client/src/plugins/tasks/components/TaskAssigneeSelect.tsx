import { Search, Trash2, User, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useApp } from '@/core/api/AppContext';

/** Same shell as slots detail cards */
const TASK_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

interface TaskAssigneeSelectProps {
  task: any;
  onAssigneeChange: (contactIds: string[]) => void;
}

/**
 * Assignee picker matching SlotView contacts: header + Popover search + bordered rows.
 * Multi-assignee picker matching SlotView contacts: add/search + removable rows.
 */
export function TaskAssigneeSelect({ task, onAssigneeChange }: TaskAssigneeSelectProps) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const [contactSearch, setContactSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const assignableContacts = useMemo(
    () => (contacts as any[]).filter((c) => c.isAssignable !== false),
    [contacts],
  );

  const assignedIds = useMemo(() => {
    if (Array.isArray(task?.assignedToIds)) {
      return task.assignedToIds.map((id: any) => String(id));
    }
    if (task?.assignedTo !== null && task?.assignedTo !== undefined && task.assignedTo !== '') {
      return [String(task.assignedTo)];
    }
    return [];
  }, [task?.assignedTo, task?.assignedToIds]);

  const addableContacts = useMemo(() => {
    return assignableContacts.filter((c) => !assignedIds.includes(String(c.id)));
  }, [assignableContacts, assignedIds]);

  const filteredSuggestions = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) {
      return addableContacts;
    }
    return addableContacts.filter((c: any) => {
      const name = (c.companyName ?? '').toLowerCase();
      const email = (c.email ?? '').toLowerCase();
      const phone = (c.phone ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [addableContacts, contactSearch]);

  const assignedContacts = assignedIds
    .map(
      (id) =>
        assignableContacts.find((c: any) => String(c.id) === id) ??
        (contacts as any[]).find((c: any) => String(c.id) === id),
    )
    .filter(Boolean);

  const openPopover = showSuggestions && addableContacts.length > 0;

  return (
    <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
      <div className="p-6 space-y-2">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {t('tasks.assignee')}
            </span>
          </div>
          <Popover open={openPopover} onOpenChange={setShowSuggestions}>
            <PopoverAnchor asChild>
              <div className="relative w-full min-w-0 sm:max-w-[260px] sm:shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(event) => {
                    setContactSearch(event.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={
                    addableContacts.length === 0
                      ? t('slots.noMoreToAdd')
                      : t('tasks.addAssigneePlaceholder')
                  }
                  className="h-9 bg-background pl-9 text-xs"
                  disabled={addableContacts.length === 0}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
            >
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((contact: any) => {
                  const contactName = contact.companyName ?? `Contact ${contact.id}`;
                  const contactMeta = [contact.email, contact.phone].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        onAssigneeChange([...assignedIds, String(contact.id)]);
                        setContactSearch('');
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{contactName}</span>
                        {contactMeta && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {contactMeta}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  {contactSearch.trim() ? t('common.noResults') : t('tasks.addAssigneePlaceholder')}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {assignedContacts.length > 0 && (
          <div className="space-y-2 pt-0.5">
            {assignedContacts.map((assignedContact: any) => (
              <div key={assignedContact.id} className="rounded-lg border border-border p-4">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {assignedContact.companyName ?? `Contact ${assignedContact.id}`}
                      </span>
                    </div>
                    {[assignedContact.email, assignedContact.phone, assignedContact.phone2].filter(
                      Boolean,
                    ).length > 0 && (
                      <div className="min-w-0 truncate text-xs text-muted-foreground">
                        {[assignedContact.email, assignedContact.phone, assignedContact.phone2]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="h-9 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() =>
                        onAssigneeChange(
                          assignedIds.filter((id) => String(id) !== String(assignedContact.id)),
                        )
                      }
                      aria-label={`${t('tasks.removeAssignee')} ${assignedContact.companyName ?? ''}`}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
