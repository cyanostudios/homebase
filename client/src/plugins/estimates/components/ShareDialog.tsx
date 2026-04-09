import { Share, Copy, Check, X, ExternalLink } from 'lucide-react';
import React from 'react';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  /** Label shown in copy (estimate number, note title, etc.) */
  entityLabel: string;
  /** Controls title and wording */
  variant?: 'estimate' | 'note';
}

export function ShareDialog({
  isOpen,
  onClose,
  shareUrl,
  entityLabel,
  variant = 'estimate',
}: ShareDialogProps) {
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

  const title = variant === 'note' ? 'Note Share' : 'Estimate Share';
  const entityWord = variant === 'note' ? 'note' : 'estimate';

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Share className="w-5 h-5 text-blue-600" />
            {title}
          </AlertDialogTitle>
          <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Anyone with this link can view {entityWord}{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{entityLabel}</span>.
          </p>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-sm font-mono break-all select-all text-foreground">{shareUrl}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              className={`h-9 text-xs px-3 ${copied ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : ''}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ExternalLink}
              onClick={handleView}
              className="h-9 text-xs px-3"
            >
              View
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose} className="h-9 text-xs px-3">
              Close
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
