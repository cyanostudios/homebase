import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Trash2, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContentToolbar } from '@/core/ui/ContentToolbar';

import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';
import { channelsApi } from '@/plugins/channels/api/channelsApi';

import { ordersApi } from '../api/ordersApi';
import { CDON_CARRIERS, FYNDIQ_CARRIERS, WOOCOMMERCE_CARRIERS_SE } from '../constants/carriers';
import { useOrders } from '../hooks/useOrders';
import type { OrderDetails, OrderListItem, OrderStatus } from '../types/orders';
import { statusDisplayLabel } from '../utils/statusDisplay';
import { OrderDetailInline } from './OrderDetailInline';

function fmtDate(d: any) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString();
}

function fmtMoney(amount: any, currency?: string | null) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'SEK' }).format(n);
}

function normalizeDetails(raw: any): OrderDetails {
  return {
    ...raw,
    placedAt: raw?.placedAt ? new Date(raw.placedAt) : null,
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : null,
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : null,
    items: Array.isArray(raw?.items)
      ? raw.items.map((it: any) => ({ ...it, createdAt: it?.createdAt ? new Date(it.createdAt) : null }))
      : [],
  };
}

export const OrdersList: React.FC = () => {
  const { orders, filters, setFilters, reloadOrders } = useOrders();
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState<{ channel: string | null }>({ channel: null });
  const [importResult, setImportResult] = useState<Array<{
    channel: string;
    fetched: number;
    created: number;
    skippedExisting: number;
    error?: string;
  }> | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [wooInstances, setWooInstances] = useState<Array<{ id: string; instanceKey?: string; label?: string | null; credentials?: any }>>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, OrderDetails>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchStatus, setBatchStatus] = useState<OrderStatus>('processing');
  const [batchCarrier, setBatchCarrier] = useState('');
  const [batchTracking, setBatchTracking] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Quick-sync on open: trigger sync in background; if started, show spinner and poll until done, then refetch list
  React.useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        const res = await ordersApi.sync();
        if (cancelled || !res?.started) return;
        setSyncing(true);
        intervalId = setInterval(async () => {
          if (cancelled) return;
          try {
            const status = await ordersApi.syncStatus();
            if (!status?.busy) {
              if (intervalId) clearInterval(intervalId);
              intervalId = null;
              if (!cancelled) {
                try {
                  await ordersApi.renumber();
                } catch {
                  // Non-fatal: list may show wrong order numbers until next renumber
                }
                await reloadOrders();
                setSyncing(false);
              }
            }
          } catch {
            // ignore poll errors
          }
        }, 2000);
      } catch {
        if (!cancelled) setSyncing(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [reloadOrders]);

  // Load WooCommerce instances for store names
  React.useEffect(() => {
    const loadWooInstances = async () => {
      try {
        const result = await channelsApi.getInstances({ channel: 'woocommerce' });
        if (result.ok && result.items) {
          setWooInstances(result.items);
        }
      } catch (err) {
        console.error('Failed to load WooCommerce instances:', err);
      }
    };
    loadWooInstances();
  }, []);

  // Format channel display name
  const formatChannelName = useCallback((order: OrderListItem): string => {
    const channel = order.channel?.toLowerCase() || '';
    let raw = order.raw;
    // Parse raw if it's a string
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    const currency = order.currency?.toUpperCase();

    if (channel === 'cdon') {
      // Try to extract market from raw data
      let market: string | null = null;
      if (raw) {
        // CDON orders might have CountryCode in raw data
        const countryCode = raw?.CountryCode || raw?.countryCode || raw?.Country || raw?.country;
        if (countryCode) {
          const country = String(countryCode).toLowerCase();
          if (country.includes('sweden') || country === 'se') market = 'SE';
          else if (country.includes('denmark') || country === 'dk') market = 'DK';
          else if (country.includes('finland') || country === 'fi') market = 'FI';
        }
      }

      // Fallback to currency-based detection
      if (!market) {
        if (currency === 'SEK') market = 'SE';
        else if (currency === 'DKK') market = 'DK';
        else if (currency === 'EUR') market = 'FI';
      }

      return market ? `CDON ${market}` : 'CDON';
    }

    if (channel === 'fyndiq') {
      // Try to extract market from raw data
      let market: string | null = null;
      if (raw) {
        const marketCode = raw?.market || raw?.Market || raw?.country_code || raw?.countryCode;
        if (marketCode) {
          const m = String(marketCode).toLowerCase();
          if (m === 'se' || m === 'sweden') market = 'SE';
          else if (m === 'dk' || m === 'denmark') market = 'DK';
          else if (m === 'fi' || m === 'finland') market = 'FI';
        }
      }

      // Fallback to currency-based detection
      if (!market) {
        if (currency === 'SEK') market = 'SE';
        else if (currency === 'DKK') market = 'DK';
        else if (currency === 'EUR') market = 'FI';
      }

      return market ? `Fyndiq ${market}` : 'Fyndiq';
    }

    if (channel === 'woocommerce') {
      // Use store name from channel instances, matching by store URL
      if (wooInstances.length > 0 && raw) {
        // Try to get store URL from raw data (saved when order was imported)
        const orderStoreUrl = raw?._homebase_store_url || raw?.store_url || raw?.storeUrl;

        if (orderStoreUrl) {
          // Normalize URLs for comparison (remove trailing slashes, http/https, www)
          const normalizeUrl = (url: string) => {
            try {
              const u = new URL(url);
              return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
            } catch {
              return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
            }
          };

          const normalizedOrderUrl = normalizeUrl(orderStoreUrl);

          // Find matching instance by store URL
          const matchingInstance = wooInstances.find((inst) => {
            const instStoreUrl = inst.credentials?.storeUrl || inst.credentials?.store_url;
            if (!instStoreUrl) return false;
            const normalizedInstUrl = normalizeUrl(instStoreUrl);
            return normalizedInstUrl === normalizedOrderUrl;
          });

          if (matchingInstance?.label) {
            return matchingInstance.label;
          }
        }

        // Fallback: If there's only one instance, use its label
        if (wooInstances.length === 1 && wooInstances[0]?.label) {
          return wooInstances[0].label;
        }

        // Fallback: Try to find default instance
        const defaultInstance = wooInstances.find((inst) => inst.instanceKey === 'default');
        if (defaultInstance?.label) {
          return defaultInstance.label;
        }

        // Fallback: Use first instance with a label
        const instanceWithLabel = wooInstances.find((inst) => inst.label);
        if (instanceWithLabel?.label) {
          return instanceWithLabel.label;
        }
      }
      return 'WooCommerce';
    }

    // Default: capitalize first letter
    return channel.charAt(0).toUpperCase() + channel.slice(1);
  }, [wooInstances]);

  const fetchDetail = useCallback(async (id: string) => {
    if (detailCache[id]) return detailCache[id];
    setDetailLoading(id);
    try {
      const full = await ordersApi.get(id);
      const norm = normalizeDetails(full);
      setDetailCache((c) => ({ ...c, [id]: norm }));
      return norm;
    } finally {
      setDetailLoading(null);
    }
  }, [detailCache]);

  const toggleExpand = useCallback(
    async (o: OrderListItem) => {
      const id = String(o.id);
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(id);
      await fetchDetail(id);
    },
    [expandedId, fetchDetail],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const hay = `${o.channel} ${o.channelOrderId} ${o.platformOrderNumber || ''} ${o.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orders, search]);

  const onChangeFilter = (key: string, value: string) => {
    const next: any = { ...filters };
    if (!value) delete next[key];
    else next[key] = value;
    setFilters(next);
  };

  const handleImportAll = async () => {
    setImporting({ channel: 'all' });
    setImportResult(null);

    const channels: Array<{ key: 'woocommerce' | 'cdon' | 'fyndiq'; pull: () => Promise<any> }> = [
      { key: 'cdon', pull: () => cdonApi.pullOrders({ daysBack: 30 }) },
      { key: 'fyndiq', pull: () => fyndiqApi.pullOrders({ perPage: 30 }) },
      { key: 'woocommerce', pull: () => woocommerceApi.pullOrders({ perPage: 20 }) },
    ];

    const results: Array<{ channel: string; fetched: number; created: number; skippedExisting: number; error?: string }> = [];
    for (const ch of channels) {
      try {
        const r = await ch.pull();
        results.push({
          channel: ch.key,
          fetched: r.fetched ?? 0,
          created: r.created ?? 0,
          skippedExisting: r.skippedExisting ?? 0,
        });
      } catch (err: any) {
        const msg = err?.message ?? (err?.error ?? String(err));
        const detail = err?.detail;
        results.push({
          channel: ch.key,
          fetched: 0,
          created: 0,
          skippedExisting: 0,
          error: detail ? `${msg}${msg !== detail ? ` — ${detail}` : ''}` : (msg || 'Failed'),
        });
      }
    }

    setImportResult(results);
    try {
      await ordersApi.renumber();
    } catch (_e) {
      // Non-fatal: list may still show old numbers until next renumber
    }
    setTimeout(() => reloadOrders(), 300);
    setImporting({ channel: null });
  };

  const handleDetailUpdated = useCallback(
    (updated: OrderDetails) => {
      setDetailCache((c) => ({ ...c, [updated.id]: updated }));
      void reloadOrders();
    },
    [reloadOrders],
  );

  const handleDeleteAll = async () => {
    if (!confirm('Är du säker på att du vill radera ALLA order? Detta går inte att ångra.')) {
      return;
    }
    try {
      setDeletingAll(true);
      const result = await ordersApi.deleteAll();
      alert(`${result.deletedCount} order raderade. Du kan nu importera order på nytt från kanalerna.`);
      void reloadOrders();
    } catch (err: any) {
      alert(`Kunde inte radera order: ${err.message || err}`);
      console.error('Delete all error:', err);
    } finally {
      setDeletingAll(false);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => String(o.id))));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Radera ${selectedIds.size} valda order? Detta går inte att ångra.`)) return;
    try {
      setDeletingSelected(true);
      const result = await ordersApi.deleteByIds(Array.from(selectedIds));
      setSelectedIds(new Set());
      alert(`${result.deletedCount} order raderade.`);
      void reloadOrders();
    } catch (err: any) {
      alert(`Kunde inte radera order: ${err.message || err}`);
      console.error('Delete selected orders error:', err);
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one order');
      return;
    }

    try {
      setBatchUpdating(true);
      const result = await ordersApi.batchUpdateStatus(Array.from(selectedIds), {
        status: batchStatus,
        carrier: batchCarrier.trim() || undefined,
        trackingNumber: batchTracking.trim() || undefined,
      });
      alert(`Updated ${result.updated} of ${result.requested} selected orders`);
      setSelectedIds(new Set());
      setShowBatchDialog(false);
      setBatchCarrier('');
      setBatchTracking('');
      void reloadOrders();
    } catch (err: any) {
      alert(`Failed to update orders: ${err.message || err}`);
      console.error('Batch update error:', err);
    } finally {
      setBatchUpdating(false);
    }
  };

  const toolbarActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {selectedIds.size > 0 && (
        <>
          <Button onClick={() => setShowBatchDialog(true)} size="sm">
            Update {selectedIds.size} selected
          </Button>
          <Button
            onClick={handleDeleteSelected}
            disabled={deletingSelected}
            variant="destructive"
            size="sm"
            icon={Trash2}
          >
            {deletingSelected ? 'Raderar…' : `Radera ${selectedIds.size} valda`}
          </Button>
        </>
      )}
      <Button onClick={() => reloadOrders()} variant="outline" size="sm" icon={RefreshCw}>
        Reload
      </Button>
      <Button
        onClick={handleDeleteAll}
        disabled={deletingAll || orders.length === 0}
        variant="destructive"
        size="sm"
        icon={Trash2}
      >
        {deletingAll ? 'Rensar…' : 'Rensa alla order'}
      </Button>
      <Button
        onClick={handleImportAll}
        disabled={importing.channel !== null}
        variant="outline"
        size="sm"
        icon={Download}
      >
        {importing.channel === 'all' ? 'Importing…' : 'Import orders'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">

      {syncing && (
        <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-900">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Syncing orders…</span>
        </div>
      )}

      {importResult && importResult.length > 0 && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200">
          <div className="text-sm font-medium text-green-900 mb-1">Import result</div>
          <ul className="text-sm text-green-800 space-y-0.5">
            {importResult.map((r) => (
              <li key={r.channel}>
                {r.error ? (
                  <span><strong className="capitalize">{r.channel}:</strong> <span className="text-amber-700">{r.error}</span></span>
                ) : (
                  <span><strong className="capitalize">{r.channel}:</strong> {r.fetched} fetched, {r.created} new, {r.skippedExisting} already existed</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <ContentToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search order number, channel, status…"
          rightActions={toolbarActions}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NativeSelect
          value={filters.status || ''}
          onChange={(e) => onChangeFilter('status', e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="processing">Processing</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </NativeSelect>
        <NativeSelect
          value={filters.channel || ''}
          onChange={(e) => onChangeFilter('channel', e.target.value)}
        >
          <option value="">All channels</option>
          <option value="woocommerce">WooCommerce</option>
          <option value="cdon">CDON</option>
          <option value="fyndiq">Fyndiq</option>
        </NativeSelect>
      </div>

      {showBatchDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={() => {
            if (!batchUpdating) {
              setShowBatchDialog(false);
              setBatchCarrier('');
              setBatchTracking('');
            }
          }}
        >
          <Card
            className="max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Update {selectedIds.size} orders</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <NativeSelect
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as OrderStatus)}
                >
                  <option value="processing">Processing</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </NativeSelect>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Carrier (optional)</label>
                <select
                  value={batchCarrier}
                  onChange={(e) => setBatchCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="">—</option>
                  <optgroup label="CDON">
                    {CDON_CARRIERS.map((c) => (
                      <option key={`cdon-${c}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Fyndiq">
                    {FYNDIQ_CARRIERS.map((c) => (
                      <option key={`fyndiq-${c}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="WooCommerce (Sverige)">
                    {WOOCOMMERCE_CARRIERS_SE.map((c) => (
                      <option key={`woo-${c}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tracking Number (optional)</label>
                <Input
                  type="text"
                  value={batchTracking}
                  onChange={(e) => setBatchTracking(e.target.value)}
                  placeholder="e.g. 1234567890"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={handleBatchUpdate} disabled={batchUpdating} className="flex-1">
                {batchUpdating ? 'Updating…' : 'Update'}
              </Button>
              <Button
                onClick={() => {
                  setShowBatchDialog(false);
                  setBatchCarrier('');
                  setBatchTracking('');
                }}
                disabled={batchUpdating}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Card className="shadow-none">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {search ? 'No orders found matching your search.' : 'No orders yet. Import orders from channels to get started.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={handleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-input"
                  />
                </TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o: OrderListItem) => {
                const id = String(o.id);
                const isExpanded = expandedId === id;
                const detail = detailCache[id];
                const loading = detailLoading === id;
                const orderNum = o.orderNumber != null ? o.orderNumber : null;
                const isSelected = selectedIds.has(id);

                return (
                  <React.Fragment key={o.id}>
                    <TableRow
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Collapse order ${orderNum ?? o.id}` : `Expand order ${orderNum ?? o.id}`}
                      data-list-item={JSON.stringify(o)}
                      data-plugin-name="orders"
                      onClick={() => void toggleExpand(o)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleExpand(o);
                        }
                      }}
                      className={`cursor-pointer ${isExpanded ? 'bg-muted/50' : isSelected ? 'bg-muted/30' : ''
                        }`}
                    >
                      <TableCell onClick={(e) => handleToggleSelect(id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-input"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          {formatChannelName(o)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{orderNum ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.platformOrderNumber || o.channelOrderId || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {(() => {
                            const s = o.shippingAddress as any;
                            const full = s?.full_name || s?.fullName || s?.name;
                            if (full) return full;
                            if (s?.first_name || s?.last_name) {
                              return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
                            }
                            return '—';
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>{fmtDate(o.placedAt)}</TableCell>
                      <TableCell>{fmtMoney(o.totalAmount, o.currency)}</TableCell>
                      <TableCell>{statusDisplayLabel(o.status)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0 align-top">
                          {loading ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
                          ) : detail ? (
                            <OrderDetailInline order={detail} onUpdated={handleDetailUpdated} />
                          ) : (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Could not load order.</div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
