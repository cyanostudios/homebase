import { Check, Stamp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DialogActionButton, DialogCancelButton } from '@/core/ui/DialogRoundButtons';
import {
  DIALOG_BODY_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
  DIALOG_TITLE_CLASS,
} from '@/core/ui/dialogStyles';

interface InvoiceStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  status: string;
  invoiceNumber: string;
  /** True when current document is draft and next status leaves draft (issue / lock). */
  isIssuing?: boolean;
}

export function InvoiceStatusModal({
  isOpen,
  onClose,
  onConfirm,
  status,
  invoiceNumber,
  isIssuing = false,
}: InvoiceStatusModalProps) {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  const getModalContent = () => {
    if (isIssuing) {
      return {
        title: t('invoices.issueConfirmTitle', { defaultValue: 'Issue document?' }),
        message: t('invoices.issueConfirmMessage', {
          defaultValue:
            'After issuing, invoice content cannot be edited. A locked archive copy will be stored. Use a credit note to correct.',
        }),
        helpText: t('invoices.issueConfirmHelp', {
          defaultValue: 'This cannot be undone by switching status back to draft.',
        }),
        buttonText: t('invoices.issue', { defaultValue: 'Issue' }),
        buttonIcon: Stamp,
        buttonVariant: 'successSoft' as const,
      };
    }

    switch (status) {
      case 'sent':
        return {
          title: t('invoices.statusModal.sentTitle', {
            defaultValue: 'Mark invoice as sent?',
          }),
          message: t('invoices.statusModal.sentMessage', {
            defaultValue:
              'This will change the status to "Sent" and indicate that the invoice has been delivered to the customer.',
          }),
          helpText: t('invoices.statusModal.sentHelp', {
            defaultValue: 'You can change it back to "Draft" at any time if needed.',
          }),
          buttonText: t('invoices.statusModal.sentAction', { defaultValue: 'Mark as Sent' }),
          buttonIcon: Check,
          buttonVariant: 'primary' as const,
        };
      case 'paid':
        return {
          title: t('invoices.statusModal.paidTitle', {
            defaultValue: 'Mark invoice as paid?',
          }),
          message: t('invoices.statusModal.paidMessage', {
            defaultValue:
              'This will change the status to "Paid" and record that payment has been received.',
          }),
          helpText: t('invoices.statusModal.paidHelp', {
            defaultValue: 'This action can be undone if needed.',
          }),
          buttonText: t('invoices.statusModal.paidAction', { defaultValue: 'Mark as Paid' }),
          buttonIcon: Check,
          buttonVariant: 'primary' as const,
        };
      case 'partially_paid':
        return {
          title: t('invoices.statusModal.partiallyPaidTitle', {
            defaultValue: 'Mark invoice as partially paid?',
          }),
          message: t('invoices.statusModal.partiallyPaidMessage', {
            defaultValue:
              'This will change the status to "Partially paid" indicating that some payment has been received.',
          }),
          helpText: t('invoices.statusModal.partiallyPaidHelp', {
            defaultValue: 'You can update to "Paid" once the full amount is received.',
          }),
          buttonText: t('invoices.statusModal.partiallyPaidAction', {
            defaultValue: 'Mark as Partially paid',
          }),
          buttonIcon: Check,
          buttonVariant: 'primary' as const,
        };
      case 'overdue':
        return {
          title: t('invoices.statusModal.overdueTitle', {
            defaultValue: 'Mark invoice as overdue?',
          }),
          message: t('invoices.statusModal.overdueMessage', {
            defaultValue: 'This will change the status to "Overdue" indicating payment is late.',
          }),
          helpText: t('invoices.statusModal.overdueHelp', {
            defaultValue: 'You can update to "Paid" once payment is received.',
          }),
          buttonText: t('invoices.statusModal.overdueAction', {
            defaultValue: 'Mark as Overdue',
          }),
          buttonIcon: Check,
          buttonVariant: 'primary' as const,
        };
      case 'canceled':
        return {
          title: t('invoices.statusModal.canceledTitle', {
            defaultValue: 'Mark invoice as canceled?',
          }),
          message: t('invoices.statusModal.canceledMessage', {
            defaultValue:
              'This will change the status to "Canceled" and indicate the invoice is no longer valid.',
          }),
          helpText: t('invoices.statusModal.canceledHelp', {
            defaultValue: 'This action can be undone if needed.',
          }),
          buttonText: t('invoices.statusModal.canceledAction', {
            defaultValue: 'Mark as Canceled',
          }),
          buttonIcon: Check,
          buttonVariant: 'primary' as const,
        };
      default:
        return {
          title: t('invoices.statusModal.defaultTitle', {
            status,
            defaultValue: 'Change invoice status to {{status}}?',
          }),
          message: t('invoices.statusModal.defaultMessage', {
            status,
            defaultValue: 'This will update the invoice status to "{{status}}".',
          }),
          helpText: t('invoices.statusModal.defaultHelp', {
            defaultValue: 'This action can be undone if needed.',
          }),
          buttonText: t('invoices.statusModal.defaultAction', {
            status: status.charAt(0).toUpperCase() + status.slice(1),
            defaultValue: 'Mark as {{status}}',
          }),
          buttonIcon: Check,
          buttonVariant: 'primary' as const,
        };
    }
  };

  const content = getModalContent();

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full">
        <div className={DIALOG_HEADER_CLASS}>
          <div>
            <h2 className={DIALOG_TITLE_CLASS}>{content.title}</h2>
            <p className={DIALOG_SUBTITLE_CLASS}>
              {t('invoices.statusModal.invoiceLabel', {
                number: invoiceNumber,
                defaultValue: 'Invoice {{number}}',
              })}
            </p>
          </div>
        </div>

        <div className={`${DIALOG_BODY_CLASS} space-y-4`}>
          <p className="text-sm text-muted-foreground">{content.message}</p>
          <p className="text-xs text-muted-foreground italic">{content.helpText}</p>
        </div>
        <div className={DIALOG_FOOTER_CLASS}>
          <DialogCancelButton onClick={onClose} />
          <DialogActionButton
            icon={content.buttonIcon}
            label={content.buttonText}
            variant={content.buttonVariant}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  );
}
