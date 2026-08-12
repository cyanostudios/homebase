import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DetailSection } from '@/core/ui/DetailSection';

import { cupsApi } from '../../api/cupsApi';
import type { CupPageviewStats } from '../../types/pageviewStats';

function formatViews(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('cups.statistics.windowSummary', {
          days: stats.days,
          views: formatViews(stats.totals.views),
        })}
      </p>

      {empty ? <p className="text-sm text-muted-foreground">{t('cups.statistics.empty')}</p> : null}

      <DetailSection title={t('cups.statistics.topCups')} subtleTitle>
        {stats.topCups.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('cups.statistics.noCups')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {stats.topCups.map((row) => (
              <li
                key={row.cup_id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{row.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatViews(row.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={t('cups.statistics.topDistricts')} subtleTitle>
        {stats.topDistricts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('cups.statistics.noDistricts')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {stats.topDistricts.map((row) => (
              <li
                key={row.district_slug}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{row.district_slug}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatViews(row.views)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={t('cups.statistics.sources')} subtleTitle>
        {stats.sources.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('cups.statistics.noSources')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {stats.sources.map((row) => {
              const label = row.referrer_domain
                ? `${t(`cups.statistics.bucket.${row.bucket}`, {
                    defaultValue: row.bucket,
                  })} · ${row.referrer_domain}`
                : t(`cups.statistics.bucket.${row.bucket}`, { defaultValue: row.bucket });
              return (
                <li
                  key={`${row.bucket}|${row.referrer_domain}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatViews(row.views)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>
    </div>
  );
}
