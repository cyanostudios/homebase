import { Banknote, LayoutGrid, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  StatDonutChart,
  StatKpiTile,
  StatRankedBars,
  StatStackedBar,
} from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { useInvoiceStats } from '../hooks/useInvoiceStats';
import { formatInvoiceAmount } from '../utils/formatInvoiceAmount';
import {
  currencyAmountEntries,
  type AmountByCurrency,
  type InvoiceStatsBucket,
} from '../utils/invoiceStats';

/** Chart hex colors aligned with dashboard invoice bar + status badges. */
const STATUS_CHART_COLORS = {
  draft: '#94a3b8',
  sent: '#60a5fa',
  partially_paid: '#f59e0b',
  paid: '#10b981',
  overdue: '#f43f5e',
  canceled: '#fb7185',
} as const;

const TYPE_CHART_COLORS = {
  invoice: '#60a5fa',
  credit_note: '#f59e0b',
  cash_invoice: '#14b8a6',
  receipt: '#94a3b8',
} as const;

const COLLECTION_COLORS = {
  collected: '#10b981',
  outstanding: '#60a5fa',
  overdue: '#f43f5e',
} as const;

interface InvoicesStatisticsViewProps {
  onClose?: () => void;
}

function formatMoneyLabel(amount: number, currency: string): string {
  return `${formatInvoiceAmount(amount, 0)} ${currency}`;
}

