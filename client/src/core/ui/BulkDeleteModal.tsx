// client/src/core/ui/BulkDeleteModal.tsx
// Generic bulk delete confirmation modal

import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  DIALOG_BODY_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
} from './dialogStyles';
import { DialogHeading } from './DialogHeading';
import { DialogCancelButton, DialogDeleteButton } from './DialogRoundButtons';

function formatBulkItemsLabel(label: string, count: number): string {
  const lower = label.toLowerCase();
  if (count === 1) {
    return lower.endsWith('s') ? lower.slice(0, -1) : lower;
  }
  return lower;
}

export interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  itemCount: number;
  itemLabel: string; // "files", "contacts", etc.
  isLoading?: boolean;
  warningMessage?: string; // Optional additional warning
}

/**
 * BulkDeleteModal - Generic confirmation modal for bulk delete operations
 * Displays item count and confirmation message
 */
export function BulkDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
  itemLabel,
  isLoading = false,
  warningMessage,
}: BulkDeleteModalProps) {
  const { t } = useTranslation();
  if (!isOpen) {
    return null;
  }

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Bulk delete failed:', error);
    }
  };

  const itemsLabel =
    (t(`nav.${itemLabel}` as 'nav.slots') as string) !== `nav.${itemLabel}`
      ? t(`nav.${itemLabel}` as 'nav.slots')
      : itemLabel;
  const itemsDisplayLabel = formatBulkItemsLabel(itemsLabel, itemCount);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
        <div className="rounded-xl border bg-background shadow-xl">
          <div className={DIALOG_HEADER_CLASS}>
            <DialogHeading className="mb-0">
              {t('bulk.deleteSelectedTitle', { items: itemsDisplayLabel })}
            </DialogHeading>
            <div className={DIALOG_SUBTITLE_CLASS}>
              {t('bulk.selectedCount', { count: itemCount, items: itemsDisplayLabel })}
            </div>
          </div>
          <div className={`${DIALOG_BODY_CLASS} space-y-2`}>
            <p className="text-sm text-foreground">
              {t('bulk.confirmMessage', { count: itemCount, items: itemsDisplayLabel })}
            </p>
            {warningMessage ? (
              <p className="text-sm font-medium text-destructive">{warningMessage}</p>
            ) : null}
            <p className="text-sm font-extrabold text-destructive">{t('bulk.cannotUndo')}</p>
          </div>
          <div className={DIALOG_FOOTER_CLASS}>
            <DialogCancelButton onClick={onClose} disabled={isLoading} />
            <DialogDeleteButton
              onClick={handleConfirm}
              disabled={isLoading || itemCount === 0}
              label={isLoading ? t('common.deleting') : t('common.delete')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
