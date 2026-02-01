import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Trash2, Download } from 'lucide-react';

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
import { useOrders } from '../hooks/useOrders';
import type { OrderDetails, OrderListItem, OrderStatus } from '../types/orders';
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
  const [importResult, setImportResult] = useState<{
    channel: string;
    fetched: number;
    created: number;
    skippedExisting: number;
  } | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
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

  const handleImportOrders = async (channel: 'woocommerce' | 'cdon' | 'fyndiq') => {
    try {
      setImporting({ channel });
      setImportResult(null);

      let result: any;
      if (channel === 'woocommerce') {
        result = await woocommerceApi.pullOrders({ perPage: 20 });
      } else if (channel === 'cdon') {
        result = await cdonApi.pullOrders({ daysBack: 30 });
      } else if (channel === 'fyndiq') {
        result = await fyndiqApi.pullOrders({ perPage: 20, status: 'pending' });
      } else {
        throw new Error(`Unknown channel: ${channel}`);
      }

      setImportResult({
        channel,
        fetched: result.fetched || 0,
        created: result.created || 0,
        skippedExisting: result.skippedExisting || 0,
      });

      setTimeout(() => reloadOrders(), 500);
    } catch (err: any) {
      alert(`Failed to import orders from ${channel}: ${err.message || err}`);
      console.error('Import error:', err);
    } finally {
      setImporting({ channel: null });
    }
  };

  const handleDetailUpdated = useCallback(
    (updated: OrderDetails) => {
      setDetailCache((c) => ({ ...c, [updated.id]: updated }));
      void reloadOrders();
    },
    [reloadOrders],
  );

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL orders? This cannot be undone.')) {
      return;
    }
    try {
      setDeletingAll(true);
      const result = await ordersApi.deleteAll();
      alert(`Deleted ${result.deletedCount} orders. You can now import fresh orders from channels.`);
      void reloadOrders();
    } catch (err: any) {
      alert(`Failed to delete orders: ${err.message || err}`);
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
        <Button onClick={() => setShowBatchDialog(true)} size="sm">
          Update {selectedIds.size} selected
        </Button>
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
        {deletingAll ? 'Deleting…' : 'Delete All'}
      </Button>
      <Button
        onClick={() => handleImportOrders('woocommerce')}
        disabled={importing.channel !== null}
        variant="outline"
        size="sm"
        icon={Download}
      >
        {importing.channel === 'woocommerce' ? 'Importing…' : 'WooCommerce'}
      </Button>
      <Button
        onClick={() => handleImportOrders('cdon')}
        disabled={importing.channel !== null}
        variant="outline"
        size="sm"
        icon={Download}
      >
        {importing.channel === 'cdon' ? 'Importing…' : 'CDON'}
      </Button>
      <Button
        onClick={() => handleImportOrders('fyndiq')}
        disabled={importing.channel !== null}
        variant="outline"
        size="sm"
        icon={Download}
      >
        {importing.channel === 'fyndiq' ? 'Importing…' : 'Fyndiq'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">

      {importResult && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200">
          <div className="text-sm text-green-900">
            <strong>Import from {importResult.channel}:</strong> Fetched {importResult.fetched} orders,{' '}
            {importResult.created} new, {importResult.skippedExisting} already existed.
          </div>
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
          <option value="shipped">Shipped</option>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold mb-4">Update {selectedIds.size} orders</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <NativeSelect
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as OrderStatus)}
                >
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </NativeSelect>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Carrier (optional)</label>
                <Input
                  type="text"
                  value={batchCarrier}
                  onChange={(e) => setBatchCarrier(e.target.value)}
                  placeholder="e.g. PostNord"
                />
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
                      className={`cursor-pointer ${
                        isExpanded ? 'bg-muted/50' : isSelected ? 'bg-muted/30' : ''
                      }`}
                    >
                      <TableCell onClick={(e) => handleToggleSelect(id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
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
                      <TableCell>{fmtDate(o.placedAt)}</TableCell>
                      <TableCell>{fmtMoney(o.totalAmount, o.currency)}</TableCell>
                      <TableCell>{o.status}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0 align-top">
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
