import { Share, Copy, Check, Download } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { invoicesApi } from '../api/invoicesApi';
import { useInvoiceStatusActions } from '../hooks/useInvoiceStatusActions';
import { Invoice } from '../types/invoices';

import { InvoiceStatusButtons } from './InvoiceStatusButtons';
import { InvoiceStatusModal } from './InvoiceStatusModal';

interface InvoiceShare {
  id: string;
  invoiceId: string;
  shareToken: string;
  validUntil: string;
  createdAt: string;
  accessedCount: number;
  lastAccessedAt?: string;
}

interface InvoiceActionsProps {
  invoice: Invoice;
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  // Status actions
  const {
    showStatusModal,
    pendingStatus,
    pendingInvoice,
    handleStatusChange,
    handleModalConfirm,
    handleModalCancel,
  } = useInvoiceStatusActions();

  // Share state
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [existingShare, setExistingShare] = useState<InvoiceShare | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreateShareModal, setShowCreateShareModal] = useState(false);
  const [shareValidUntil, setShareValidUntil] = useState('');

  // PDF state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  // Load existing share when component mounts
  useEffect(() => {
    loadExistingShare();
  }, [invoice.id]);

  // Initialize share expiry date to 30 days from now
  useEffect(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    setShareValidUntil(thirtyDaysFromNow.toISOString().split('T')[0]);
  }, []);

  const loadExistingShare = async () => {
    try {
      const shares = await invoicesApi.getShares(invoice.id);
      // Get the most recent active share (not expired)
      const activeShare = shares.find(
        (share: InvoiceShare) => new Date(share.validUntil) > new Date(),
      );
      setExistingShare(activeShare || null);
    } catch (error) {
      console.error('Failed to load existing shares:', error);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Handle share creation
  const handleCreateShare = async () => {
    if (!shareValidUntil) {
      return;
    }

    try {
      setIsCreatingShare(true);

      const share = await invoicesApi.createShare(invoice.id, shareValidUntil);
      setExistingShare(share);
      setShowCreateShareModal(false);

      const url = generateShareUrl(share.shareToken);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Failed to create share:', error);
      alert(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

  // Handle copy share URL
  const handleCopyUrl = async () => {
    if (!existingShare) {
      return;
    }

    try {
      const url = generateShareUrl(existingShare.shareToken);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Handle revoke share
  const handleRevokeShare = async () => {
    if (!existingShare) {
      return;
    }

    try {
      await invoicesApi.revokeShare(existingShare.id);
      setExistingShare(null);
    } catch (error) {
      console.error('Failed to revoke share:', error);
      alert('Failed to revoke share link');
    }
  };

  // Generate share URL
  const generateShareUrl = (shareToken: string) => {
    return `${window.location.origin}/api/invoices/public/${shareToken}`;
  };

  const shareUrl = existingShare ? generateShareUrl(existingShare.shareToken) : '';
  const isShareExpired = existingShare ? new Date(existingShare.validUntil) <= new Date() : false;

  return (
    <>
      {/* Status Actions */}
      <InvoiceStatusButtons
        invoice={invoice}
        onStatusChange={(status) => handleStatusChange(invoice, status)}
      />

      {/* Other Actions */}
      <div>
        <div className="text-xs font-medium text-foreground mb-2">Other Actions</div>
        <div className="flex flex-wrap gap-3">
          {!existingShare && (
            <Button
              variant="secondary"
              size="sm"
              icon={Share}
              onClick={() => setShowCreateShareModal(true)}
            >
              Share Invoice
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={handleDownloadPDF}
            disabled={isDownloadingPDF}
          >
            {isDownloadingPDF ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Share URL Display */}
      {existingShare && (
        <div
          className={`mt-4 p-4 rounded-lg border ${
            isShareExpired
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div
            className={`text-sm font-medium mb-2 ${
              isShareExpired ? 'text-red-900 dark:text-red-400' : 'text-blue-900 dark:text-blue-400'
            }`}
          >
            {isShareExpired ? 'Share Link Expired' : 'Active Share Link'}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 p-2 bg-background rounded border border-border text-sm font-mono break-all text-foreground">
              {shareUrl}
            </div>
            {!isShareExpired && (
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopyUrl}
                className={
                  copied
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : ''
                }
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
          </div>

          <div
            className={`text-xs ${
              isShareExpired ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                {isShareExpired ? 'Expired on' : 'Expires on'}{' '}
                {new Date(existingShare.validUntil).toLocaleDateString()}
                {existingShare.accessedCount > 0 && (
                  <span className="ml-2">• Accessed {existingShare.accessedCount} times</span>
                )}
              </div>
              <button
                onClick={handleRevokeShare}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs underline"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      <InvoiceStatusModal
        isOpen={showStatusModal}
        onClose={handleModalCancel}
        onConfirm={handleModalConfirm}
        status={pendingStatus || ''}
        invoiceNumber={formatDisplayNumber('invoices', pendingInvoice?.invoiceNumber || pendingInvoice?.id || '')}
      />

      {/* Create Share Modal */}
      {showCreateShareModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Create Share Link</h2>
                <p className="text-xs text-muted-foreground">
                  Invoice {formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Create a secure link to share this invoice with your customer or stakeholders.
              </p>

              <div className="mb-4">
                <Label htmlFor="share-valid-until" className="mb-1">
                  Valid Until
                </Label>
                <Input
                  id="share-valid-until"
                  type="date"
                  value={shareValidUntil}
                  onChange={(e) => setShareValidUntil(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <p className="text-xs text-muted-foreground italic">
                The link will be automatically copied to your clipboard when created.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setShowCreateShareModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateShare}
                disabled={isCreatingShare || !shareValidUntil}
              >
                {isCreatingShare ? 'Creating...' : 'Create Share Link'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
