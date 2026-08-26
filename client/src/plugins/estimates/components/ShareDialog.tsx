import { Share, Copy, Check, X, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DialogCloseButton } from '@/core/ui/DialogRoundButtons';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  /** Label shown in copy (estimate number, note title, etc.) */
  entityLabel: string;
  /** Controls title and wording */
  variant?: 'estimate' | 'note' | 'task' | 'invoice';
}

export function ShareDialog({
  isOpen,
  onClose,
  shareUrl,
  entityLabel,
  variant = 'estimate',
}: ShareDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleView = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const title =
    variant === 'note'
      ? t('shareDialog.titleNote', { defaultValue: 'Note share' })
      : variant === 'task'
        ? t('shareDialog.titleTask', { defaultValue: 'Task share' })
        : variant === 'invoice'
          ? t('invoices.shareDialogTitle', { defaultValue: 'Invoice share' })
          : t('shareDialog.titleEstimate', { defaultValue: 'Estimate share' });

  const help =
    variant === 'invoice'
      ? t('invoices.shareDialogHelp', {
          defaultValue: 'Anyone with this link can view invoice {{label}}.',
          label: entityLabel,
        })
      : t('shareDialog.anyoneCanView', {
          defaultValue: 'Anyone with this link can view {{entity}} {{label}}.',
          entity:
            variant === 'note'
              ? t('shareDialog.entityNote', { defaultValue: 'note' })
              : variant === 'task'
                ? t('shareDialog.entityTask', { defaultValue: 'task' })
                : t('shareDialog.entityEstimate', { defaultValue: 'estimate' }),
          label: entityLabel,
        });

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <AlertDialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5 text-blue-600" />
            {title}
          </AlertDialogTitle>
          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{help}</p>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="select-all break-all font-mono text-sm text-foreground">{shareUrl}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              className={`h-9 px-3 text-xs ${copied ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : ''}`}
            >
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ExternalLink}
              onClick={handleView}
              className="h-9 px-3 text-xs"
            >
              {t('common.view')}
            </Button>
            <DialogCloseButton onClick={onClose} />
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
