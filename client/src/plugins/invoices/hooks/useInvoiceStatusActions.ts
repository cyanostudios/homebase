import { useState } from 'react';
import { useInvoicesContext } from '../context/InvoicesContext';
import { Invoice } from '../types/invoices';

export function useInvoiceStatusActions() {
  const { saveInvoice } = useInvoicesContext();
  
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);

  const handleStatusChange = (invoice: Invoice, newStatus: string) => {
    // For 'draft' status, change immediately without confirmation
    if (newStatus === 'draft') {
      updateInvoiceStatus(invoice, newStatus);
      return;
    }

    // For all other statuses, show confirmation modal
    setPendingInvoice(invoice);
    setPendingStatus(newStatus);
    setShowStatusModal(true);
  };

  const handleModalConfirm = async () => {
    if (pendingInvoice && pendingStatus) {
      await updateInvoiceStatus(pendingInvoice, pendingStatus);
    }
    handleModalCancel();
  };

  const handleModalCancel = () => {
    setShowStatusModal(false);
    setPendingStatus(null);
    setPendingInvoice(null);
  };

  const updateInvoiceStatus = async (invoice: Invoice, newStatus: string) => {
    const updateData = {
      ...invoice,
      status: newStatus,
      // Handle special status transitions
      ...(newStatus === 'sent' && !invoice.invoiceNumber && {
        // Backend will auto-generate invoice number when status becomes 'sent'
      }),
      ...(newStatus === 'paid' && {
        paidAt: new Date().toISOString(),
      }),
    };

    try {
      await saveInvoice(updateData);
    } catch (error) {
      console.error('Failed to update invoice status:', error);
      // Could add error handling/notification here
    }
  };

  return {
    showStatusModal,
    pendingStatus,
    pendingInvoice,
    handleStatusChange,
    handleModalConfirm,
    handleModalCancel,
  };
}