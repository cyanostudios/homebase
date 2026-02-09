import React from 'react';
import { Button } from '@/components/ui/button';

interface InvoiceStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  status: string;
  invoiceNumber: string;
}

export function InvoiceStatusModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  status, 
  invoiceNumber 
}: InvoiceStatusModalProps) {
  if (!isOpen) return null;

  const getModalContent = () => {
    switch (status) {
      case 'sent':
        return {
          title: 'Mark invoice as sent?',
          message: 'This will change the status to "Sent" and indicate that the invoice has been delivered to the customer.',
          helpText: 'You can change it back to "Draft" at any time if needed.',
          buttonText: 'Mark as Sent',
        };
      case 'paid':
        return {
          title: 'Mark invoice as paid?',
          message: 'This will change the status to "Paid" and record that payment has been received.',
          helpText: 'This action can be undone if needed.',
          buttonText: 'Mark as Paid',
        };
      case 'overdue':
        return {
          title: 'Mark invoice as overdue?',
          message: 'This will change the status to "Overdue" indicating payment is late.',
          helpText: 'You can update to "Paid" once payment is received.',
          buttonText: 'Mark as Overdue',
        };
      case 'canceled':
        return {
          title: 'Mark invoice as canceled?',
          message: 'This will change the status to "Canceled" and indicate the invoice is no longer valid.',
          helpText: 'This action can be undone if needed.',
          buttonText: 'Mark as Canceled',
        };
      default:
        return {
          title: `Change invoice status to ${status}?`,
          message: `This will update the invoice status to "${status}".`,
          helpText: 'This action can be undone if needed.',
          buttonText: `Mark as ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        };
    }
  };

  const content = getModalContent();

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{content.title}</h2>
            <p className="text-xs text-muted-foreground">Invoice {invoiceNumber}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            {content.message}
          </p>
          <p className="text-xs text-muted-foreground italic">
            {content.helpText}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
          >
            {content.buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}