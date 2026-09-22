import { useCallback, useState } from 'react';

import { useInvoicesContext } from '../context/InvoicesContext';
import { Invoice } from '../types/invoices';

function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function useInvoiceStatusActions() {
  const { saveInvoice } = useInvoicesContext();

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);

  const updateInvoiceStatus = useCallback(
    async (invoice: Invoice, newStatus: string) => {
      // Build an explicit update payload with id so preview-mode (no currentInvoice) still PUTs.
      const updateData = {
        id: invoice.id,
        contactId: invoice.contactId ?? null,
        contactName: invoice.contactName ?? '',
        organizationNumber: invoice.organizationNumber ?? '',
        currency: invoice.currency ?? 'SEK',
        lineItems: invoice.lineItems ?? [],
        invoiceDiscount: invoice.invoiceDiscount ?? 0,
        notes: invoice.notes ?? '',
        paymentTerms: invoice.paymentTerms ?? '',
        orderNumber: invoice.orderNumber ?? '',
        deliveryMethod: invoice.deliveryMethod ?? '',
        issueDate: toIsoDate(invoice.issueDate),
        dueDate: toIsoDate(invoice.dueDate),
        invoiceType: invoice.invoiceType ?? 'invoice',
        estimateId: invoice.estimateId ?? null,
        status: newStatus,
        ...(newStatus === 'paid' ? { paidAt: new Date().toISOString() } : {}),
      };

      const ok = await saveInvoice(updateData);
      if (!ok) {
        alert('Failed to update invoice status. Please try again.');
      }
    },
    [saveInvoice],
  );

  const handleStatusChange = useCallback(
    (invoice: Invoice, newStatus: string) => {
      if (newStatus === 'draft') {
        void updateInvoiceStatus(invoice, newStatus);
        return;
      }

      setPendingInvoice(invoice);
      setPendingStatus(newStatus);
      setShowStatusModal(true);
    },
    [updateInvoiceStatus],
  );

  const handleModalCancel = useCallback(() => {
    setShowStatusModal(false);
    setPendingStatus(null);
    setPendingInvoice(null);
  }, []);

  const handleModalConfirm = useCallback(async () => {
    if (pendingInvoice && pendingStatus) {
      await updateInvoiceStatus(pendingInvoice, pendingStatus);
    }
    handleModalCancel();
  }, [pendingInvoice, pendingStatus, updateInvoiceStatus, handleModalCancel]);

  return {
    showStatusModal,
    pendingStatus,
    pendingInvoice,
    handleStatusChange,
    handleModalConfirm,
    handleModalCancel,
  };
}
