import { Download } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { dedupeInFlightByKey } from '@/core/utils/dedupeInFlightByKey';
import { cn } from '@/lib/utils';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice } from '../types/invoices';
import { generateInvoiceWebHTML } from '../webTemplate';

import {
  formatInvoiceStatusForDisplay,
  INVOICE_STATUS_BADGE_CLASS,
  INVOICE_STATUS_COLORS,
} from './InvoiceStatusSelect';

interface PublicInvoiceViewProps {
  token: string;
}

type PublicInvoice = Invoice & {
  shareValidUntil?: Date | string;
  accessedCount?: number;
  organization?: unknown;
};

function triggerPdfDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function PublicInvoiceView({ token }: PublicInvoiceViewProps) {
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const key = `public-invoice:${token}:${loadAttempt}`;
        const publicInvoice = await dedupeInFlightByKey(key, () =>
          invoicesApi.getPublicInvoice(token),
        );
        if (!cancelled) {
          if (publicInvoice?.error) {
            throw new Error(publicInvoice.error);
          }
          setInvoice(publicInvoice);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load invoice');
          setInvoice(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, loadAttempt]);

  const handleDownloadPdf = async () => {
    if (!invoice || isDownloadingPdf) {
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const blob = await invoicesApi.downloadPublicPdf(token);
      const numberLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);
      triggerPdfDownload(blob, `faktura-${numberLabel}.pdf`);
    } catch (err) {
      console.error('Failed to download public invoice PDF', err);
      alert(err instanceof Error ? err.message : 'Kunde inte ladda ner PDF. Försök igen.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Laddar faktura...</div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Faktura ej tillgänglig</h2>
            <p className="text-gray-600 mb-4">
              {error || 'Fakturan hittades inte eller delningslänken har gått ut.'}
            </p>
            <Button
              variant="default"
              onClick={() => {
                setLoadAttempt((n) => n + 1);
              }}
              className="mr-2"
            >
              Försök igen
            </Button>
            <Button variant="secondary" asChild>
              <a href="/">Startsida</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const webHTML = generateInvoiceWebHTML(invoice);
  const numberLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);
  const customerName = (invoice.contactName || '').trim() || 'Faktura';
  const status = invoice.status || 'draft';
  const dueDateLabel = formatDate(invoice.dueDate) || '—';

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 bg-white/95 px-4 py-2.5 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 truncate text-sm font-extrabold text-foreground">
            {customerName}
            <span className="text-muted-foreground"> — </span>
            {numberLabel}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            Förfallodatum{' '}
            <span className="font-semibold tabular-nums text-foreground">{dueDateLabel}</span>
          </span>
          <Badge
            className={cn(
              'hidden shrink-0 sm:inline-flex',
              BADGE_CHIP_CLASS,
              INVOICE_STATUS_BADGE_CLASS,
              INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft,
            )}
          >
            {formatInvoiceStatusForDisplay(status)}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Badge
            className={cn(
              'shrink-0 sm:hidden',
              BADGE_CHIP_CLASS,
              INVOICE_STATUS_BADGE_CLASS,
              INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft,
            )}
          >
            {formatInvoiceStatusForDisplay(status)}
          </Badge>
          <RoundIconLabelButton
            type="button"
            icon={Download}
            label={isDownloadingPdf ? 'Skapar PDF…' : 'Ladda ner PDF'}
            variant="successSoft"
            size="xs"
            alwaysExpanded
            disabled={isDownloadingPdf}
            onClick={() => void handleDownloadPdf()}
          />
        </div>
      </div>
      <iframe
        srcDoc={webHTML}
        className="min-h-0 w-full flex-1 border-none"
        title={`Faktura ${invoice.invoiceNumber || invoice.id}`}
        sandbox=""
      />
    </div>
  );
}
