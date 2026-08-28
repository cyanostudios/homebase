import { Search, User, Users, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { DetailSection } from '@/core/ui/DetailSection';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { LIST_SEARCH_FIELD_PROPS } from '@/core/ui/listSearchFieldProps';
import { buildSlug } from '@/core/utils/slugUtils';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';

import { useTasks } from '../hooks/useTasks';

interface TaskAssigneeSelectProps {
  task: any;
  onAssigneeChange: (contactIds: string[]) => void;
}

/**
 * Assignee picker: Contacts Linked-style tiles + search-to-add (same pattern as SlotView add).
 * Tile click → contact quick-info popup, then navigate on confirm.
 */
export function TaskAssigneeSelect({ task, onAssigneeChange }: TaskAssigneeSelectProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const { closeTaskPanel } = useTasks();
  const [contactSearch, setContactSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  const assignableContacts = useMemo(
    () => (contacts as Contact[]).filter((c) => c.isAssignable !== false),
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
    return addableContacts.filter((c: Contact) => {
      const name = (c.companyName ?? '').toLowerCase();
      const email = (c.email ?? '').toLowerCase();
      const phone = (c.phone ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [addableContacts, contactSearch]);

  const assignedContacts = assignedIds
    .map(
      (id: string) =>
        assignableContacts.find((c) => String(c.id) === id) ??
        (contacts as Contact[]).find((c) => String(c.id) === id),
    )
    .filter(Boolean) as Contact[];

  const openPopover = showSuggestions && addableContacts.length > 0;

  const navigateToContact = (contact: Contact) => {
    closeTaskPanel();
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts, 'companyName')}`);
  };

  const searchAction = (
    <Popover open={openPopover} onOpenChange={setShowSuggestions}>
      <PopoverAnchor asChild>
        <div className="relative w-full min-w-0 sm:max-w-[220px] sm:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            {...LIST_SEARCH_FIELD_PROPS}
            name="homebase-assignee-search"
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
          filteredSuggestions.map((contact) => {
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
                  {contactMeta ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {contactMeta}
                    </span>
                  ) : null}
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
  );

  return (
    <>
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={
            <span className="inline-flex items-baseline gap-2">
              <span>{t('tasks.assignee')}</span>
              <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                {t('tasks.quickContext.mentionsHint')}
              </span>
            </span>
          }
          icon={Users}
          iconPlugin="contacts"
          subtleTitle
          className="p-6"
          action={searchAction}
        >
          {assignedContacts.length > 0 ? (
            <QuickContextLinkTileGrid>
              {assignedContacts.map((assignedContact) => {
                const typeKey = assignedContact.contactType === 'private' ? 'private' : 'company';
                const name = assignedContact.companyName ?? `Contact ${assignedContact.id}`;
                return (
                  <div key={assignedContact.id} className="group relative min-w-0">
                    <QuickContextLinkTile
                      label={t('nav.contact')}
                      meta={t(`contacts.type.${typeKey}`)}
                      metaClassName={CONTACT_TYPE_COLORS[typeKey]}
                      icon={User}
                      iconClassName="text-sky-600"
                      onClick={() => setViewingContact(assignedContact)}
                    >
                      {name}
                    </QuickContextLinkTile>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={X}
                      className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAssigneeChange(
                          assignedIds.filter(
                            (id: string) => String(id) !== String(assignedContact.id),
                          ),
                        );
                      }}
                      aria-label={`${t('tasks.removeAssignee')} ${name}`}
                    />
                  </div>
                );
              })}
            </QuickContextLinkTileGrid>
          ) : (
            <p className="text-xs text-muted-foreground">{t('tasks.noAssigneesYet')}</p>
          )}
        </DetailSection>
      </Card>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />
    </>
  );
}
