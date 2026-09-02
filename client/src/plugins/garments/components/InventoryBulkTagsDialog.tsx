import { Eraser, Tag } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NativeSelect } from '@/components/ui/select';
import {
  DIALOG_BODY_SCROLL_CLASS,
  DIALOG_FOOTER_SPLIT_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
} from '@/core/ui/dialogStyles';
import {
  DialogActionButton,
  DialogCancelButton,
  DialogCloseButton,
  DialogSaveButton,
} from '@/core/ui/DialogRoundButtons';
import { DialogHeading } from '@/core/ui/DialogHeading';

import type { InventoryItem } from '../types/garments';

type Phase = 'idle' | 'applying' | 'done';
type BulkTagAction = 'add' | 'clear';

export interface InventoryBulkTagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: InventoryItem[];
  availableTags: string[];
  applyTagToInventoryItem: (item: InventoryItem, tag: string) => Promise<boolean>;
  clearTagsFromInventoryItem: (item: InventoryItem) => Promise<boolean>;
  onSuccess?: () => void;
}

export function InventoryBulkTagsDialog({
  isOpen,
  onClose,
  selectedItems,
  availableTags,
  applyTagToInventoryItem,
  clearTagsFromInventoryItem,
  onSuccess,
}: InventoryBulkTagsDialogProps) {
  const { t } = useTranslation();
  const [tag, setTag] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeAction, setActiveAction] = useState<BulkTagAction | null>(null);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setTag(availableTags[0] ?? '');
    setPhase('idle');
    setActiveAction(null);
    setUpdatedCount(0);
    setFailedCount(0);
  }, [availableTags, isOpen]);

  const runBulk = useCallback(
    async (bulkAction: BulkTagAction) => {
      if (selectedItems.length === 0) {
        return;
      }
      if (bulkAction === 'add' && !tag.trim()) {
        return;
      }

      setActiveAction(bulkAction);
      setPhase('applying');
      setUpdatedCount(0);
      setFailedCount(0);

      let updated = 0;
      let failed = 0;
      for (const item of selectedItems) {
        try {
          const ok =
            bulkAction === 'clear'
              ? await clearTagsFromInventoryItem(item)
              : await applyTagToInventoryItem(item, tag);
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
    },
    [applyTagToInventoryItem, clearTagsFromInventoryItem, selectedItems, tag],
  );

  const handleClose = useCallback(() => {
    setPhase('idle');
    setActiveAction(null);
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
  const hasTags = availableTags.length > 0;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={phase === 'applying' ? undefined : handleClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 flex w-[92vw] max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="flex max-h-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className={DIALOG_HEADER_CLASS}>
            <DialogHeading className="mb-0 flex items-center gap-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              {t('garments.bulkTagsTitle')}
            </DialogHeading>
            <div className={DIALOG_SUBTITLE_CLASS}>{t('garments.bulkTagsSubtitle', { count })}</div>
          </div>

          <div className={DIALOG_BODY_SCROLL_CLASS}>
            {phase === 'idle' && (
              <div className="space-y-2">
                {hasTags ? (
                  <>
                    <label
                      htmlFor="garments-bulk-tag"
                      className="text-sm font-medium text-foreground"
                    >
                      {t('garments.bulkTagsLabel')}
                    </label>
                    <NativeSelect
                      id="garments-bulk-tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    >
                      {availableTags.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="text-xs text-muted-foreground">{t('garments.bulkTagsHint')}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('garments.bulkTagsEmpty')}</p>
                )}
              </div>
            )}

            {phase === 'applying' && (
              <p className="text-sm text-muted-foreground">
                {t('garments.bulkTagsApplying', {
                  current: updatedCount + failedCount,
                  total: count,
                })}
              </p>
            )}

            {phase === 'done' && (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{t('garments.bulkTagsDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : updatedCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('garments.bulkTagsResult', {
                    updated: updatedCount,
                    failed: failedCount,
                  })}
                </p>
              </div>
            )}
          </div>

          <div className={DIALOG_FOOTER_SPLIT_CLASS}>
            {phase === 'done' ? (
              <div className="flex w-full justify-end">
                <DialogCloseButton onClick={handleDoneClose} />
              </div>
            ) : (
              <>
                <DialogActionButton
                  icon={Eraser}
                  variant="danger"
                  label={
                    activeAction === 'clear' && phase === 'applying'
                      ? t('garments.bulkTagsApplyingShort')
                      : t('garments.bulkClearTagsAction')
                  }
                  onClick={() => void runBulk('clear')}
                  disabled={phase === 'applying' || count === 0}
                />
                <div className="flex items-center justify-end gap-2">
                  <DialogCancelButton onClick={handleClose} disabled={phase === 'applying'} />
                  <DialogSaveButton
                    onClick={() => void runBulk('add')}
                    disabled={phase === 'applying' || count === 0 || !hasTags || !tag.trim()}
                    label={
                      activeAction === 'add' && phase === 'applying'
                        ? t('garments.bulkTagsApplyingShort')
                        : t('garments.bulkTagsApply')
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
