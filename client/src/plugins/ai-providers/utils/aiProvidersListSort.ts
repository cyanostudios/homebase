import { nextListTableSort } from '@/core/list/listViewMode';

import type { ProviderSettings } from '../types/aiProviders';

export type AIProviderSortField = 'providerKey' | 'status' | 'defaultModel' | 'updatedAt';
export type AIProviderSortOrder = 'asc' | 'desc';

export function isAscDefaultAIProviderSort(field: AIProviderSortField): boolean {
  return field === 'providerKey' || field === 'status' || field === 'defaultModel';
}

export function nextAIProviderTableSort(
  currentField: AIProviderSortField,
  currentOrder: AIProviderSortOrder,
  nextField: AIProviderSortField,
): { field: AIProviderSortField; order: AIProviderSortOrder } {
  return nextListTableSort(currentField, currentOrder, nextField, isAscDefaultAIProviderSort);
}

export function compareAIProviders(
  a: ProviderSettings,
  b: ProviderSettings,
  field: AIProviderSortField,
  order: AIProviderSortOrder,
  titleOf: (provider: ProviderSettings) => string,
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
  if (field === 'defaultModel') {
    return (
      flip *
      String(a.defaultModel || '').localeCompare(String(b.defaultModel || ''), undefined, {
        sensitivity: 'base',
      })
    );
  }
  return flip * titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' });
}
