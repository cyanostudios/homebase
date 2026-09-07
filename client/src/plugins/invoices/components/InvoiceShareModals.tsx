import { Share } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { DatePicker, formatDateInputValue, parseDateInputValue } from '@/core/ui/DatePicker';
import { DialogCancelButton, DialogSaveButton } from '@/core/ui/DialogRoundButtons';
import { ShareDialog } from '@/plugins/estimates/components/ShareDialog';

import { useInvoices } from '../hooks/useInvoices';

/** Share create/view dialogs (used from detail header and list quick context). */
export function InvoiceShareModals({ entityLabel }: { entityLabel: string }) {
  const { t } = useTranslation();
  const {
    invoiceShare,
    isCreatingInvoiceShare,
    showCreateInvoiceShareModal,
    setShowCreateInvoiceShareModal,
    showInvoiceShareDialog,
    setShowInvoiceShareDialog,
    shareValidUntil,
    setShareValidUntil,
    handleCreateInvoiceShare,
  } = useInvoices();

  const shareUrl = invoiceShare
    ? `${window.location.origin}/public/invoice/${invoiceShare.shareToken}`
    : '';

  return (
    <>
      <ShareDialog
        isOpen={showInvoiceShareDialog}
        onClose={() => setShowInvoiceShareDialog(false)}
        shareUrl={shareUrl}
        entityLabel={entityLabel}
        variant="invoice"
      />

      <AlertDialog
        open={showCreateInvoiceShareModal}
        onOpenChange={(open) => !open && setShowCreateInvoiceShareModal(false)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
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
              <DatePicker
                id="invoice-share-valid-until"
                value={parseDateInputValue(shareValidUntil)}
                onChange={(date) => setShareValidUntil(formatDateInputValue(date))}
                placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
                clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
                variant="default"
                fullWidth
                minDate={new Date()}
              />
            </div>
            <p className="text-xs italic text-muted-foreground">
              {t('invoices.createShareClipboard')}
            </p>
          </div>
          <AlertDialogFooter>
            <DialogCancelButton onClick={() => setShowCreateInvoiceShareModal(false)} />
            <DialogSaveButton
              label={isCreatingInvoiceShare ? t('common.creating') : t('invoices.createShare')}
              onClick={() => void handleCreateInvoiceShare()}
              disabled={isCreatingInvoiceShare || !shareValidUntil}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
