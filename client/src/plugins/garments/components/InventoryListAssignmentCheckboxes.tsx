import { Package } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { useGarments } from '../hooks/useGarments';

export function InventoryListAssignmentCheckboxes({ itemId }: { itemId?: string }) {
  const { t } = useTranslation();
  const { garmentLists, inventoryItems, assignInventoryItemToList, unassignInventoryItemFromList } =
    useGarments();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const item = useMemo(
    () => (itemId ? inventoryItems.find((row) => row.id === itemId) : undefined),
    [inventoryItems, itemId],
  );
  const assignedListIds = useMemo(
    () => new Set((item?.assignedListIds ?? []).map(String)),
    [item?.assignedListIds],
  );

  const toggleAssignment = useCallback(
    async (listId: string, assigned: boolean) => {
      if (!itemId) {
        return;
      }
      const key = `${itemId}:${listId}`;
      setBusyKey(key);
      setErrorMessage(null);
      const ok = assigned
        ? await unassignInventoryItemFromList(listId, itemId)
        : await assignInventoryItemToList(listId, itemId);
      if (!ok) {
        setErrorMessage(assigned ? t('garments.unassignBlocked') : t('garments.assignFailed'));
      }
      setBusyKey(null);
    },
    [assignInventoryItemToList, itemId, t, unassignInventoryItemFromList],
  );

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('garments.assignToLists')} icon={Package} subtleTitle className="p-4">
        <p className="mb-3 text-xs text-muted-foreground">{t('garments.inventoryInListsHint')}</p>

        {!itemId ? (
          <p className="text-sm text-muted-foreground">{t('garments.assignToListsSaveFirst')}</p>
        ) : null}

        {errorMessage ? (
          <p role="status" className="mb-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {itemId && garmentLists.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('garments.noListsYet')}</p>
        ) : null}

        {itemId && garmentLists.length > 0 ? (
          <ul className="space-y-1.5">
            {garmentLists.map((list) => {
              const assigned = assignedListIds.has(String(list.id));
              const key = `${itemId}:${list.id}`;
              const rowBusy = busyKey === key;
              return (
                <li key={list.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm',
                      rowBusy && 'cursor-wait opacity-60',
                    )}
                  >
                    <Checkbox
                      checked={assigned}
                      disabled={rowBusy}
                      onChange={() => void toggleAssignment(list.id, assigned)}
                      aria-label={`${item?.articleName ?? t('garments.articleName')} — ${list.name}`}
                    />
                    <span className="truncate">{list.name || '—'}</span>
                    {busyKey === key ? (
                      <span className="text-xs text-muted-foreground">{t('common.saving')}</span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </DetailSection>
    </Card>
  );
}
