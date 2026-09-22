import React from 'react';

import { ShareDialog } from '@/plugins/estimates/components/ShareDialog';

import { useInvoices } from '../hooks/useInvoices';

/** Share result dialog (Export → Share). Create is one-click like Tasks — no date modal. */
export function InvoiceShareModals({ entityLabel }: { entityLabel: string }) {
  const { invoiceShare, showInvoiceShareDialog, setShowInvoiceShareDialog } = useInvoices();

  const shareUrl = invoiceShare
    ? `${window.location.origin}/public/invoice/${invoiceShare.shareToken}`
    : '';

  return (
    <ShareDialog
      isOpen={showInvoiceShareDialog}
      onClose={() => setShowInvoiceShareDialog(false)}
      shareUrl={shareUrl}
      entityLabel={entityLabel}
      variant="invoice"
    />
  );
}
