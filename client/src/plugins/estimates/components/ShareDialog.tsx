import { Share, Copy, Check, X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  estimateNumber: string;
}

export function ShareDialog({ isOpen, onClose, shareUrl, estimateNumber }: ShareDialogProps) {
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

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Share className="w-5 h-5 text-blue-600" />
            Estimate Share
          </AlertDialogTitle>
          <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Anyone with this link can view estimate{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">{estimateNumber}</span>
              .
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <label htmlFor="share-url" className="sr-only">
                Share URL
              </label>
              <div className="flex items-center rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2">
                <p className="text-sm font-mono break-all select-all text-gray-700 dark:text-gray-300">
                  {shareUrl}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="px-3"
              onClick={handleCopy}
              variant={copied ? 'secondary' : 'default'}
            >
              <span className="sr-only">Copy</span>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              <span className="ml-2">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
