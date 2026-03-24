import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { decodeHtmlEntities } from '@/core/utils/decodeHtmlEntities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/plugins/orders/hooks/useOrders';

import { analyticsApi } from '../api/analyticsApi';
import { useAnalytics } from '../hooks/useAnalytics';
import type { AnalyticsDrilldownOrderItem, AnalyticsFilters } from '../types/analytics';
import {
  buildOrderChartData,
  buildRevenueChartData,
  getChannelColor,
  moneyFmt,
  sortCurrenciesForDisplay,
  sortCurrencyEntries,
} from '../utils/formatters';

import { DrilldownOrderList } from './DrilldownOrderList';
const intFmt = new Intl.NumberFormat('sv-SE');
type ChartMode = 'bar' | 'line';
const STATUS_COLORS: Record<string, string> = {
  processing: '#f59e0b',
  shipped: '#3b82f6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return v;
  }
  return d.toLocaleDateString('sv-SE');
}

function getChannelFilterValue(channel: string, channelInstanceId: number | null) {
  return `${channel}@@${channelInstanceId ?? ''}`;
}

function RevenueChartTooltip({
  active,
  payload,
  channels = [],
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      bucketLabel: string;
      _revenueBreakdown?: Array<{
        channelLabel: string;
        currency: string;
        revenue: number;
      }>;
    };
  }>;
  channels?: string[];
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const breakdown = row._revenueBreakdown ?? [];
  const byCurrency = breakdown.reduce<Record<string, number>>((acc, b) => {
    acc[b.currency] = (acc[b.currency] ?? 0) + b.revenue;
    return acc;
  }, {});
  const totalSorted = sortCurrencyEntries(Object.entries(byCurrency));

  return (
    <div className="rounded-md border bg-white p-3 shadow-md">
      <div className="mb-1 font-medium">{row.bucketLabel}</div>
      {breakdown.map((b) => (
        <div key={b.channelLabel} className="flex items-center gap-2 text-sm">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: getChannelColor(b.channelLabel, channels) }}
          />
          <span>
            {b.channelLabel}: {moneyFmt(b.revenue, b.currency)}
          </span>
        </div>
      ))}
      <div className="mt-2 border-t pt-1 text-sm font-medium">
        Totalt:
        {totalSorted.map(([cur, amt]) => (
          <div key={cur}>{moneyFmt(amt, cur)}</div>
        ))}
      </div>
    </div>
  );
}

function OrderChartTooltip({
  active,
  payload,
  channels = [],
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      bucketLabel: string;
      _orderBreakdown?: Array<{ channelLabel: string; orderCount: number }>;
    };
  }>;
  channels?: string[];
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const breakdown = row._orderBreakdown ?? [];
  const total = breakdown.reduce((sum, b) => sum + b.orderCount, 0);

  return (
    <div className="rounded-md border bg-white p-3 shadow-md">
      <div className="mb-1 font-medium">{row.bucketLabel}</div>
      {breakdown.map((b) => (
        <div key={b.channelLabel} className="flex items-center gap-2 text-sm">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: getChannelColor(b.channelLabel, channels) }}
          />
          <span>
            {b.channelLabel}: {intFmt.format(b.orderCount)}
          </span>
        </div>
      ))}
      <div className="mt-2 border-t pt-1 text-sm font-medium">Totalt: {intFmt.format(total)}</div>
    </div>
  );
}

