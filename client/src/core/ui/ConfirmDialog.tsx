import { AlertTriangle } from 'lucide-react';
import React, { useRef } from 'react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  AlertDialogRoundCancel,
  AlertDialogRoundAction,
  AlertDialogRoundClose,
  AlertDialogRoundDelete,
} from './DialogRoundButtons';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  /** Omit to show a single-action alert (confirm only). */
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
  /** When true, the confirm button is disabled (e.g. while submitting). */
  confirmDisabled?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'warning',
  confirmDisabled = false,
}) => {
  const isDanger = variant === 'danger';
  // AlertDialogAction closes the dialog → onOpenChange(false). Without this guard that
  // would call onCancel and clear pending discard actions before/after onConfirm runs.
  const confirmingRef = useRef(false);

  const handleConfirm = () => {
    confirmingRef.current = true;
    onConfirm();
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      return;
    }
    if (confirmingRef.current) {
      confirmingRef.current = false;
      return;
    }
    onCancel();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`w-6 h-6 flex-shrink-0 ${
                isDanger ? 'text-destructive' : 'text-yellow-500'
              }`}
            />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {cancelText ? (
            <>
              <AlertDialogRoundCancel label={cancelText} onClick={onCancel} />
              {isDanger ? (
                <AlertDialogRoundDelete
                  label={confirmText}
                  onClick={handleConfirm}
                  disabled={confirmDisabled}
                />
              ) : (
                <AlertDialogRoundAction
                  label={confirmText}
                  onClick={handleConfirm}
                  disabled={confirmDisabled}
                />
              )}
            </>
          ) : (
            <AlertDialogRoundClose
              label={confirmText}
              onClick={handleConfirm}
              disabled={confirmDisabled}
            />
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
