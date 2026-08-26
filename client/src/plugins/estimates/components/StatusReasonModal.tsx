import { X } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DIALOG_BODY_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
  DIALOG_TITLE_CLASS,
} from '@/core/ui/dialogStyles';
import {
  DialogCancelButton,
  DialogDeleteButton,
  DialogSaveButton,
} from '@/core/ui/DialogRoundButtons';

import { ACCEPTANCE_REASONS, REJECTION_REASONS } from '../types/estimate';

interface StatusReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasons: string[]) => void;
  status: 'accepted' | 'rejected';
  estimateNumber: string;
}

export function StatusReasonModal({
  isOpen,
  onClose,
  onConfirm,
  status,
  estimateNumber,
}: StatusReasonModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  if (!isOpen) {
    return null;
  }

  const reasons = status === 'accepted' ? ACCEPTANCE_REASONS : REJECTION_REASONS;
  const title =
    status === 'accepted' ? 'Why was this estimate accepted?' : 'Why was this estimate rejected?';
  const subtitle =
    status === 'accepted'
      ? 'Select all factors that contributed to the acceptance:'
      : 'Select all factors that led to the rejection:';

  const handleReasonToggle = (reasonId: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonId) ? prev.filter((id) => id !== reasonId) : [...prev, reasonId],
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedReasons);
    setSelectedReasons([]); // Reset for next time
  };

  const handleCancel = () => {
    setSelectedReasons([]); // Reset selections
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className={cn(DIALOG_HEADER_CLASS, 'flex items-center justify-between')}>
          <div>
            <h2 className={DIALOG_TITLE_CLASS}>{title}</h2>
            <p className={DIALOG_SUBTITLE_CLASS}>Estimate {estimateNumber}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className={DIALOG_BODY_CLASS}>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{subtitle}</p>

          <div className="space-y-2">
            {reasons.map((reason) => (
              <label
                key={reason.id}
                className="flex items-start space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-md cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(reason.id)}
                  onChange={() => handleReasonToggle(reason.id)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-900 dark:text-gray-100">{reason.label}</span>
                </div>
              </label>
            ))}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
            You can proceed without selecting any reasons, but it helps with statistics.
          </p>
        </div>

        {/* Footer */}
        <div className={DIALOG_FOOTER_CLASS}>
          <DialogCancelButton onClick={handleCancel} />
          {status === 'accepted' ? (
            <DialogSaveButton
              label={`Mark as Accepted${selectedReasons.length > 0 ? ` (${selectedReasons.length})` : ''}`}
              onClick={handleConfirm}
            />
          ) : (
            <DialogDeleteButton
              label={`Mark as Rejected${selectedReasons.length > 0 ? ` (${selectedReasons.length})` : ''}`}
              onClick={handleConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
