import { Banknote, LayoutGrid, PieChart, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  StatDonutChart,
  StatKpiTile,
  StatRankedBars,
  StatStackedBar,
} from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import { cn } from '@/lib/utils';

import { useInvoiceStats } from '../hooks/useInvoiceStats';
import { formatInvoiceAmount } from '../utils/formatInvoiceAmount';

/** Chart hex colors aligned with dashboard invoice bar + status badges. */
const STATUS_CHART_COLORS = {
  draft: '#94a3b8',
  sent: '#60a5fa',
  partially_paid: '#f59e0b',
  paid: '#10b981',
  overdue: '#f43f5e',
  canceled: '#fb7185',
} as const;

const COLLECTION_COLORS = {
  collected: '#10b981',
  outstanding: '#60a5fa',
  overdue: '#f43f5e',
} as const;

interface InvoicesStatisticsViewProps {
  onClose?: () => void;
}

function MoneyKpiTile({
  label,
  value,
  currency = 'SEK',
  className,
}: {
  label: string;
  value: number;
  currency?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950', className)}>
      <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-2xl">
        {formatInvoiceAmount(value, 0)}
        <span className="ml-1 text-sm font-semibold text-muted-foreground">{currency}</span>
      </p>
    </div>
  );
}

export function InvoicesStatisticsView({ onClose }: InvoicesStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const stats = useInvoiceStats();

  useMobileBarOverride(onClose ? { onClose } : null);

  const statusSegments = useMemo(
    () => [
      {
        key: 'draft',
        label: t('invoices.statistics.draft', { defaultValue: 'Draft' }),
        value: stats.draft.count,
        color: STATUS_CHART_COLORS.draft,
      },
      {
        key: 'sent',
        label: t('invoices.statistics.sent', { defaultValue: 'Sent' }),
        value: stats.sent.count,
        color: STATUS_CHART_COLORS.sent,
      },
      {
        key: 'partially_paid',
        label: t('invoices.statistics.partiallyPaid', { defaultValue: 'Partially paid' }),
        value: stats.partiallyPaid.count,
        color: STATUS_CHART_COLORS.partially_paid,
      },
      {
        key: 'paid',
        label: t('invoices.statistics.paid', { defaultValue: 'Paid' }),
        value: stats.paid.count,
        color: STATUS_CHART_COLORS.paid,
      },
      {
        key: 'overdue',
        label: t('invoices.statistics.overdue', { defaultValue: 'Overdue' }),
        value: stats.overdue.count,
        color: STATUS_CHART_COLORS.overdue,
      },
      {
        key: 'canceled',
        label: t('invoices.statistics.canceled', { defaultValue: 'Canceled' }),
        value: stats.canceled.count,
        color: STATUS_CHART_COLORS.canceled,
      },
    ],
    [stats, t],
  );

  const collectionSegments = useMemo(
    () => [
      {
        key: 'collected',
        label: t('invoices.statistics.totalCollected', { defaultValue: 'Total collected' }),
        value: Math.round(stats.totalCollected),
        color: COLLECTION_COLORS.collected,
      },
      {
        key: 'outstanding',
        label: t('invoices.statistics.outstanding', { defaultValue: 'Outstanding' }),
        value: Math.round(stats.outstanding.totalAmount),
        color: COLLECTION_COLORS.outstanding,
      },
    ],
    [stats, t],
  );

  const amountByStatus = useMemo(
    () =>
      [
        {
          key: 'paid',
          label: t('invoices.statistics.paid', { defaultValue: 'Paid' }),
          value: Math.round(stats.paid.totalAmount),
        },
        {
          key: 'outstanding',
          label: t('invoices.statistics.outstanding', { defaultValue: 'Outstanding' }),
          value: Math.round(stats.outstanding.totalAmount),
        },
        {
          key: 'overdue',
          label: t('invoices.statistics.overdue', { defaultValue: 'Overdue' }),
          value: Math.round(stats.overdue.totalAmount),
        },
        {
          key: 'draft',
          label: t('invoices.statistics.draft', { defaultValue: 'Draft' }),
          value: Math.round(stats.draft.totalAmount),
        },
        {
          key: 'sent',
          label: t('invoices.statistics.sent', { defaultValue: 'Sent' }),
          value: Math.round(stats.sent.totalAmount),
        },
        {
          key: 'partially_paid',
          label: t('invoices.statistics.partiallyPaid', { defaultValue: 'Partially paid' }),
          value: Math.round(stats.partiallyPaid.totalAmount),
        },
        {
          key: 'canceled',
          label: t('invoices.statistics.canceled', { defaultValue: 'Canceled' }),
          value: Math.round(stats.canceled.totalAmount),
        },
      ].filter((row) => row.value > 0),
    [stats, t],
  );

  const collectionRate =
    stats.totalInvoiced > 0 ? Math.round((stats.totalCollected / stats.totalInvoiced) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="hidden flex-shrink-0 items-center justify-between md:flex">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('invoices.statistics.title', { defaultValue: 'Invoice statistics' })}
          </h2>
        </div>
        {onClose ? (
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={X}
              className="h-9 px-3 text-xs"
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('invoices.statistics.description', {
          defaultValue: 'Overview of outstanding, overdue, and collected invoices.',
        })}
      </p>

      <DetailSection
        title={t('invoices.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatKpiTile
            label={t('invoices.statistics.invoiceCount', { defaultValue: 'Invoices' })}
            value={stats.invoiceCount}
          />
          <MoneyKpiTile
            label={t('invoices.statistics.totalInvoiced', { defaultValue: 'Total invoiced' })}
            value={stats.totalInvoiced}
          />
          <MoneyKpiTile
            label={t('invoices.statistics.totalCollected', { defaultValue: 'Total collected' })}
            value={stats.totalCollected}
          />
          <StatKpiTile
            label={t('invoices.statistics.collectionRate', { defaultValue: 'Collected %' })}
            value={collectionRate}
          />
          <StatStackedBar
            className="sm:col-span-2"
            title={t('invoices.statistics.statusDistribution', {
              defaultValue: 'Status distribution',
            })}
            segments={statusSegments}
            footer={t('invoices.statistics.invoicesTotal', {
              defaultValue: '{{count}} invoices',
              count: stats.invoiceCount,
            })}
          />
          <StatDonutChart
            className="sm:col-span-2"
            title={t('invoices.statistics.collectionMix', {
              defaultValue: 'Collected vs open',
            })}
            ariaLabel={t('invoices.statistics.collectionMixAria', {
              defaultValue: 'Collected versus outstanding and overdue amounts',
            })}
            segments={collectionSegments}
          />
        </div>
      </DetailSection>

      <DetailSection
        title={t('invoices.statistics.amounts', { defaultValue: 'Amounts' })}
        icon={Banknote}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <StatRankedBars
            title={t('invoices.statistics.amountByStatus', {
              defaultValue: 'Amount by status (SEK)',
            })}
            emptyLabel={t('invoices.statistics.noAmounts', {
              defaultValue: 'No invoice amounts yet.',
            })}
            items={amountByStatus}
            barColor="#0ea5e9"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <MoneyKpiTile
              label={t('invoices.statistics.outstanding', { defaultValue: 'Outstanding' })}
              value={stats.outstanding.totalAmount}
            />
            <MoneyKpiTile
              label={t('invoices.statistics.overdue', { defaultValue: 'Overdue' })}
              value={stats.overdue.totalAmount}
            />
            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950 sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">
                {t('invoices.statistics.partialPaymentsLabel', {
                  defaultValue: 'Partial payments',
                })}
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-2xl">
                {stats.partialPayments}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('invoices.statistics.partialPaymentsHint', {
                  defaultValue: 'Invoices with amount paid but not fully settled',
                })}
              </p>
            </div>
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title={t('invoices.statistics.byStatus', { defaultValue: 'By status' })}
        icon={PieChart}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['draft', stats.draft],
              ['sent', stats.sent],
              ['partiallyPaid', stats.partiallyPaid],
              ['paid', stats.paid],
              ['overdue', stats.overdue],
              ['canceled', stats.canceled],
            ] as const
          ).map(([key, bucket]) => (
            <MoneyKpiTile
              key={key}
              label={`${t(
                `invoices.statistics.${key === 'partiallyPaid' ? 'partiallyPaid' : key}`,
                {
                  defaultValue:
                    key === 'partiallyPaid'
                      ? 'Partially paid'
                      : key.charAt(0).toUpperCase() + key.slice(1),
                },
              )} · ${bucket.count}`}
              value={bucket.totalAmount}
            />
          ))}
        </div>
      </DetailSection>
    </div>
  );
}
