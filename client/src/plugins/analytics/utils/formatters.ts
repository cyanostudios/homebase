export function moneyFmt(amount: number, currency = 'SEK') {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Sorterar valutor: SEK först, sedan övriga alfabetiskt */
export function sortCurrenciesForDisplay<T extends { currency: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.currency === 'SEK') {
      return -1;
    }
    if (b.currency === 'SEK') {
      return 1;
    }
    return a.currency.localeCompare(b.currency);
  });
}

export function sortCurrencyEntries<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort(([a], [b]) => (a === 'SEK' ? -1 : b === 'SEK' ? 1 : a.localeCompare(b)));
}

const CHANNEL_PALETTE = [
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#dc2626',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
  '#be185d',
];

export function getChannelColor(label: string, channels: string[]): string {
  const i = channels.indexOf(label);
  return CHANNEL_PALETTE[i % CHANNEL_PALETTE.length] ?? '#6b7280';
}

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return v;
  }
  return d.toLocaleDateString('sv-SE');
}

export type TimeSeriesRow = {
  bucket: string;
  channelLabel: string;
  currency?: string;
  orderCount: number;
  revenue: number;
};

type RevenueBreakdown = { channelLabel: string; currency: string; revenue: number };
type OrderBreakdown = { channelLabel: string; orderCount: number };

export function buildRevenueChartData(rows: TimeSeriesRow[]) {
  return buildChannelChartData(rows, 'revenue', (r) => ({
    channelLabel: r.channelLabel,
    currency: r.currency || 'SEK',
    revenue: Number(r.revenue || 0),
  })) as {
    rows: Array<Record<string, unknown> & { _revenueBreakdown: RevenueBreakdown[] }>;
    channels: string[];
  };
}

export function buildOrderChartData(rows: TimeSeriesRow[]) {
  return buildChannelChartData(rows, 'orderCount', (r) => ({
    channelLabel: r.channelLabel,
    orderCount: Number(r.orderCount || 0),
  })) as {
    rows: Array<Record<string, unknown> & { _orderBreakdown: OrderBreakdown[] }>;
    channels: string[];
  };
}

function buildChannelChartData<T>(
  timeSeries: TimeSeriesRow[],
  valueKey: 'revenue' | 'orderCount',
  breakdownItem: (r: TimeSeriesRow) => T,
) {
  const byBucket = new Map<
    string,
    Record<string, unknown> & { bucket: string; bucketLabel: string }
  >();
  const channelSet = new Set<string>();
  const breakdownKey = valueKey === 'revenue' ? '_revenueBreakdown' : '_orderBreakdown';

  for (const row of timeSeries) {
    const key = row.bucket;
    if (!byBucket.has(key)) {
      byBucket.set(key, {
        bucket: key,
        bucketLabel: fmtDate(key),
        [breakdownKey]: [],
      });
    }
    const rec = byBucket.get(key)!;
    const label = row.channelLabel;
    channelSet.add(label);
    (rec as Record<string, number>)[label] = Number((row as Record<string, number>)[valueKey] || 0);
    (rec[breakdownKey] as T[]).push(breakdownItem(row));
  }

  const channels = Array.from(channelSet).sort((a, b) => a.localeCompare(b, 'sv'));

  for (const rec of byBucket.values()) {
    const arr = rec[breakdownKey] as Array<{ channelLabel: string }>;
    arr.sort((a, b) => a.channelLabel.localeCompare(b.channelLabel, 'sv'));
    for (const ch of channels) {
      if (!(ch in rec)) {
        (rec as Record<string, number>)[ch] = 0;
      }
    }
  }

  return { rows: Array.from(byBucket.values()), channels };
}
