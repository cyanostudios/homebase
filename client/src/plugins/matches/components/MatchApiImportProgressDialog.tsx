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

export interface MatchApiImportProgressDialogProps {
  isOpen: boolean;
  /** Optional API host / label shown in “Importing from …” */
  sourceLabel?: string;
}

/**
 * Non-dismissible busy dialog while Matches API import runs.
 * Parent controls open; Escape / outside click do not close it.
 */
export function MatchApiImportProgressDialog({
  isOpen,
  sourceLabel,
}: MatchApiImportProgressDialogProps) {
  const { t } = useTranslation();

  const name = (sourceLabel || '').trim();
  const body = name ? t('matches.importingFrom', { name }) : t('matches.importingFromFallback');

  return (
    <AlertDialog open={isOpen} onOpenChange={() => {}}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden />
            <div className="min-w-0 space-y-1">
              <AlertDialogTitle className="text-left">
                {t('matches.importingTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left text-sm text-muted-foreground">
                {body}
              </AlertDialogDescription>
              <p className="text-left text-xs text-muted-foreground">
                {t('matches.importingHint')}
              </p>
            </div>
          </div>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
