import { Download } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DETAIL_QUICK_ACTION_ROW_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice } from '../context/InvoicesContext';

interface InvoiceActionsProps {
  invoice: Invoice;
  /** When true, only PDF download (share lives in InvoiceShareExportButton). */
  exportOnly?: boolean;
}

export function InvoiceActions({ invoice, exportOnly = false }: InvoiceActionsProps) {
  const { t } = useTranslation();
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  if (!exportOnly) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={(props) => (
        <Download {...props} className={cn(props.className, 'text-blue-600 dark:text-blue-400')} />
      )}
      className={cn(DETAIL_QUICK_ACTION_ROW_CLASS, 'disabled:opacity-50')}
      onClick={() => void handleDownloadPDF()}
      disabled={isDownloadingPDF}
    >
      {isDownloadingPDF
        ? t('invoices.generatingPdf', { defaultValue: 'Generating PDF…' })
        : t('invoices.downloadPdf', { defaultValue: 'Download PDF' })}
    </Button>
  );
}
