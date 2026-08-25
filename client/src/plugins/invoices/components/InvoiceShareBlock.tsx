import { Check, Copy, ExternalLink, Share } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DETAIL_QUICK_ACTION_ROW_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { ShareDialog } from '@/plugins/estimates/components/ShareDialog';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice } from '../context/InvoicesContext';

interface InvoiceShare {
  id: string;
  invoiceId: string;
  shareToken: string;
  validUntil: string;
  createdAt: string;
  accessedCount: number;
  lastAccessedAt?: string;
}

interface InvoiceShareContextValue {
  existingShare: InvoiceShare | null;
  isCreatingShare: boolean;
  openCreateShare: () => void;
  openShareDialog: () => void;
  handleCopyShareUrl: () => void;
  handleRevokeShare: () => void;
}

const InvoiceShareContext = createContext<InvoiceShareContextValue | null>(null);

function useInvoiceShareContext(): InvoiceShareContextValue {
  const ctx = useContext(InvoiceShareContext);
  if (!ctx) {
    throw new Error('Invoice share components must be used within InvoiceShareProvider');
  }
  return ctx;
}

function generateShareUrl(shareToken: string): string {
  return `${window.location.origin}/public/invoice/${shareToken}`;
}

function defaultValidUntilDate(): string {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return thirtyDaysFromNow.toISOString().split('T')[0];
}

