import { nextListTableSort } from '@/core/list/listViewMode';

import type { MailProviderSettings } from '../types/mail';

export type MailProviderSortField = 'providerKey' | 'status' | 'capability' | 'updatedAt';
export type MailProviderSortOrder = 'asc' | 'desc';

export function isAscDefaultMailSort(field: MailProviderSortField): boolean {
  return field === 'providerKey' || field === 'status' || field === 'capability';
}

export function nextMailProviderTableSort(
  currentField: MailProviderSortField,
  currentOrder: MailProviderSortOrder,
  nextField: MailProviderSortField,
): { field: MailProviderSortField; order: MailProviderSortOrder } {
  return nextListTableSort(currentField, currentOrder, nextField, isAscDefaultMailSort);
}

export function compareMailProviders(
  a: MailProviderSettings,
  b: MailProviderSettings,
  field: MailProviderSortField,
  order: MailProviderSortOrder,
  titleOf: (provider: MailProviderSettings) => string,
): number {
  const flip = order === 'asc' ? 1 : -1;
  if (field === 'updatedAt') {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return flip * (ta - tb);
  }
  if (field === 'status') {
    return flip * (Number(a.enabled) - Number(b.enabled));
  }
  if (field === 'capability') {
    return flip * (Number(a.emailCapable) - Number(b.emailCapable));
  }
  return flip * titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' });
}
