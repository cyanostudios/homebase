// client/src/plugins/sportadmin/components/SportadminSyncProgressDialog.tsx
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

/**
 * Non-dismissible busy dialog while SportAdmin sync runs.
 * Parent controls open; Escape / outside click do not close it.
 */
export function SportadminSyncProgressDialog({ isOpen }: { isOpen: boolean }) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={() => {}}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden />
            <div className="min-w-0 space-y-1">
              <AlertDialogTitle className="text-left">
                {t('sportadmin.syncingTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left text-sm text-muted-foreground">
                {t('sportadmin.syncingBody')}
              </AlertDialogDescription>
              <p className="text-left text-xs text-muted-foreground">
                {t('sportadmin.syncingHint')}
              </p>
            </div>
          </div>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
