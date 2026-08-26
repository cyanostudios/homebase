import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { dedupeInFlightByKey } from '@/core/utils/dedupeInFlightByKey';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice } from '../types/invoices';
import { generateInvoiceWebHTML } from '../webTemplate';

interface PublicInvoiceViewProps {
  token: string;
}

type PublicInvoice = Invoice & {
  shareValidUntil?: Date | string;
  accessedCount?: number;
  organization?: unknown;
};

export function PublicInvoiceView({ token }: PublicInvoiceViewProps) {
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

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

  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        srcDoc={webHTML}
        className="w-full h-full border-none"
        title={`Faktura ${invoice.invoiceNumber || invoice.id}`}
        sandbox=""
      />
    </div>
  );
}
