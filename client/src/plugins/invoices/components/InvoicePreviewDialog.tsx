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
import { AlertDialogRoundCancel } from '@/core/ui/DialogRoundButtons';

import { InvoiceDocumentPreview, type InvoicePreviewFormData } from './InvoiceDocumentPreview';

interface InvoicePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formData: InvoicePreviewFormData;
  /** Existing invoice id / number when editing a saved invoice. */
  invoiceId?: string | number | null;
  invoiceNumber?: string | number | null;
}

/** Modal invoice preview (legacy). Prefer the live column preview in edit/create. */
export function InvoicePreviewDialog({
  isOpen,
  onClose,
  formData,
  invoiceId,
  invoiceNumber,
}: InvoicePreviewDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="flex h-[90vh] max-h-[90vh] w-[min(960px,95vw)] max-w-[960px] flex-col gap-3 overflow-hidden px-5 py-5 sm:rounded-lg sm:px-6 sm:py-6">
        <AlertDialogHeader className="shrink-0 space-y-1 text-left">
          <AlertDialogTitle>
            {t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('invoices.previewHelp', {
              defaultValue: 'This is how the invoice will look when shared or exported as PDF.',
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isOpen ? (
          <InvoiceDocumentPreview
            formData={formData}
            invoiceId={invoiceId}
            invoiceNumber={invoiceNumber}
            className="min-h-0 flex-1"
          />
        ) : null}

        <AlertDialogFooter className="shrink-0">
          <AlertDialogRoundCancel close onClick={onClose} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
