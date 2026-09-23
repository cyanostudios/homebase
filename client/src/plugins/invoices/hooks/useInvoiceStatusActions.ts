import { useCallback, useState } from 'react';

import { useInvoicesContext, type Invoice } from '../context/InvoicesContext';
import { buildInvoiceStatusUpdatePayload, isInvoiceIssued } from '../utils/invoiceMlCompliance';

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
      // Issued: status-only PUT (QA B2). Never unlock via draft (QA B1).
      if (isInvoiceIssued(invoice.status)) {
        const issuedPayload = buildInvoiceStatusUpdatePayload(invoice, newStatus);
        if (!issuedPayload) {
          return;
        }
        await saveInvoice(issuedPayload);
        return;
      }

      // Draft → leave-draft / issue still needs full document fields.
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
        supplyDate: toIsoDate(invoice.supplyDate),
        dueDate: toIsoDate(invoice.dueDate),
        invoiceType: invoice.invoiceType ?? 'invoice',
        estimateId: invoice.estimateId ?? null,
        contentProfile: invoice.contentProfile,
        creditedInvoiceId: invoice.creditedInvoiceId,
        creditedInvoiceNumber: invoice.creditedInvoiceNumber,
        correctionSummary: invoice.correctionSummary,
        status: newStatus,
      };

      await saveInvoice(updateData);
    },
    [saveInvoice],
  );

  const handleStatusChange = useCallback(
    (invoice: Invoice, newStatus: string) => {
      if (isInvoiceIssued(invoice.status) && newStatus === 'draft') {
        return;
      }

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
