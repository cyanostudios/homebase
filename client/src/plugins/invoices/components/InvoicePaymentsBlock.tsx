import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CreditCard, Trash2 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';

import { invoicesApi } from '../api/invoicesApi';
import { useInvoices } from '../hooks/useInvoices';
import type { InvoicePayment } from '../types/invoices';
import { formatInvoiceMoney } from '../utils/formatInvoiceAmount';

interface InvoicePaymentsBlockProps {
  invoiceId: string;
  currency?: string;
  total?: number;
  amountPaid?: number;
  status?: string;
}

function normalizeInvoiceDates(invoice: any) {
  return {
    ...invoice,
    issueDate: invoice.issueDate ? new Date(invoice.issueDate) : null,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
    createdAt: invoice.createdAt ? new Date(invoice.createdAt) : null,
    updatedAt: invoice.updatedAt ? new Date(invoice.updatedAt) : null,
    paidAt: invoice.paidAt ? new Date(invoice.paidAt) : null,
  };
}

export function InvoicePaymentsBlock({
  invoiceId,
  currency = 'SEK',
  total = 0,
  amountPaid = 0,
  status,
}: InvoicePaymentsBlockProps) {
  const { t } = useTranslation();
  const { refreshInvoices, applyInvoiceSnapshot } = useInvoices();
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const remaining = Math.max(0, Math.round((Number(total) - Number(amountPaid || 0)) * 100) / 100);
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await invoicesApi.getPayments(invoiceId);
      setPayments(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to load payments', err);
      setError(t('invoices.payments.loadFailed', { defaultValue: 'Could not load payments.' }));
    }
  }, [invoiceId, t]);

  useEffect(() => {
    setError(null);
    void load();
  }, [load]);

  useEffect(() => {
    // Prefill amount with remaining when remaining changes and field is empty.
    setAmount((current) =>
      current.trim() === '' ? (remaining > 0 ? String(remaining) : '') : current,
    );
  }, [remaining]);

  const canPay = status !== 'canceled' && remaining > 0;

  const applyInvoiceUpdate = async (invoice: any) => {
    if (invoice) {
      applyInvoiceSnapshot(normalizeInvoiceDates(invoice));
    }
    await refreshInvoices();
  };

  const handleCreate = async () => {
    setError(null);
    const raw = amount.trim() === '' ? String(remaining) : amount.trim();
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError(
        t('invoices.payments.invalidAmount', {
          defaultValue: 'Enter a payment amount greater than 0.',
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const result = await invoicesApi.createPayment(invoiceId, {
        amount: value,
        paidOn,
        reference: reference.trim(),
      });
      setAmount('');
      setReference('');
      await applyInvoiceUpdate(result?.invoice);
      await load();
    } catch (err: any) {
      console.error('Failed to record payment', err);
      setError(
        err?.message ||
          t('invoices.payments.recordFailed', { defaultValue: 'Could not record payment.' }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    setError(null);
    setBusy(true);
    try {
      const result = await invoicesApi.deletePayment(paymentId);
      await applyInvoiceUpdate(result?.invoice);
      await load();
    } catch (err: any) {
      console.error('Failed to delete payment', err);
      setError(
        err?.message ||
          t('invoices.payments.deleteFailed', { defaultValue: 'Could not delete payment.' }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('invoices.payments.title', { defaultValue: 'Payments' })}
        icon={CreditCard}
        subtleTitle
        className="p-6"
      >
        <div className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('invoices.payments.paid', { defaultValue: 'Paid' })}
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {formatInvoiceMoney(amountPaid || 0, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t('invoices.payments.remaining', { defaultValue: 'Remaining' })}
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {formatInvoiceMoney(remaining, currency)}
            </span>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        {payments.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-muted-foreground">
                  {payment.paidOn ? formatDate(payment.paidOn) || '—' : '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {payment.reference?.trim() || '—'}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                  {formatInvoiceMoney(payment.amount, currency)}
                </span>
                <RoundIconLabelButton
                  type="button"
                  icon={Trash2}
                  label={t('common.delete')}
                  variant="dangerSoft"
                  size="xs"
                  expandOnHover={false}
                  disabled={busy}
                  className="shrink-0"
                  onClick={() => void handleDelete(payment.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            {t('invoices.payments.empty', { defaultValue: 'No payments recorded yet.' })}
          </p>
        )}

        {canPay ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`invoice-payment-paid-on-${invoiceId}`}>
                {t('invoices.payments.paidOn', { defaultValue: 'Paid on' })}
              </Label>
              <Input
                id={`invoice-payment-paid-on-${invoiceId}`}
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`invoice-payment-reference-${invoiceId}`}>
                {t('invoices.payments.reference', { defaultValue: 'Reference' })}
              </Label>
              <Input
                id={`invoice-payment-reference-${invoiceId}`}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`invoice-payment-amount-${invoiceId}`}>
                {t('invoices.payments.amount', { defaultValue: 'Amount' })}
              </Label>
              <Input
                id={`invoice-payment-amount-${invoiceId}`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={remaining > 0 ? String(remaining) : '0'}
              />
            </div>
            <div className="flex justify-end sm:col-span-3">
              <RoundIconLabelButton
                type="button"
                icon={Check}
                label={t('invoices.payments.record', { defaultValue: 'Record payment' })}
                variant="successSoft"
                size="xs"
                alwaysExpanded
                disabled={busy}
                onClick={() => void handleCreate()}
              />
            </div>
          </div>
        ) : status === 'canceled' ? (
          <p className="text-sm text-muted-foreground">
            {t('invoices.payments.canceledHint', {
              defaultValue: 'Payments cannot be recorded on a canceled invoice.',
            })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('invoices.payments.fullyPaidHint', {
              defaultValue: 'This invoice is fully paid.',
            })}
          </p>
        )}
      </DetailSection>
    </Card>
  );
}
