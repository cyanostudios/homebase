import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';

import { cupsApi } from '../../api/cupsApi';
import type { CupPageviewStats, CupPageviewTopCup } from '../../types/pageviewStats';

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

export function CupPageviewStats() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<CupPageviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cupsApi
      .getPageviewStats(30)
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
  }, [t]);

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ListFilterStatCard
          label={t('cups.statistics.pageviewsLastDays', { days: stats.days })}
          value={stats.totals.views}
          dotClassName="bg-emerald-500"
        />
      </div>

      {empty ? <p className="text-sm text-muted-foreground">{t('cups.statistics.empty')}</p> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('cups.statistics.topCups')} subtleTitle className="p-4">
            {stats.topCups.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('cups.statistics.noCups')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60">
                {stats.topCups.map((row) => {
                  const meta = topCupMeta(row);
                  return (
                    <li
                      key={row.cup_id}
                      className="flex items-start justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{row.name}</div>
                        {meta ? (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {meta}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatViews(row.views)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('cups.statistics.topDistricts')} subtleTitle className="p-4">
            {stats.topDistricts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('cups.statistics.noDistricts')}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60">
                {stats.topDistricts.map((row) => (
                  <li
                    key={row.district_slug}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {row.district_slug}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatViews(row.views)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title={t('cups.statistics.sources')} subtleTitle className="p-4">
            {stats.sources.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('cups.statistics.noSources')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60">
                {stats.sources.map((row) => {
                  const label = row.referrer_domain
                    ? `${t(`cups.statistics.bucket.${row.bucket}`, {
                        defaultValue: row.bucket,
                      })} · ${row.referrer_domain}`
                    : t(`cups.statistics.bucket.${row.bucket}`, { defaultValue: row.bucket });
                  return (
                    <li
                      key={`${row.bucket}|${row.referrer_domain}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatViews(row.views)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DetailSection>
        </Card>
      </div>
    </div>
  );
}
