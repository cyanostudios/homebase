import { useState } from 'react';

import { Estimate } from '../types/estimate';

import { useEstimates } from './useEstimates';

export function useEstimateStatusActions() {
  const { saveEstimate } = useEstimates();

  // Status modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSentConfirmation, setShowSentConfirmation] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'accepted' | 'rejected' | null>(null);

  // Format validTo date to prevent timezone issues
  const formatValidTo = (dateValue: any) => {
    if (!dateValue) {
      return null;
    }
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return date.toLocaleDateString('sv-SE'); // Swedish locale gives YYYY-MM-DD format
  };

  // Perform status change with proper date handling
  const performStatusChange = async (
    estimate: Estimate,
    newStatus: string,
    reasons: string[] = [],
  ) => {
    try {
      const updatedData = {
        contactId: estimate.contactId,
        contactName: estimate.contactName,
        organizationNumber: estimate.organizationNumber,
        currency: estimate.currency,
        lineItems: estimate.lineItems,
        estimateDiscount: estimate.estimateDiscount || 0,
        notes: estimate.notes,
        validTo: formatValidTo(estimate.validTo),
        status: newStatus,
        acceptanceReasons: newStatus === 'accepted' ? reasons : estimate.acceptanceReasons,
        rejectionReasons: newStatus === 'rejected' ? reasons : estimate.rejectionReasons,
      };

      const success = await saveEstimate(updatedData);

      if (!success) {
        alert('Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  // Handle status change with appropriate confirmations
  const handleStatusChange = async (estimate: Estimate, newStatus: string) => {
    if (newStatus === 'sent' && estimate.status !== 'sent') {
      setShowSentConfirmation(true);
      return;
    }

    if ((newStatus === 'accepted' || newStatus === 'rejected') && estimate.status !== newStatus) {
      setPendingStatus(newStatus);
      setShowStatusModal(true);
      return;
    }

    // Direct change for draft
    await performStatusChange(estimate, newStatus, []);
  };

  // Handle sent confirmation
  const handleSentConfirm = async (estimate: Estimate) => {
    setShowSentConfirmation(false);
    await performStatusChange(estimate, 'sent', []);
  };

  const handleSentCancel = () => {
    setShowSentConfirmation(false);
  };

  // Handle reason modal confirmation
  const handleModalConfirm = async (estimate: Estimate, reasons: string[]) => {
    if (pendingStatus) {
      await performStatusChange(estimate, pendingStatus, reasons);
    }
    setShowStatusModal(false);
    setPendingStatus(null);
  };

  const handleModalCancel = () => {
    setShowStatusModal(false);
    setPendingStatus(null);
  };

  return {
    // States
    showStatusModal,
    showSentConfirmation,
    pendingStatus,

    // Actions
    handleStatusChange,
    handleSentConfirm,
    handleSentCancel,
    handleModalConfirm,
    handleModalCancel,
  };
}
