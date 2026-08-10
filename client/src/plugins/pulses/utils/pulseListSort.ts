import { nextListTableSort } from '@/core/list/listViewMode';

import type { PulseProviderSettings } from '../types/pulse';

export type PulseProviderSortField = 'providerKey' | 'status' | 'capability' | 'updatedAt';
export type PulseProviderSortOrder = 'asc' | 'desc';

export function isAscDefaultPulseSort(field: PulseProviderSortField): boolean {
  return field === 'providerKey' || field === 'status' || field === 'capability';
}

export function nextPulseProviderTableSort(
  currentField: PulseProviderSortField,
  currentOrder: PulseProviderSortOrder,
  nextField: PulseProviderSortField,
): { field: PulseProviderSortField; order: PulseProviderSortOrder } {
  return nextListTableSort(currentField, currentOrder, nextField, isAscDefaultPulseSort);
}

export function comparePulseProviders(
  a: PulseProviderSettings,
  b: PulseProviderSettings,
  field: PulseProviderSortField,
  order: PulseProviderSortOrder,
  titleOf: (provider: PulseProviderSettings) => string,
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
    return flip * (Number(a.smsNotificationCapable) - Number(b.smsNotificationCapable));
  }
  return flip * titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' });
}
