import { AlertTriangle } from 'lucide-react';
import React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
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
            <AlertDialogCancel asChild>
              <Button variant="secondary" onClick={onCancel}>
                {cancelText}
              </Button>
            </AlertDialogCancel>
          ) : null}
          {/*
            Pass destructive styles via className (twMerge in AlertDialogAction)
            instead of asChild+Button — otherwise Action's default primary classes
            win and the Delete button stays non-red.
          */}
          <AlertDialogAction
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              buttonVariants({
                variant: isDanger ? 'destructive' : 'default',
              }),
            )}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
