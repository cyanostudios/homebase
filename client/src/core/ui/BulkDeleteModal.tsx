// client/src/core/ui/BulkDeleteModal.tsx
// Generic bulk delete confirmation modal

import React from 'react';

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

  const singularLabel = itemLabel.endsWith('s') ? itemLabel.slice(0, -1) : itemLabel;
  const pluralLabel = itemLabel;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border dark:border-gray-800">
          <div className="p-4 border-b dark:border-gray-800">
            <Heading level={3} className="mb-0">
              Delete selected {pluralLabel}
            </Heading>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {itemCount} {itemCount === 1 ? singularLabel : pluralLabel} selected
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to delete {itemCount}{' '}
              {itemCount === 1 ? singularLabel : pluralLabel}?
              {warningMessage && (
                <span className="block mt-2 text-red-600 dark:text-red-400 font-medium">
                  {warningMessage}
                </span>
              )}
              This action cannot be undone.
            </p>
          </div>
          <div className="p-4 border-t dark:border-gray-800 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirm}
              disabled={isLoading || itemCount === 0}
            >
              {isLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