function MoneyKpiTile({
  label,
  amounts,
  hint,
  className,
}: {
  label: string;
  amounts: Array<{ currency: string; value: number }>;
  hint?: string;
  className?: string;
}) {
  const rows = amounts.length > 0 ? amounts : [{ currency: 'SEK', value: 0 }];

  return (
    <div className={cn('rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950', className)}>
      <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <div className="mt-1 space-y-1">
        {rows.map((row) => (
          <p
            key={row.currency}
            className="text-2xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-3xl"
          >
            {formatInvoiceAmount(row.value, 0)}
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
              {row.currency}
            </span>
          </p>
        ))}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function amountsFromMap(byCurrency: AmountByCurrency): Array<{ currency: string; value: number }> {
  const entries = currencyAmountEntries(byCurrency);
  if (entries.length === 0) {
    return [{ currency: 'SEK', value: 0 }];
  }
  return entries.map((row) => ({ currency: row.currency, value: row.amount }));
}

function expandBucketByCurrency(
  bucket: InvoiceStatsBucket,
  meta: { key: string; label: string; color: string },
): Array<{
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  secondary?: string;
  color: string;
  sortAbs: number;
}> {
  const entries = currencyAmountEntries(bucket.byCurrency);
  if (bucket.count === 0 || entries.length === 0) {
    return [];
  }
  return entries.map((row) => ({
    key: `${meta.key}:${row.currency}`,
    label: entries.length > 1 ? `${meta.label} · ${row.currency}` : meta.label,
    value: Math.abs(row.amount),
    valueLabel: formatMoneyLabel(row.amount, row.currency),
    color: meta.color,
    sortAbs: Math.abs(row.amount),
  }));
}

export function InvoicesStatisticsView({ onClose }: InvoicesStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const stats = useInvoiceStats();
  const multiCurrency = stats.currencies.length > 1;

  useMobileBarOverride(onClose ? { onClose } : null);

  const statusSegments = useMemo(
    () =>
      [
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
      ].filter((segment) => segment.value > 0),
    [stats, t],
  );

  const collectionSegments = useMemo(() => {
    if (multiCurrency) {
      return [];
    }
    const currency = stats.currencies[0] || 'SEK';
    return [
      {
        key: 'collected',
        label: t('invoices.statistics.totalCollected', { defaultValue: 'Total collected' }),
        value: Math.round(stats.totalCollectedByCurrency[currency] || 0),
        color: COLLECTION_COLORS.collected,
      },
      {
        key: 'outstanding',
        label: t('invoices.statistics.outstanding', { defaultValue: 'Outstanding' }),
        value: Math.round(stats.outstanding.byCurrency[currency] || 0),
        color: COLLECTION_COLORS.outstanding,
      },
      {
        key: 'overdue',
        label: t('invoices.statistics.overdue', { defaultValue: 'Overdue' }),
        value: Math.round(stats.overdue.byCurrency[currency] || 0),
        color: COLLECTION_COLORS.overdue,
      },
    ].filter((segment) => segment.value > 0);
  }, [multiCurrency, stats, t]);

  const collectionByCurrencyRows = useMemo(() => {
    if (!multiCurrency) {
      return [];
    }
    const rows: Array<{
      key: string;
      label: string;
      value: number;
      valueLabel: string;
      color: string;
    }> = [];
    for (const currency of stats.currencies) {
      const collected = Math.round(stats.totalCollectedByCurrency[currency] || 0);
      const outstanding = Math.round(stats.outstanding.byCurrency[currency] || 0);
      const overdue = Math.round(stats.overdue.byCurrency[currency] || 0);
      if (collected !== 0) {
        rows.push({
          key: `collected:${currency}`,
          label: `${t('invoices.statistics.totalCollected', { defaultValue: 'Total collected' })} · ${currency}`,
          value: Math.abs(collected),
          valueLabel: formatMoneyLabel(collected, currency),
          color: COLLECTION_COLORS.collected,
        });
      }
      if (outstanding !== 0) {
        rows.push({
          key: `outstanding:${currency}`,
          label: `${t('invoices.statistics.outstanding', { defaultValue: 'Outstanding' })} · ${currency}`,
          value: Math.abs(outstanding),
          valueLabel: formatMoneyLabel(outstanding, currency),
          color: COLLECTION_COLORS.outstanding,
        });
      }
      if (overdue !== 0) {
        rows.push({
          key: `overdue:${currency}`,
          label: `${t('invoices.statistics.overdue', { defaultValue: 'Overdue' })} · ${currency}`,
          value: Math.abs(overdue),
          valueLabel: formatMoneyLabel(overdue, currency),
          color: COLLECTION_COLORS.overdue,
        });
      }
    }
    return rows;
  }, [multiCurrency, stats, t]);

  const amountByType = useMemo(
    () =>
      (['invoice', 'credit_note', 'cash_invoice', 'receipt'] as const)
        .flatMap((type) =>
          expandBucketByCurrency(stats.byType[type], {
            key: type,
            label: t(`invoices.type.${type}`),
            color: TYPE_CHART_COLORS[type],
          }),
        )
        .sort((a, b) => b.sortAbs - a.sortAbs)
        .map(({ sortAbs: _sortAbs, ...row }) => row),
    [stats, t],
  );

  const amountByStatus = useMemo(
    () =>
      (
        [
          {
            key: 'paid',
            label: t('invoices.statistics.paid', { defaultValue: 'Paid' }),
            bucket: stats.paid,
            color: STATUS_CHART_COLORS.paid,
          },
          {
            key: 'sent',
            label: t('invoices.statistics.sent', { defaultValue: 'Sent' }),
            bucket: stats.sent,
            color: STATUS_CHART_COLORS.sent,
          },
          {
            key: 'partially_paid',
            label: t('invoices.statistics.partiallyPaid', { defaultValue: 'Partially paid' }),
            bucket: stats.partiallyPaid,
            color: STATUS_CHART_COLORS.partially_paid,
          },
          {
            key: 'overdue',
            label: t('invoices.statistics.overdue', { defaultValue: 'Overdue' }),
            bucket: stats.overdue,
            color: STATUS_CHART_COLORS.overdue,
          },
          {
            key: 'draft',
            label: t('invoices.statistics.draft', { defaultValue: 'Draft' }),
            bucket: stats.draft,
            color: STATUS_CHART_COLORS.draft,
          },
          {
            key: 'canceled',
            label: t('invoices.statistics.canceled', { defaultValue: 'Canceled' }),
            bucket: stats.canceled,
            color: STATUS_CHART_COLORS.canceled,
          },
        ] as const
      )
        .flatMap((row) =>
          expandBucketByCurrency(row.bucket, {
            key: row.key,
            label: row.label,
            color: row.color,
          }),
        )
        .sort((a, b) => b.sortAbs - a.sortAbs)
        .map(({ sortAbs: _sortAbs, ...row }) => ({
          ...row,
          secondary: undefined as string | undefined,
        })),
    [stats, t],
  );

  const collectionRate = useMemo(() => {
    if (multiCurrency) {
      return null;
    }
    const currency = stats.currencies[0] || 'SEK';
    const invoiced = stats.totalInvoicedByCurrency[currency] || 0;
    const collected = stats.totalCollectedByCurrency[currency] || 0;
    if (invoiced <= 0) {
      return 0;
    }
    return Math.round((collected / invoiced) * 100);
  }, [multiCurrency, stats]);

  const amountChartTitle = multiCurrency
    ? t('invoices.statistics.amountByStatusMulti', {
        defaultValue: 'Amount by status',
      })
    : t('invoices.statistics.amountByStatus', {
        defaultValue: 'Amount by status ({{currency}})',
        currency: stats.currencies[0] || 'SEK',
      });

  const amountByTypeTitle = multiCurrency
    ? t('invoices.statistics.amountByTypeMulti', {
        defaultValue: 'Amount by type',
      })
    : t('invoices.statistics.amountByType', {
        defaultValue: 'Amount by type ({{currency}})',
        currency: stats.currencies[0] || 'SEK',
      });

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('invoices.statistics.title', { defaultValue: 'Invoice statistics' })}
          </h2>
        </div>
        {onClose ? (
          <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
            <RoundIconLabelButton
              type="button"
              icon={X}
              label={t('common.close')}
              variant="secondary"
              alwaysExpanded
              onClick={onClose}
            />
          </div>
        ) : null}
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {multiCurrency
          ? t('invoices.statistics.descriptionMultiCurrency', {
              defaultValue:
                'Amounts are shown per currency. Currencies are not converted or mixed.',
            })
          : t('invoices.statistics.description', {
              defaultValue: 'Overview of outstanding, overdue, and collected invoices.',
            })}
      </p>

      <DetailSection
        title={t('invoices.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatKpiTile
            label={t('invoices.statistics.invoiceCount', { defaultValue: 'Invoices' })}
            value={stats.invoiceCount}
          />
          <MoneyKpiTile
            label={t('invoices.statistics.totalInvoiced', { defaultValue: 'Total invoiced' })}
            amounts={amountsFromMap(stats.totalInvoicedByCurrency)}
          />
          <MoneyKpiTile
            label={t('invoices.statistics.totalCollected', { defaultValue: 'Total collected' })}
            amounts={amountsFromMap(stats.totalCollectedByCurrency)}
          />
          {collectionRate == null ? (
            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
              <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">
                {t('invoices.statistics.collectionRate', { defaultValue: 'Collected %' })}
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {t('invoices.statistics.collectionRateMultiHint', {
                  defaultValue: 'Per currency only',
                })}
              </p>
            </div>
          ) : (
            <StatKpiTile
              label={t('invoices.statistics.collectionRate', { defaultValue: 'Collected %' })}
              value={collectionRate}
            />
          )}
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatStackedBar
          title={t('invoices.statistics.statusDistribution', {
            defaultValue: 'Status distribution',
          })}
          segments={statusSegments}
          footer={t('invoices.statistics.invoicesTotal', {
            defaultValue: '{{count}} invoices',
            count: stats.invoiceCount,
          })}
        />
        {multiCurrency ? (
          <StatRankedBars
            title={t('invoices.statistics.collectionMix', {
              defaultValue: 'Collected vs open',
            })}
            emptyLabel={t('invoices.statistics.noAmounts', {
              defaultValue: 'No invoice amounts yet.',
            })}
            items={collectionByCurrencyRows}
            barColor={COLLECTION_COLORS.outstanding}
          />
        ) : (
          <StatDonutChart
            title={t('invoices.statistics.collectionMix', {
              defaultValue: 'Collected vs open',
            })}
            ariaLabel={t('invoices.statistics.collectionMixAria', {
              defaultValue: 'Collected versus outstanding and overdue amounts',
            })}
            segments={collectionSegments}
          />
        )}
      </div>

      <DetailSection
        title={t('invoices.statistics.amounts', { defaultValue: 'Amounts' })}
        icon={Banknote}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <StatRankedBars
            title={amountChartTitle}
            emptyLabel={t('invoices.statistics.noAmounts', {
              defaultValue: 'No invoice amounts yet.',
            })}
            items={amountByStatus}
            barColor={STATUS_CHART_COLORS.sent}
          />
          <StatRankedBars
            title={amountByTypeTitle}
            emptyLabel={t('invoices.statistics.noAmounts', {
              defaultValue: 'No invoice amounts yet.',
            })}
            items={amountByType}
            barColor={TYPE_CHART_COLORS.invoice}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <MoneyKpiTile
            label={t('invoices.statistics.outstanding', { defaultValue: 'Outstanding' })}
            amounts={amountsFromMap(stats.outstanding.byCurrency)}
          />
          <MoneyKpiTile
            label={t('invoices.statistics.overdue', { defaultValue: 'Overdue' })}
            amounts={amountsFromMap(stats.overdue.byCurrency)}
          />
          <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-slate-400">
              {t('invoices.statistics.partialPaymentsLabel', {
                defaultValue: 'Partial payments',
              })}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {stats.partialPayments}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('invoices.statistics.partialPaymentsHint', {
                defaultValue: 'Invoices with amount paid but not fully settled',
              })}
            </p>
          </div>
        </div>
      </DetailSection>
    </div>
  );
}
