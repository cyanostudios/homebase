import type { Contact } from '../types/contacts';

export type ContactSortField =
  | 'name'
  | 'type'
  | 'email'
  | 'phone'
  | 'time'
  | 'tags'
  | 'assignable'
  | 'updatedAt'
  | 'createdAt';
export type ContactSortOrder = 'asc' | 'desc';

export type ContactTimeRankContext = {
  activeTimeTrackingContactId: string | null;
  contactIdsWithTimeEntries: ReadonlySet<string | number>;
};

type ContactSortable = Pick<
  Contact,
  | 'id'
  | 'companyName'
  | 'contactType'
  | 'email'
  | 'phone'
  | 'phone2'
  | 'tags'
  | 'isAssignable'
  | 'updatedAt'
  | 'createdAt'
>;

const DATE_SORT_FIELDS: ContactSortField[] = ['updatedAt', 'createdAt'];
const ASC_DEFAULT_FIELDS: ContactSortField[] = [
  'name',
  'type',
  'email',
  'phone',
  'time',
  'tags',
  'assignable',
];

export function isContactDateSortField(field: ContactSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

export function isContactAscDefaultField(field: ContactSortField): boolean {
  return ASC_DEFAULT_FIELDS.includes(field);
}

export function getContactTimeRank(
  contact: Pick<Contact, 'id'>,
  ctx: ContactTimeRankContext,
): number {
  const idStr = String(contact.id);
  const activeHere =
    ctx.activeTimeTrackingContactId !== null && idStr === ctx.activeTimeTrackingContactId;
  const hasLogged =
    ctx.contactIdsWithTimeEntries.has(contact.id) || ctx.contactIdsWithTimeEntries.has(idStr);
  if (activeHere) {
    return 2;
  }
  if (hasLogged) {
    return 1;
  }
  return 0;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: ContactSortOrder,
  toTime: (value: Date | string) => number,
): number {
  if (!aValue && !bValue) {
    return 0;
  }
  if (!aValue) {
    return order === 'asc' ? 1 : -1;
  }
  if (!bValue) {
    return order === 'asc' ? -1 : 1;
  }
  const aTime = toTime(aValue);
  const bTime = toTime(bValue);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

function compareStrings(aValue: string, bValue: string, order: ContactSortOrder): number {
  return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
}

function compareNumbers(aValue: number, bValue: number, order: ContactSortOrder): number {
  return order === 'asc' ? aValue - bValue : bValue - aValue;
}

function getContactPhone(contact: Pick<Contact, 'phone' | 'phone2'>): string {
  return (contact.phone?.trim() || contact.phone2?.trim() || '').toLowerCase();
}

function getContactFirstTag(contact: Pick<Contact, 'tags'>): string {
  const tags = Array.isArray(contact.tags) ? contact.tags.filter(Boolean) : [];
  return (tags[0] ?? '').toLowerCase();
}

/** @deprecated Prefer nextListTableSort from @/core/list/listViewMode */
export function nextContactTableSort(
  currentField: ContactSortField,
  currentOrder: ContactSortOrder,
  nextField: ContactSortField,
): { field: ContactSortField; order: ContactSortOrder } {
  if (currentField === nextField) {
    return { field: currentField, order: currentOrder === 'asc' ? 'desc' : 'asc' };
  }
  return {
    field: nextField,
    order: isContactAscDefaultField(nextField) ? 'asc' : 'desc',
  };
}

export function compareContactsByField(
  a: ContactSortable,
  b: ContactSortable,
  field: ContactSortField,
  order: ContactSortOrder,
  timeCtx?: ContactTimeRankContext,
): number {
  if (field === 'time') {
    const ctx = timeCtx ?? {
      activeTimeTrackingContactId: null,
      contactIdsWithTimeEntries: new Set(),
    };
    const ar = getContactTimeRank(a, ctx);
    const br = getContactTimeRank(b, ctx);
    if (ar !== br) {
      return compareNumbers(ar, br, order);
    }
    return a.companyName.toLowerCase().localeCompare(b.companyName.toLowerCase());
  }

  if (field === 'updatedAt' || field === 'createdAt') {
    return compareNullableTimes(a[field], b[field], order, toSortTime);
  }

  if (field === 'assignable') {
    const ar = a.isAssignable ? 1 : 0;
    const br = b.isAssignable ? 1 : 0;
    return compareNumbers(ar, br, order);
  }

  if (field === 'name') {
    return compareStrings(a.companyName.toLowerCase(), b.companyName.toLowerCase(), order);
  }
  if (field === 'type') {
    return compareStrings(a.contactType, b.contactType, order);
  }
  if (field === 'email') {
    return compareStrings((a.email ?? '').toLowerCase(), (b.email ?? '').toLowerCase(), order);
  }
  if (field === 'phone') {
    return compareStrings(getContactPhone(a), getContactPhone(b), order);
  }
  return compareStrings(getContactFirstTag(a), getContactFirstTag(b), order);
}
