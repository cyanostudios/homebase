import { Shirt } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NativeSelect } from '@/components/ui/select';
import {
  DialogCancelButton,
  DialogCloseButton,
  DialogSaveButton,
} from '@/core/ui/DialogRoundButtons';
import {
  DIALOG_BODY_SCROLL_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
} from '@/core/ui/dialogStyles';
import { DialogHeading } from '@/core/ui/DialogHeading';

import type { GarmentList, InventoryItem } from '../types/garments';

type Phase = 'idle' | 'applying' | 'done';
type ListVisibilityAction = 'assign' | 'unassign';

export interface InventoryBulkListsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: InventoryItem[];
  garmentLists: GarmentList[];
  assignInventoryItemToList: (listId: string, itemId: string) => Promise<boolean>;
  unassignInventoryItemFromList: (listId: string, itemId: string) => Promise<boolean>;
  onSuccess?: () => void;
}

export function InventoryBulkListsDialog({
  isOpen,
  onClose,
  selectedItems,
  garmentLists,
  assignInventoryItemToList,
  unassignInventoryItemFromList,
  onSuccess,
}: InventoryBulkListsDialogProps) {
  const { t } = useTranslation();
  const sortedLists = useMemo(
    () =>
      [...garmentLists].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
      ),
    [garmentLists],
  );
  const [listId, setListId] = useState('');
  const [action, setAction] = useState<ListVisibilityAction>('assign');
  const [phase, setPhase] = useState<Phase>('idle');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setListId(sortedLists[0]?.id ?? '');
    setAction('assign');
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
  }, [isOpen, sortedLists]);

  const handleApply = useCallback(async () => {
    if (selectedItems.length === 0 || !listId) {
      return;
    }

    setPhase('applying');
    setUpdatedCount(0);
    setFailedCount(0);

    let updated = 0;
    let failed = 0;
    for (const item of selectedItems) {
      try {
        const ok =
          action === 'assign'
            ? await assignInventoryItemToList(listId, item.id)
            : await unassignInventoryItemFromList(listId, item.id);
        if (ok) {
          updated += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      setUpdatedCount(updated);
      setFailedCount(failed);
    }

    setPhase('done');
  }, [action, assignInventoryItemToList, listId, selectedItems, unassignInventoryItemFromList]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
    onClose();
  }, [onClose]);

  const handleDoneClose = useCallback(() => {
    onSuccess?.();
    handleClose();
  }, [handleClose, onSuccess]);

  if (!isOpen) {
    return null;
  }

  const count = selectedItems.length;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={phase === 'applying' ? undefined : handleClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 flex max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="flex max-h-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className={DIALOG_HEADER_CLASS}>
            <DialogHeading className="mb-0 flex items-center gap-2">
              <Shirt className="h-5 w-5 text-muted-foreground" />
              {t('garments.bulkListsTitle')}
            </DialogHeading>
            <div className={DIALOG_SUBTITLE_CLASS}>
              {t('garments.bulkListsSubtitle', { count })}
            </div>
          </div>

          <div className={DIALOG_BODY_SCROLL_CLASS}>
            {phase === 'idle' && sortedLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('garments.noListsYet')}</p>
            ) : null}

            {phase === 'idle' && sortedLists.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="garments-bulk-list"
                    className="text-sm font-medium text-foreground"
                  >
                    {t('garments.bulkListsListLabel')}
                  </label>
                  <NativeSelect
                    id="garments-bulk-list"
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                  >
                    {sortedLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name || '—'}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="garments-bulk-list-action"
                    className="text-sm font-medium text-foreground"
                  >
                    {t('garments.bulkListsActionLabel')}
                  </label>
                  <NativeSelect
                    id="garments-bulk-list-action"
                    value={action}
                    onChange={(e) => setAction(e.target.value as ListVisibilityAction)}
                  >
                    <option value="assign">{t('garments.bulkListsAssign')}</option>
                    <option value="unassign">{t('garments.bulkListsUnassign')}</option>
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">{t('garments.bulkListsHint')}</p>
                </div>
              </div>
            ) : null}

            {phase === 'applying' ? (
              <p className="text-sm text-muted-foreground">
                {t('garments.bulkListsApplying', {
                  current: updatedCount + failedCount,
                  total: count,
                })}
              </p>
            ) : null}

            {phase === 'done' ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{t('garments.bulkListsDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : updatedCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('garments.bulkListsResult', {
                    updated: updatedCount,
                    failed: failedCount,
                  })}
                </p>
              </div>
            ) : null}
          </div>

          <div className={DIALOG_FOOTER_CLASS}>
            {phase === 'done' ? (
              <DialogCloseButton onClick={handleDoneClose} />
            ) : (
              <>
                <DialogCancelButton onClick={handleClose} disabled={phase === 'applying'} />
                <DialogSaveButton
                  onClick={() => void handleApply()}
                  disabled={
                    phase === 'applying' || count === 0 || sortedLists.length === 0 || !listId
                  }
                  label={
                    phase === 'applying'
                      ? t('garments.bulkListsApplyingShort')
                      : t('garments.bulkListsApply')
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
