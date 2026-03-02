import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useAnalytics } from '../hooks/useAnalytics';

const moneyFmt = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
});
const intFmt = new Intl.NumberFormat('sv-SE');

function fmtDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return v;
  }
  return d.toLocaleDateString('sv-SE');
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
    channels,
    topProducts,
    selectedSku,
    setSelectedSku,
    drilldownOrders,
    exportTopProductsCsv,
  } = useAnalytics();

  const chartRows = React.useMemo(
    () =>
      timeSeries.map((x) => ({
        ...x,
        bucketLabel: fmtDate(x.bucket),
      })),
    [timeSeries],
  );

  const availableChannels = React.useMemo(() => {
    return Array.from(new Set(channels.map((c) => c.channel)));
  }, [channels]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>E-commerce analytics</CardTitle>
        </CardHeader>
        <CardContent>
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
              value={filters.channel ?? ''}
              onChange={(e) => setFilters({ ...filters, channel: e.target.value || undefined })}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="">Alla kanaler</option>
              {availableChannels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
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
        </CardContent>
      </Card>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Omsättning</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {moneyFmt.format(overview.revenue || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Order</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {intFmt.format(overview.orderCount || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AOV</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {moneyFmt.format(overview.aov || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sålda enheter</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {intFmt.format(overview.unitsSold || 0)}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Omsättning över tid</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucketLabel" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order över tid</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucketLabel" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orderCount" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
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
                  className="flex items-center justify-between border-b pb-1"
                >
                  <div>
                    <div className="font-medium">
                      {c.channelLabel && c.channelLabel.trim() !== '' ? c.channelLabel : c.channel}
                    </div>
                    <div className="text-gray-500">{intFmt.format(c.orderCount)} order</div>
                  </div>
                  <div className="font-medium">{moneyFmt.format(c.revenue)}</div>
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
              {topProducts.map((p) => (
                <div
                  key={`${p.sku ?? 'no-sku'}-${p.title ?? 'no-title'}`}
                  className="flex items-center justify-between border-b pb-1 cursor-pointer"
                  onClick={() => setSelectedSku(p.sku)}
                >
                  <div>
                    <div className="font-medium">{p.title || 'Okänd produkt'}</div>
                    <div className="text-gray-500">
                      {p.sku || '—'} · {intFmt.format(p.unitsSold)} st
                    </div>
                  </div>
                  <div className="font-medium">{moneyFmt.format(p.revenue)}</div>
                </div>
              ))}
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
            <div className="space-y-2 text-sm">
              {drilldownOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b pb-1">
                  <div>
                    <div className="font-medium">Order #{o.orderNumber ?? o.id}</div>
                    <div className="text-gray-500">
                      {fmtDate(o.placedAt)} · {o.channelLabel || o.channel} · {o.status}
                    </div>
                  </div>
                  <div className="font-medium">{moneyFmt.format(o.totalAmount || 0)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
