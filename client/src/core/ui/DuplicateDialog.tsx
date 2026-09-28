import { Copy, Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

import {
  AlertDialogRoundAction,
  AlertDialogRoundCancel,
  AlertDialogRoundSave,
  DialogDeleteButton,
} from './DialogRoundButtons';

interface DuplicateDialogProps {
  isOpen: boolean;
  /** Return a promise to keep the dialog open and locked until the copy finishes. */
  onConfirm: (newName: string) => void | Promise<unknown>;
  onCancel: () => void;
  defaultName: string;
  /** Label shown above the input field, e.g. "Company Name" or "Title" */
  nameLabel: string;
  /** If true, hides the name input (for auto-numbered entities like estimates/invoices) */
  confirmOnly?: boolean;
  /** Optional dialog title (default: "Duplicate Item") */
  title?: string;
  /** Optional confirm button text (default: "Save") */
  confirmText?: string;
  /** Optional third action (e.g. create task and delete source note) */
  secondActionText?: string;
  onSecondAction?: (newName: string) => void | Promise<unknown>;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

export const DuplicateDialog: React.FC<DuplicateDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  defaultName,
  nameLabel,
  confirmOnly = false,
  title,
  confirmText,
  secondActionText,
  onSecondAction,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Sync guard: Enter and a following click can both fire before React re-renders.
  const submittingRef = useRef(false);

  const resolvedTitle = title ?? t('dialog.duplicateTitle');
  const resolvedConfirmText = confirmText ?? t('common.save');
  const resolvedName = confirmOnly ? defaultName : name;
  const nameInvalid = !confirmOnly && !resolvedName.trim();

  // Reset name when dialog opens with new defaultName
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      return;
    }
    submittingRef.current = false;
    setIsSubmitting(false);
  }, [isOpen, defaultName]);

  const lockWhile = (result: unknown) => {
    if (!isThenable(result)) {
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    void result.finally(() => {
      submittingRef.current = false;
      setIsSubmitting(false);
    });
  };

  const handleConfirm = () => {
    if (submittingRef.current || nameInvalid) {
      return;
    }
    lockWhile(onConfirm(confirmOnly ? defaultName : name));
  };

  const handleSecondAction = () => {
    if (!onSecondAction || nameInvalid || submittingRef.current) {
      return;
    }
    lockWhile(onSecondAction(resolvedName));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    handleConfirm();
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        // AlertDialogAction closes on click. Hold the dialog while a copy is in flight
        // so a second Enter/click cannot start another copy.
        if (!open && !submittingRef.current) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent aria-busy={isSubmitting}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 flex-shrink-0 text-primary" />
            <AlertDialogTitle>{resolvedTitle}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2" aria-live="polite">
            {isSubmitting
              ? t('dialog.duplicating')
              : confirmOnly
                ? t('dialog.duplicateConfirmOnly')
                : t('dialog.duplicateHint')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!confirmOnly && (
          <div className="py-2">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {nameLabel}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={isSubmitting}
              className="text-sm"
            />
          </div>
        )}

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <AlertDialogRoundCancel onClick={onCancel} disabled={isSubmitting} />
          {isSubmitting ? (
            <AlertDialogRoundAction
              icon={Loader2}
              label={t('common.copying')}
              variant="success"
              disabled
              className="[&_svg]:animate-spin"
            />
          ) : (
            <AlertDialogRoundSave
              label={resolvedConfirmText}
              onClick={handleConfirm}
              disabled={nameInvalid}
            />
          )}
          {secondActionText && onSecondAction ? (
            <DialogDeleteButton
              type="button"
              label={secondActionText}
              onClick={handleSecondAction}
              disabled={nameInvalid || isSubmitting}
            />
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