export function InvoiceShareProvider({
  invoice,
  children,
}: {
  invoice: Invoice;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [existingShare, setExistingShare] = useState<InvoiceShare | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [showCreateShareModal, setShowCreateShareModal] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareValidUntil, setShareValidUntil] = useState(defaultValidUntilDate);

  const loadExistingShare = useCallback(async () => {
    try {
      const shares = await invoicesApi.getShares(invoice.id);
      const activeShare = shares.find(
        (share: InvoiceShare) => new Date(share.validUntil) > new Date(),
      );
      setExistingShare(activeShare || null);
    } catch (error) {
      console.error('Failed to load existing shares:', error);
    }
  }, [invoice.id]);

  useEffect(() => {
    void loadExistingShare();
  }, [loadExistingShare]);

  const openCreateShare = useCallback(() => {
    if (existingShare && new Date(existingShare.validUntil) > new Date()) {
      setShowShareDialog(true);
      return;
    }
    setShareValidUntil(defaultValidUntilDate());
    setShowCreateShareModal(true);
  }, [existingShare]);

  const openShareDialog = useCallback(() => {
    if (existingShare) {
      setShowShareDialog(true);
    }
  }, [existingShare]);

  const handleCreateShare = useCallback(async () => {
    if (!shareValidUntil) {
      return;
    }
    try {
      setIsCreatingShare(true);
      const share = await invoicesApi.createShare(invoice.id, shareValidUntil);
      setExistingShare(share);
      setShowCreateShareModal(false);
      setShowShareDialog(true);
    } catch (error) {
      console.error('Failed to create share:', error);
      alert(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  }, [invoice.id, shareValidUntil]);

  const handleCopyShareUrl = useCallback(() => {
    if (!existingShare) {
      return;
    }
    const url = generateShareUrl(existingShare.shareToken);
    void navigator.clipboard.writeText(url);
  }, [existingShare]);

  const handleRevokeShare = useCallback(async () => {
    if (!existingShare) {
      return;
    }
    try {
      await invoicesApi.revokeShare(existingShare.id);
      setExistingShare(null);
      setShowShareDialog(false);
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke share link');
    }
  }, [existingShare]);

  const value = useMemo(
    () => ({
      existingShare,
      isCreatingShare,
      openCreateShare,
      openShareDialog,
      handleCopyShareUrl,
      handleRevokeShare,
    }),
    [
      existingShare,
      isCreatingShare,
      openCreateShare,
      openShareDialog,
      handleCopyShareUrl,
      handleRevokeShare,
    ],
  );

  const shareUrl = existingShare ? generateShareUrl(existingShare.shareToken) : '';
  const entityLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);

  return (
    <InvoiceShareContext.Provider value={value}>
      {children}

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        shareUrl={shareUrl}
        entityLabel={entityLabel}
        variant="invoice"
      />

      <AlertDialog
        open={showCreateShareModal}
        onOpenChange={(open) => !open && setShowCreateShareModal(false)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Share className="h-5 w-5 text-blue-600" />
              {t('invoices.createShareTitle')}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('invoices.createShareHelp')}</p>
            <p className="text-xs text-muted-foreground">
              {t('nav.invoice')} {entityLabel}
            </p>
            <div>
              <Label htmlFor="invoice-share-valid-until" className="mb-1">
                {t('invoices.validUntil')}
              </Label>
              <Input
                id="invoice-share-valid-until"
                type="date"
                value={shareValidUntil}
                onChange={(e) => setShareValidUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <p className="text-xs italic text-muted-foreground">
              {t('invoices.createShareClipboard')}
            </p>
          </div>
          <AlertDialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setShowCreateShareModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCreateShare()}
              disabled={isCreatingShare || !shareValidUntil}
            >
              {isCreatingShare ? t('common.creating') : t('invoices.createShare')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InvoiceShareContext.Provider>
  );
}

/** Share / View button for the Export options sidebar. */
export function InvoiceShareExportButton() {
  const { t } = useTranslation();
  const { existingShare, isCreatingShare, openCreateShare, openShareDialog } =
    useInvoiceShareContext();
  const hasActiveShare = Boolean(existingShare && new Date(existingShare.validUntil) > new Date());

  if (hasActiveShare) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={(props) => (
          <ExternalLink
            {...props}
            className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
          />
        )}
        className={DETAIL_QUICK_ACTION_ROW_CLASS}
        onClick={openShareDialog}
      >
        {t('invoices.viewShare')}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={(props) => (
        <Share {...props} className={cn(props.className, 'text-green-600 dark:text-green-400')} />
      )}
      className={cn(DETAIL_QUICK_ACTION_ROW_CLASS, 'disabled:opacity-50')}
      onClick={openCreateShare}
      disabled={isCreatingShare}
    >
      {isCreatingShare ? t('common.creating') : t('invoices.shareInvoice')}
    </Button>
  );
}

/** Active link panel for the main content column (mirrors NoteShareBlock / TaskShareBlock). */
export function InvoiceShareBlock() {
  const { t, i18n } = useTranslation();
  const { existingShare, handleCopyShareUrl, handleRevokeShare } = useInvoiceShareContext();
  const [copied, setCopied] = useState(false);

  if (!existingShare) {
    return null;
  }

  const shareUrl = generateShareUrl(existingShare.shareToken);
  const isShareExpired = new Date(existingShare.validUntil) <= new Date();
  const validUntilLabel = new Date(existingShare.validUntil).toLocaleDateString(i18n.language);

  const handleCopy = () => {
    handleCopyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        isShareExpired
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
          : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
      }`}
    >
      <div
        className={`mb-2 text-sm font-medium ${
          isShareExpired ? 'text-red-900 dark:text-red-400' : 'text-blue-900 dark:text-blue-400'
        }`}
      >
        {isShareExpired ? t('invoices.shareExpired') : t('invoices.shareActive')}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <div className="flex-1 break-all rounded border border-gray-200 bg-white p-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {shareUrl}
        </div>
        {!isShareExpired && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              className={`h-9 px-3 text-xs ${
                copied ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : ''
              }`}
            >
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={ExternalLink}
              onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
              className="h-9 px-3 text-xs"
            >
              {t('common.view')}
            </Button>
          </div>
        )}
      </div>

      <div
        className={`text-xs ${isShareExpired ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}
      >
        <div className="flex items-center justify-left">
          <div>
            {isShareExpired ? t('invoices.expiredOn') : t('invoices.expiresOn')} {validUntilLabel}
            {existingShare.accessedCount > 0 && (
              <span className="ml-2">
                • {t('invoices.accessedCount', { count: existingShare.accessedCount })}
              </span>
            )}
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={() => void handleRevokeShare()}
            className="ml-4 h-auto p-0 font-normal text-red-600 underline decoration-red-600/30 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {t('invoices.revokeShare')}
          </Button>
        </div>
      </div>
    </div>
  );
}
