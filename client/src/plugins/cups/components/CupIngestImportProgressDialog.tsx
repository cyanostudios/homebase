import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface CupIngestImportProgressDialogProps {
  isOpen: boolean;
  /** Source name shown in “Importing from …” */
  sourceLabel?: string;
  /** 1-based index when importing multiple sources */
  current?: number;
  /** Total sources when importing multiple */
  total?: number;
}

/**
 * Non-dismissible busy dialog while Cups import runs.
 * Parent controls open; Escape / outside click do not close it.
 */
export function CupIngestImportProgressDialog({
  isOpen,
  sourceLabel,
  current,
  total,
}: CupIngestImportProgressDialogProps) {
  const { t } = useTranslation();

  const name = (sourceLabel || '').trim();
  const hasProgress =
    typeof current === 'number' &&
    typeof total === 'number' &&
    total > 1 &&
    current >= 1 &&
    current <= total;

  const body = hasProgress
    ? t('cups.importingFromProgress', {
        name: name || t('cups.importingSourceFallback'),
        current,
        total,
      })
    : name
      ? t('cups.importingFrom', { name })
      : t('cups.importingFromFallback');

  return (
    <AlertDialog open={isOpen} onOpenChange={() => {}}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden />
            <div className="min-w-0 space-y-1">
              <AlertDialogTitle className="text-left">{t('cups.importingTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="text-left text-sm text-muted-foreground">
                {body}
              </AlertDialogDescription>
              <p className="text-left text-xs text-muted-foreground">{t('cups.importingHint')}</p>
            </div>
          </div>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
