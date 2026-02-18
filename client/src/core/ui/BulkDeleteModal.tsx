// client/src/core/ui/BulkDeleteModal.tsx
// Generic bulk delete confirmation modal

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { Heading } from './Typography';

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

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
        <div className="bg-white rounded-xl shadow-xl border">
          <div className="p-4 border-b">
            <Heading level={3} className="mb-0">
              {t('bulk.deleteSelectedTitle', { items: itemsLabel })}
            </Heading>
            <div className="text-xs text-gray-500">
              {t('bulk.selectedCount', { count: itemCount, items: itemsLabel })}
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700">
              {t('bulk.confirmMessage', { count: itemCount, items: itemsLabel })}
              {warningMessage && (
                <span className="block mt-2 text-red-600 font-medium">{warningMessage}</span>
              )}
              {t('bulk.cannotUndo')}
            </p>
          </div>
          <div className="p-4 border-t flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirm}
              disabled={isLoading || itemCount === 0}
            >
              {isLoading ? t('common.deleting') : t('common.delete')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
