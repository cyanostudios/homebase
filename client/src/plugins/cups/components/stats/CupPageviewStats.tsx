import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';

import { cupsApi } from '../../api/cupsApi';
import type {
  CupPageviewStats as CupPageviewStatsData,
  CupPageviewTopCup,
} from '../../types/pageviewStats';
import { PageviewTimeSeriesChart } from './PageviewTimeSeriesChart';
import { RankedBarList } from './RankedBarList';

function formatViews(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

function formatCupDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCupDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    const a = formatCupDate(start);
    const b = formatCupDate(end);
    return a === b ? a : `${a} – ${b}`;
  }
  return formatCupDate((start || end) as string);
}

function topCupMeta(row: CupPageviewTopCup): string | null {
  const parts: string[] = [];
  if (row.district) parts.push(row.district);
  const dateLabel = formatCupDateRange(row.start_date, row.end_date);
  if (dateLabel) parts.push(dateLabel);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Round pill matching RoundIconLabelButton chrome — display-only (not interactive). */
function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span
      className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-3.5 pr-4 text-sm font-extrabold text-secondary-foreground"
      aria-label={`${label}: ${formatViews(value)}`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="tabular-nums text-primary">{formatViews(value)}</span>
    </span>
  );
}

export function CupPageviewStats({ days }: { days: number }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<CupPageviewStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cupsApi
      .getPageviewStats(days)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('cups.statistics.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days, t]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('cups.statistics.loading')}</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!stats) {
    return null;
  }

  const empty = stats.totals.views === 0;

  const sourceItems = stats.sources.map((row) => {
    const bucketLabel = t(`cups.statistics.bucket.${row.bucket}`, { defaultValue: row.bucket });
    const label = row.referrer_domain ? `${bucketLabel} · ${row.referrer_domain}` : bucketLabel;
    return {
      key: `${row.bucket}|${row.referrer_domain}`,
      label,
      value: row.views,
    };
  });

  const cupItems = stats.topCups.map((row) => ({
    key: String(row.cup_id),
    label: row.name,
    value: row.views,
    secondary: topCupMeta(row),
  }));

  const districtItems = stats.topDistricts.map((row) => ({
    key: row.district_slug,
    label: row.district_slug,
    value: row.views,
  }));

  return (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <MetricPill label={t('cups.statistics.metricPageviews')} value={stats.totals.views} />
            <MetricPill label={t('cups.statistics.metricCups')} value={stats.totals.cups} />
            <MetricPill
              label={t('cups.statistics.metricDistricts')}
              value={stats.totals.districts}
            />
            <MetricPill label={t('cups.statistics.metricSources')} value={stats.totals.sources} />
          </div>

          {empty ? (
            <p className="text-sm text-muted-foreground">{t('cups.statistics.empty')}</p>
          ) : (
            <PageviewTimeSeriesChart
              series={stats.series}
              ariaLabel={t('cups.statistics.chartAriaLabel', { days: stats.days })}
              viewsLabel={t('cups.statistics.chartViews')}
            />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('cups.statistics.sources')} subtleTitle className="p-4">
            <RankedBarList
              items={sourceItems}
              emptyLabel={t('cups.statistics.noSources')}
              barClassName="bg-primary"
              valueFormatter={formatViews}
            />
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('cups.statistics.topCups')} subtleTitle className="p-4">
            <RankedBarList
              items={cupItems}
              emptyLabel={t('cups.statistics.noCups')}
              barClassName="bg-emerald-500"
              valueFormatter={formatViews}
            />
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('cups.statistics.topDistricts')} subtleTitle className="p-4">
            <RankedBarList
              items={districtItems}
              emptyLabel={t('cups.statistics.noDistricts')}
              barClassName="bg-violet-500"
              valueFormatter={formatViews}
            />
          </DetailSection>
        </Card>
      </div>
    </div>
  );
}
