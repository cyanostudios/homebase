import { Share, Copy, Check, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DialogActionButton, DialogCloseButton } from '@/core/ui/DialogRoundButtons';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  /** Label shown in copy (estimate number, note title, etc.) */
  entityLabel: string;
  /** Controls title and wording */
  variant?: 'estimate' | 'note' | 'task' | 'invoice' | 'garment';
  /** Optional title override (wins over variant-based title). */
  title?: string;
}

export function ShareDialog({
  isOpen,
  onClose,
  shareUrl,
  entityLabel,
  variant = 'estimate',
  title: titleOverride,
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
    titleOverride ??
    (variant === 'note'
      ? t('shareDialog.titleNote', { defaultValue: 'Note share' })
      : variant === 'task'
        ? t('shareDialog.titleTask', { defaultValue: 'Task share' })
        : variant === 'invoice'
          ? t('invoices.shareDialogTitle', { defaultValue: 'Invoice share' })
          : variant === 'garment'
            ? t('shareDialog.titleGarment', { defaultValue: 'List share' })
            : t('shareDialog.titleEstimate', { defaultValue: 'Estimate share' }));

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
                : variant === 'garment'
                  ? t('shareDialog.entityGarment', { defaultValue: 'list' })
                  : t('shareDialog.entityEstimate', { defaultValue: 'estimate' }),
          label: entityLabel,
        });

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Share className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">{help}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="select-all break-all font-mono text-sm text-foreground">{shareUrl}</p>
        </div>

        <AlertDialogFooter>
          <DialogActionButton
            icon={copied ? Check : Copy}
            label={copied ? t('common.copied') : t('common.copy')}
            variant={copied ? 'success' : 'soft'}
            onClick={() => void handleCopy()}
          />
          <DialogActionButton
            icon={ExternalLink}
            label={t('common.view')}
            variant="soft"
            onClick={handleView}
          />
          <DialogCloseButton onClick={onClose} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