export function AnalyticsList() {
  const {
    filters,
    setFilters,
    reloadAnalytics,
    loading,
    error,
    overview,
    timeSeries,
    statusDistribution,
    customerSegments,
    channels,
    allChannelsForDropdown,
    topProducts,
    selectedSku,
    setSelectedSku,
    drilldownOrders,
    selectedChannelDrilldown,
    setSelectedChannelDrilldown,
    channelDrilldownOrders,
    exportTopProductsCsv,
  } = useAnalytics();
  const { openOrderForView } = useOrders();

  const revenueChartData = React.useMemo(() => buildRevenueChartData(timeSeries), [timeSeries]);
  const orderChartData = React.useMemo(() => buildOrderChartData(timeSeries), [timeSeries]);

  const availableChannels = React.useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{
      value: string;
      label: string;
    }> = [];

    for (const c of allChannelsForDropdown) {
      if (!c.channelLabel || c.channelLabel.trim() === '') {
        continue;
      }
      const value = getChannelFilterValue(c.channel, c.channelInstanceId);
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
      options.push({
        value,
        label: c.channelLabel.trim(),
      });
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, 'sv'));
  }, [allChannelsForDropdown]);

  const selectedChannelFilterValue = React.useMemo(
    () => getChannelFilterValue(filters.channel ?? '', filters.channelInstanceId ?? null),
    [filters.channel, filters.channelInstanceId],
  );

  const statusChart = React.useMemo(() => {
    const byBucket = new Map<string, Record<string, string | number>>();
    const statuses = new Set<string>();

    for (const row of statusDistribution) {
      const bucketKey = row.bucket;
      if (!byBucket.has(bucketKey)) {
        byBucket.set(bucketKey, {
          bucket: bucketKey,
          bucketLabel: fmtDate(bucketKey),
        });
      }
      const current = byBucket.get(bucketKey)!;
      current[row.status] = Number(row.orderCount || 0);
      statuses.add(row.status);
    }

    const statusList = Array.from(statuses).sort();
    return {
      rows: Array.from(byBucket.values()),
      statuses: statusList,
    };
  }, [statusDistribution]);

  const [selectedStatusDrilldown, setSelectedStatusDrilldown] = React.useState<{
    status: string;
    bucket: string;
  } | null>(null);
  const [revenueChartMode, setRevenueChartMode] = React.useState<ChartMode>('bar');
  const [ordersChartMode, setOrdersChartMode] = React.useState<ChartMode>('bar');
  const [statusChartMode, setStatusChartMode] = React.useState<ChartMode>('bar');
  const [statusDrilldownOrders, setStatusDrilldownOrders] = React.useState<
    AnalyticsDrilldownOrderItem[]
  >([]);
  const [statusDrilldownLoading, setStatusDrilldownLoading] = React.useState(false);

  const getBucketRange = React.useCallback(
    (bucketValue: string): { from: string; to: string } | null => {
      const start = new Date(bucketValue);
      if (Number.isNaN(start.getTime())) {
        return null;
      }
      const endExclusive = new Date(start.getTime());
      const granularity = filters.granularity || 'day';
      if (granularity === 'week') {
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
      } else if (granularity === 'month') {
        endExclusive.setUTCMonth(endExclusive.getUTCMonth() + 1);
      } else {
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      }
      const endInclusive = new Date(endExclusive.getTime() - 1);
      return {
        from: start.toISOString(),
        to: endInclusive.toISOString(),
      };
    },
    [filters.granularity],
  );

  React.useEffect(() => {
    let isCancelled = false;
    async function loadStatusDrilldown() {
      if (!selectedStatusDrilldown) {
        setStatusDrilldownOrders([]);
        return;
      }
      const range = getBucketRange(selectedStatusDrilldown.bucket);
      if (!range) {
        setStatusDrilldownOrders([]);
        return;
      }
      setStatusDrilldownLoading(true);
      try {
        const drilldownFilters: AnalyticsFilters = {
          ...filters,
          status: selectedStatusDrilldown.status,
          from: range.from,
          to: range.to,
        };
        const items = await analyticsApi.getDrilldownOrders(drilldownFilters, { limit: 50 });
        if (!isCancelled) {
          setStatusDrilldownOrders(items);
        }
      } catch {
        if (!isCancelled) {
          setStatusDrilldownOrders([]);
        }
      } finally {
        if (!isCancelled) {
          setStatusDrilldownLoading(false);
        }
      }
    }
    void loadStatusDrilldown();
    return () => {
      isCancelled = true;
    };
  }, [filters, getBucketRange, selectedStatusDrilldown]);

  const openOrderFromDrilldown = React.useCallback(
    (id: string) => {
      void openOrderForView({ id } as any);
    },
    [openOrderForView],
  );

  const renderChartModeToggle = React.useCallback(
    (mode: ChartMode, setMode: (next: ChartMode) => void) => (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={mode === 'bar' ? 'default' : 'outline'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setMode('bar')}
          title="Stapelvy"
          aria-label="Stapelvy"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={mode === 'line' ? 'default' : 'outline'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setMode('line')}
          title="Grafvy"
          aria-label="Grafvy"
        >
          <LineChartIcon className="h-4 w-4" />
        </Button>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
        />
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
        />
        <select
          value={filters.channel ? selectedChannelFilterValue : ''}
          onChange={(e) => {
            const value = e.target.value || '';
            if (!value) {
              setFilters({ ...filters, channel: undefined, channelInstanceId: undefined });
              return;
            }
            const [channel, instanceIdRaw] = value.split('@@');
            setFilters({
              ...filters,
              channel: channel || undefined,
              channelInstanceId:
                instanceIdRaw && instanceIdRaw !== '' ? Number(instanceIdRaw) : undefined,
            });
          }}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Alla kanaler</option>
          {availableChannels.map((ch) => (
            <option key={ch.value} value={ch.value}>
              {ch.label}
            </option>
          ))}
        </select>
        <select
          value={filters.status ?? ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">Alla statusar</option>
          <option value="processing">processing</option>
          <option value="shipped">shipped</option>
          <option value="delivered">delivered</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select
          value={filters.granularity ?? 'day'}
          onChange={(e) =>
            setFilters({
              ...filters,
              granularity: (e.target.value as 'day' | 'week' | 'month') || 'day',
            })
          }
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="day">Dag</option>
          <option value="week">Vecka</option>
          <option value="month">Månad</option>
        </select>
        <button
          type="button"
          onClick={() => void reloadAnalytics()}
          className="px-3 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Laddar…' : 'Uppdatera'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Omsättning</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5 text-base font-semibold md:flex-row md:flex-wrap md:gap-x-2 md:text-xl">
            {(() => {
              const revenueItems = sortCurrenciesForDisplay(
                (overview.byCurrency ?? []).filter((c) => c.revenue > 0),
              );
              return revenueItems.length > 0
                ? revenueItems.map((c, i) => (
                    <span key={c.currency}>
                      {i > 0 && <span className="hidden md:inline"> | </span>}
                      {moneyFmt(c.revenue, c.currency)}
                    </span>
                  ))
                : moneyFmt(0);
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Order</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold md:text-xl">
            {intFmt.format(
              overview.byCurrency?.reduce((sum, c) => sum + (c.orderCount || 0), 0) ?? 0,
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AOV</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5 text-base font-semibold md:flex-row md:flex-wrap md:gap-x-2 md:text-xl">
            {(() => {
              const aovItems = sortCurrenciesForDisplay(
                (overview.byCurrency ?? []).filter((c) => c.orderCount > 0 && c.aov > 0),
              );
              return aovItems.length > 0
                ? aovItems.map((c, i) => (
                    <span key={c.currency}>
                      {i > 0 && <span className="hidden md:inline"> | </span>}
                      {moneyFmt(c.aov, c.currency)}
                    </span>
                  ))
                : moneyFmt(0);
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sålda enheter</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold md:text-xl">
            {intFmt.format(overview.unitsSold || 0)}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Omsättning över tid</CardTitle>
            {renderChartModeToggle(revenueChartMode, setRevenueChartMode)}
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {revenueChartMode === 'bar' ? (
                <BarChart data={revenueChartData.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucketLabel" />
                  <YAxis />
                  <Tooltip
                    content={(props) => (
                      <RevenueChartTooltip {...props} channels={revenueChartData.channels} />
                    )}
                  />
                  {revenueChartData.channels.map((ch) => (
                    <Bar
                      key={ch}
                      dataKey={ch}
                      stackId="revenue"
                      fill={getChannelColor(ch, revenueChartData.channels)}
                    />
                  ))}
                </BarChart>
              ) : (
                <AreaChart data={revenueChartData.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucketLabel" />
                  <YAxis />
                  <Tooltip
                    content={(props) => (
                      <RevenueChartTooltip {...props} channels={revenueChartData.channels} />
                    )}
                  />
                  {revenueChartData.channels.map((ch) => (
                    <Area
                      key={ch}
                      type="monotone"
                      dataKey={ch}
                      stackId="revenue"
                      stroke="none"
                      fill={getChannelColor(ch, revenueChartData.channels)}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Order över tid</CardTitle>
            {renderChartModeToggle(ordersChartMode, setOrdersChartMode)}
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {ordersChartMode === 'bar' ? (
                <BarChart data={orderChartData.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucketLabel" />
                  <YAxis />
                  <Tooltip
                    content={(props) => (
                      <OrderChartTooltip {...props} channels={orderChartData.channels} />
                    )}
                  />
                  {orderChartData.channels.map((ch) => (
                    <Bar
                      key={ch}
                      dataKey={ch}
                      stackId="orders"
                      fill={getChannelColor(ch, orderChartData.channels)}
                    />
                  ))}
                </BarChart>
              ) : (
                <AreaChart data={orderChartData.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucketLabel" />
                  <YAxis />
                  <Tooltip
                    content={(props) => (
                      <OrderChartTooltip {...props} channels={orderChartData.channels} />
                    )}
                  />
                  {orderChartData.channels.map((ch) => (
                    <Area
                      key={ch}
                      type="monotone"
                      dataKey={ch}
                      stackId="orders"
                      stroke="none"
                      fill={getChannelColor(ch, orderChartData.channels)}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Statusfördelning över tid</CardTitle>
            {renderChartModeToggle(statusChartMode, setStatusChartMode)}
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="92%">
              {statusChartMode === 'bar' ? (
                <BarChart data={statusChart.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucketLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {statusChart.statuses.map((status) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      stackId="status"
                      fill={STATUS_COLORS[status] || '#6b7280'}
                      onClick={(_, index) => {
                        const row = statusChart.rows[index] as { bucket?: string } | undefined;
                        if (!row?.bucket) {
                          return;
                        }
                        setSelectedStatusDrilldown({
                          status,
                          bucket: String(row.bucket),
                        });
                      }}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={statusChart.rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucketLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {statusChart.statuses.map((status) => (
                    <Line
                      key={status}
                      type="monotone"
                      dataKey={status}
                      stroke={STATUS_COLORS[status] || '#6b7280'}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 mt-1">
              {statusChartMode === 'bar'
                ? 'Klicka på en statusfärg för drilldown.'
                : 'Byt till Stapel för klickbar status-drilldown.'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nya vs återkommande kunder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between border-b pb-1">
                <span>Nya kunder</span>
                <span className="font-medium">{intFmt.format(customerSegments.newCustomers)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span>Återkommande kunder</span>
                <span className="font-medium">
                  {intFmt.format(customerSegments.returningCustomers)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span>Order från nya kunder</span>
                <span className="font-medium">
                  {intFmt.format(customerSegments.newCustomerOrders)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span>Order från återkommande kunder</span>
                <span className="font-medium">
                  {intFmt.format(customerSegments.returningCustomerOrders)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Order utan identifierbar kund (e-post/telefon saknas)</span>
                <span className="font-medium">
                  {intFmt.format(customerSegments.unidentifiedOrders)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Per kanal / butik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {channels.map((c) => (
                <div
                  key={`${c.channel}-${c.channelInstanceId ?? 'none'}-${c.channelLabel ?? 'none'}`}
                  className="flex items-center justify-between border-b pb-1 cursor-pointer"
                  onClick={() =>
                    setSelectedChannelDrilldown({
                      channel: c.channel,
                      channelInstanceId: c.channelInstanceId,
                      channelLabel: c.channelLabel,
                    })
                  }
                >
                  <div>
                    <div className="font-medium">{c.channelLabel && c.channelLabel.trim()}</div>
                    <div className="text-gray-500">{intFmt.format(c.orderCount)} order</div>
                  </div>
                  <div className="font-medium">{moneyFmt(c.revenue, c.currency)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storsäljare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <button
                type="button"
                onClick={() => void exportTopProductsCsv()}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
              >
                Exportera CSV
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {topProducts.map((p) => {
                const revByCur = p.revenueByCurrency ?? {};
                const activeCurrencies = sortCurrencyEntries(
                  Object.entries(revByCur).filter(([, v]) => v > 0),
                );
                const revenueDisplay =
                  activeCurrencies.length > 0 ? (
                    <div className="flex flex-col gap-0.5 text-right md:flex-row md:flex-wrap md:justify-end">
                      {activeCurrencies.map(([cur, amt], i) => (
                        <span key={cur}>
                          {i > 0 && <span className="hidden md:inline"> | </span>}
                          {moneyFmt(amt, cur)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    moneyFmt(0)
                  );
                return (
                  <div
                    key={`${p.sku ?? 'no-sku'}-${p.title ?? 'no-title'}`}
                    className="flex items-center justify-between gap-2 border-b pb-1 cursor-pointer"
                    onClick={() => setSelectedSku(p.sku)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {decodeHtmlEntities(p.title ?? '') || 'Okänd produkt'}
                      </div>
                      <div className="text-gray-500">
                        {p.sku || '—'} · {intFmt.format(p.unitsSold)} st
                      </div>
                    </div>
                    <div className="shrink-0 text-base font-medium md:text-sm">
                      {revenueDisplay}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedSku && (
        <Card>
          <CardHeader>
            <CardTitle>Drilldown: order för SKU {selectedSku}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setSelectedSku(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
              >
                Stäng drilldown
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Klicka på en orderrad för detaljer.</div>
            <DrilldownOrderList
              orders={drilldownOrders}
              emptyMessage="Inga order matchar vald produkt och filter."
              onOrderClick={openOrderFromDrilldown}
            />
          </CardContent>
        </Card>
      )}

      {selectedChannelDrilldown && (
        <Card>
          <CardHeader>
            <CardTitle>
              Drilldown: order för kanal{' '}
              {selectedChannelDrilldown.channelLabel || selectedChannelDrilldown.channel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setSelectedChannelDrilldown(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
              >
                Stäng drilldown
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Klicka på en orderrad för detaljer.</div>
            <DrilldownOrderList
              orders={channelDrilldownOrders}
              emptyMessage="Inga order matchar vald kanal och filter."
              onOrderClick={openOrderFromDrilldown}
            />
          </CardContent>
        </Card>
      )}

      {selectedStatusDrilldown && (
        <Card>
          <CardHeader>
            <CardTitle>
              Drilldown: status {selectedStatusDrilldown.status} (
              {fmtDate(selectedStatusDrilldown.bucket)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setSelectedStatusDrilldown(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
              >
                Stäng drilldown
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Klicka på en orderrad för detaljer.</div>
            <DrilldownOrderList
              orders={statusDrilldownOrders}
              emptyMessage="Inga order matchar vald status och period."
              loading={statusDrilldownLoading}
              onOrderClick={openOrderFromDrilldown}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
