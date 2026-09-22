import React from 'react';

import type { Contact } from '@/plugins/contacts/types/contacts';
import { InvoiceCustomerSelect } from '@/plugins/invoices/components/InvoiceCustomerSelect';

interface EstimateCustomerSelectProps {
  contactId?: string | null;
  contactName?: string;
  estimateNumber?: string | number | null;
  editable: boolean;
  onCustomerChange: (contact: Contact | null) => void;
  errorMessage?: string | null;
}

/** Invoice customer picker with estimate-specific prop names. */
export function EstimateCustomerSelect({
  contactId,
  contactName,
  estimateNumber,
  editable,
  onCustomerChange,
  errorMessage,
}: EstimateCustomerSelectProps) {
  return (
    <InvoiceCustomerSelect
      contactId={contactId}
      contactName={contactName}
      invoiceNumber={estimateNumber}
      editable={editable}
      onCustomerChange={onCustomerChange}
      errorMessage={errorMessage}
    />
  );
}
