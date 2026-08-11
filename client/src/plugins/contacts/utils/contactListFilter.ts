import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { Contact } from '../types/contacts';

/** Selectable filters (excluding "all", which clears the selection). */
export type ContactListFilter =
  | 'company'
  | 'private'
  | 'withTags'
  | 'timeLogged'
  | 'assignable'
  | 'withEmail'
  | 'withPhone'
  | 'withNotes'
  | 'recentlyUpdated';

/** Empty array = show all contacts. Multiple filters are AND-combined. */
export type ContactListFilterSelection = ContactListFilter[];

const TYPE_FILTERS = ['company', 'private'] as const satisfies readonly ContactListFilter[];

export const CONTACT_LIST_FILTER_EXCLUSIVE_GROUPS = [TYPE_FILTERS] as const;

export function contactHasEmail(contact: Pick<Contact, 'email'>): boolean {
  return Boolean(contact.email?.trim());
}

export function contactHasPhone(contact: Pick<Contact, 'phone' | 'phone2'>): boolean {
  return Boolean(contact.phone?.trim() || contact.phone2?.trim());
}

export function contactHasNotes(contact: Pick<Contact, 'notes'>): boolean {
  return Boolean(contact.notes?.trim());
}

export function contactIsRecentlyUpdated(
  contact: Pick<Contact, 'updatedAt'>,
  nowMs: number = Date.now(),
): boolean {
  const updated = contact.updatedAt ? new Date(contact.updatedAt).getTime() : NaN;
  return Number.isFinite(updated) && nowMs - updated <= 7 * 24 * 60 * 60 * 1000;
}

type ContactFilterFields = Pick<
  Contact,
  | 'contactType'
  | 'isAssignable'
  | 'email'
  | 'phone'
  | 'phone2'
  | 'notes'
  | 'tags'
  | 'updatedAt'
  | 'id'
>;

export function contactMatchesSingleFilter(
  contact: ContactFilterFields,
  filter: ContactListFilter,
  contactIdsWithTimeEntries: ReadonlySet<string | number>,
  nowMs: number = Date.now(),
): boolean {
  if (filter === 'company') {
    return contact.contactType === 'company';
  }
  if (filter === 'private') {
    return contact.contactType === 'private';
  }
  if (filter === 'withTags') {
    return Array.isArray(contact.tags) && contact.tags.length > 0;
  }
  if (filter === 'timeLogged') {
    const idStr = String(contact.id);
    return contactIdsWithTimeEntries.has(contact.id) || contactIdsWithTimeEntries.has(idStr);
  }
  if (filter === 'assignable') {
    return Boolean(contact.isAssignable);
  }
  if (filter === 'withEmail') {
    return contactHasEmail(contact);
  }
  if (filter === 'withPhone') {
    return contactHasPhone(contact);
  }
  if (filter === 'withNotes') {
    return contactHasNotes(contact);
  }
  if (filter === 'recentlyUpdated') {
    return contactIsRecentlyUpdated(contact, nowMs);
  }
  return true;
}

/** AND across selected filters. Empty selection = all contacts. */
export function contactMatchesListFilters(
  contact: ContactFilterFields,
  filters: ContactListFilterSelection,
  contactIdsWithTimeEntries: ReadonlySet<string | number>,
  nowMs: number = Date.now(),
): boolean {
  return itemMatchesListFilters(contact, filters, (item, filter) =>
    contactMatchesSingleFilter(item, filter, contactIdsWithTimeEntries, nowMs),
  );
}

/** @deprecated Prefer contactMatchesListFilters; kept for single-filter call sites/tests. */
export function contactMatchesListFilter(
  contact: ContactFilterFields,
  filter: ContactListFilter,
  contactIdsWithTimeEntries: ReadonlySet<string | number>,
  nowMs: number = Date.now(),
): boolean {
  return contactMatchesSingleFilter(contact, filter, contactIdsWithTimeEntries, nowMs);
}

/**
 * Toggle a filter for multi-select.
 * company/private replace each other; other facets toggle independently.
 */
export function toggleContactListFilter(
  current: ContactListFilterSelection,
  filter: ContactListFilter,
): ContactListFilterSelection {
  return toggleListFilterSelection(current, filter, CONTACT_LIST_FILTER_EXCLUSIVE_GROUPS);
}

export function contactMatchesTagFilter(
  contact: Pick<Contact, 'tags'>,
  tagFilter: string,
): boolean {
  if (tagFilter === 'all') {
    return true;
  }
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  return tags.includes(tagFilter);
}

export function collectContactTags(contacts: Array<Pick<Contact, 'tags'>>): string[] {
  const set = new Set<string>();
  for (const contact of contacts) {
    const tags = Array.isArray(contact.tags) ? contact.tags : [];
    for (const tag of tags) {
      if (tag) {
        set.add(tag);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
