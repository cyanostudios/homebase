import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
  Download,
  Settings,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useApp } from '@/core/api/AppContext';
import { DEFAULT_LIST_PAGE_SIZE } from '@/core/settings/listPageSizes';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { buildListPaginationItems } from '@/core/utils/listPagination';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';
import { useShipping } from '@/plugins/shipping/hooks/useShipping';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';

import { ordersApi } from '../api/ordersApi';
import { BATCH_CARRIERS } from '../constants/carriers';
import { useOrders } from '../hooks/useOrders';
import type {
  OrderDetails,
  OrderListItem,
  OrderStatus,
  OrdersListSortField,
} from '../types/orders';
import { statusDisplayLabel } from '../utils/statusDisplay';
import { validateTrackingRequirement } from '../utils/validateTrackingRequirement';

import { OrderDetailInline } from './OrderDetailInline';
import { OrderListSettingsForm } from './OrderListSettingsForm';

function fmtDate(d: any) {
  if (!d) {
    return '';
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) {
    return '';
  }
  return dt.toLocaleString();
}

function fmtMoney(amount: any, currency?: string | null) {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return '';
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'SEK',
  }).format(n);
}

/** Group key based strictly on full_name + exact placedAt timestamp. */
function getOrderGroupKey(o: OrderListItem): string | null {
  const addr = o.shippingAddress as { full_name?: string } | undefined;
  const namePart = (addr?.full_name ?? '').toString().trim();
  if (!namePart) {
    return null;
  }

  const placedAt = o.placedAt ? new Date(o.placedAt).getTime() : NaN;
  if (!Number.isFinite(placedAt)) {
    return null;
  }

  return `${namePart}:${placedAt}`;
}

function defaultOrderFor(field: OrdersListSortField): 'asc' | 'desc' {
  return field === 'placed' || field === 'total' ? 'desc' : 'asc';
}

function SortableOrderHead({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  field: OrdersListSortField;
  currentSort: OrdersListSortField;
  currentOrder: 'asc' | 'desc';
  onSort: (field: OrdersListSortField) => void;
}) {
  const active = currentSort === field;
  const ariaSort = active ? (currentOrder === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex w-full min-w-0 items-center gap-1 text-left font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        onClick={() => onSort(field)}
        aria-sort={ariaSort}
      >
        <span>{label}</span>
        {active ? (
          currentOrder === 'asc' ? (
            <ArrowUp className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-4 w-4 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 shrink-0 opacity-35" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

function normalizeDetails(raw: any): OrderDetails {
  return {
    ...raw,
    placedAt: raw?.placedAt ? new Date(raw.placedAt) : null,
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : null,
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : null,
    items: Array.isArray(raw?.items)
      ? raw.items.map((it: any) => ({
          ...it,
          createdAt: it?.createdAt ? new Date(it.createdAt) : null,
        }))
      : [],
  };
}

export const OrdersList: React.FC = () => {
  const { isAuthenticated } = useApp();
  const {
    orders,
    totalOrders,
    ordersListLoading,
    filters,
    setFilters,
    reloadOrders,
    updateOrderInList,
    updateOrdersInList,
  } = useOrders();
  const { openBookModal } = useShipping();
  const [searchTerm, setSearchTerm] = useState(() => filters.q ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => filters.q ?? '');
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
  const [showOrderListSettings, setShowOrderListSettings] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, OrderDetails>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchStatus, setBatchStatus] = useState<OrderStatus>('processing');
  const [batchCarrier, setBatchCarrier] = useState('');
  const [batchTracking, setBatchTracking] = useState('');
  const [syncing, setSyncing] = useState(false);
  const syncPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [exportingPlocklista, setExportingPlocklista] = useState(false);
  const [batchUpdateResult, setBatchUpdateResult] = useState<
    { updated: number; requested: number } | { error: string; trackingValidation?: boolean } | null
  >(null);

  const handleSyncOrders = useCallback(async () => {
    if (syncPollIntervalRef.current) {
      clearInterval(syncPollIntervalRef.current);
      syncPollIntervalRef.current = null;
    }
    try {
      const res = await ordersApi.sync({ force: true });
      if (!res?.started) {
        return;
      }
      setSyncing(true);
      syncPollIntervalRef.current = setInterval(async () => {
        try {
          const status = await ordersApi.syncStatus();
          if (!status?.busy) {
            if (syncPollIntervalRef.current) {
              clearInterval(syncPollIntervalRef.current);
              syncPollIntervalRef.current = null;
            }
            await reloadOrders();
            setSyncing(false);
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    } catch {
      setSyncing(false);
    }
  }, [reloadOrders]);

  useEffect(() => {
    return () => {
      if (syncPollIntervalRef.current) {
        clearInterval(syncPollIntervalRef.current);
        syncPollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setFilters((prev) => {
      if (!debouncedSearch) {
        if (prev.q === undefined) {
          return prev.offset === 0 ? prev : { ...prev, offset: 0 };
        }
        const { q: _drop, ...rest } = prev;
        return { ...rest, offset: 0 };
      }
      if (prev.q === debouncedSearch && prev.offset === 0) {
        return prev;
      }
      return { ...prev, q: debouncedSearch, offset: 0 };
    });
  }, [debouncedSearch, setFilters]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSearchTerm('');
      setDebouncedSearch('');
    }
  }, [isAuthenticated]);

  // Format channel display name. WooCommerce: use persisted channelLabel only; if null/empty show "—". CDON/Fyndiq: from raw.market.
  const formatChannelName = useCallback((order: OrderListItem): string => {
    const channel = order.channel?.toLowerCase() || '';
    if (channel === 'woocommerce') {
      const label =
        order.channelLabel !== null && order.channelLabel !== undefined
          ? String(order.channelLabel).trim()
          : '';
      return label !== '' ? label : '—';
    }
    let raw = order.raw;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    if (channel === 'cdon') {
      const market =
        raw !== null && raw !== undefined && raw.market !== null && raw.market !== undefined
          ? String(raw.market).trim().toUpperCase()
          : null;
      return market ? `CDON ${market}` : 'CDON';
    }

    if (channel === 'fyndiq') {
      const market =
        raw !== null && raw !== undefined && raw.market !== null && raw.market !== undefined
          ? String(raw.market).trim().toUpperCase()
          : null;
      return market ? `Fyndiq ${market}` : 'Fyndiq';
    }

    return channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : '';
  }, []);

  const fetchDetail = useCallback(
    async (id: string) => {
      if (detailCache[id]) {
        return detailCache[id];
      }
      setDetailLoading(id);
      try {
        const full = await ordersApi.get(id);
        const norm = normalizeDetails(full);
        setDetailCache((c) => ({ ...c, [id]: norm }));
        return norm;
      } finally {
        setDetailLoading(null);
      }
    },
    [detailCache],
  );

  React.useEffect(() => {
    const onBooked = async (event: Event) => {
      const customEvent = event as CustomEvent<{ updatedOrderIds?: string[] }>;
      const updatedIds = Array.isArray(customEvent.detail?.updatedOrderIds)
        ? customEvent.detail.updatedOrderIds.map(String)
        : [];
      await reloadOrders();
      if (expandedId && updatedIds.includes(String(expandedId))) {
        setDetailCache((prev) => {
          const next = { ...prev };
          delete next[String(expandedId)];
          return next;
        });
        await fetchDetail(String(expandedId));
      }
    };
    window.addEventListener('shipping:booked', onBooked as EventListener);
    return () => window.removeEventListener('shipping:booked', onBooked as EventListener);
  }, [expandedId, fetchDetail, reloadOrders]);

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

  /** Orders grouped by (customer + minute) for CDON/Fyndiq. Only groups with >1 order. */
  const orderGroups = useMemo(() => {
    const map = new Map<string, OrderListItem[]>();
    for (const o of orders) {
      const key = getOrderGroupKey(o);
      if (key) {
        const arr = map.get(key) ?? [];
        arr.push(o);
        map.set(key, arr);
      }
    }
    for (const [k, v] of map.entries()) {
      if (v.length < 2) {
        map.delete(k);
      }
    }
    return map;
  }, [orders]);

  const getGroupInfo = useCallback(
    (o: OrderListItem) => {
      const key = getOrderGroupKey(o);
      if (!key || !orderGroups.has(key)) {
        return null;
      }
      const arr = orderGroups.get(key)!;
      const idx = arr.findIndex((x) => String(x.id) === String(o.id));
      if (idx < 0) {
        return null;
      }
      return {
        key,
        index: idx,
        total: arr.length,
        isFirst: idx === 0,
        isLast: idx === arr.length - 1,
      };
    },
    [orderGroups],
  );

  const onChangeFilter = (key: string, value: string) => {
    setFilters((prev) => {
      const next: any = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      next.offset = 0;
      return next;
    });
  };

  const handleSortClick = useCallback(
    (field: OrdersListSortField) => {
      setFilters((prev) => {
        const cur = prev.sort ?? 'placed';
        const ord = prev.order ?? 'desc';
        if (cur === field) {
          return { ...prev, order: ord === 'asc' ? 'desc' : 'asc', offset: 0 };
        }
        return { ...prev, sort: field, order: defaultOrderFor(field), offset: 0 };
      });
    },
    [setFilters],
  );

  const sortField = filters.sort ?? 'placed';
  const sortOrder = filters.order ?? 'desc';

  const limit = filters.limit ?? DEFAULT_LIST_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const totalPages = limit > 0 ? Math.ceil(totalOrders / limit) || 1 : 1;
  const from = totalOrders === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, totalOrders);

  const paginationItems = useMemo(
    () => buildListPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    if (totalOrders <= 0) {
      return;
    }
    const tp = Math.ceil(totalOrders / limit) || 1;
    const maxOffset = Math.max(0, (tp - 1) * limit);
    setFilters((prev) => {
      const o = prev.offset ?? 0;
      if (o <= maxOffset) {
        return prev;
      }
      return { ...prev, offset: maxOffset };
    });
  }, [totalOrders, limit, setFilters]);

  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setFilters({ ...filters, offset: (p - 1) * limit });
  };

  const handleImportAll = async () => {
    setImporting({ channel: 'all' });
    setImportResult(null);

    const channels: Array<{ key: 'woocommerce' | 'cdon' | 'fyndiq'; pull: () => Promise<any> }> = [
      { key: 'cdon', pull: () => cdonApi.pullOrders({ daysBack: 30, renumber: false }) },
      { key: 'fyndiq', pull: () => fyndiqApi.pullOrders({ perPage: 30, renumber: false }) },
      {
        key: 'woocommerce',
        pull: () => woocommerceApi.pullOrders({ perPage: 20, renumber: false }),
      },
    ];

    const results: Array<{
      channel: string;
      fetched: number;
      created: number;
      skippedExisting: number;
      error?: string;
    }> = [];
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
        const msg = err?.message ?? err?.error ?? String(err);
        const detail = err?.detail;
        results.push({
          channel: ch.key,
          fetched: 0,
          created: 0,
          skippedExisting: 0,
          error: detail ? `${msg}${msg !== detail ? ` — ${detail}` : ''}` : msg || 'Failed',
        });
      }
    }

    try {
      await ordersApi.renumber();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      results.push({
        channel: 'renumber',
        fetched: 0,
        created: 0,
        skippedExisting: 0,
        error: msg || 'Failed',
      });
    }

    setImportResult(results);
    setTimeout(() => reloadOrders(), 300);
    setImporting({ channel: null });
  };

  const handleDetailUpdated = useCallback(
    (updated: OrderDetails) => {
      setDetailCache((c) => ({ ...c, [updated.id]: updated }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(String(updated.id));
        return next;
      });
      updateOrderInList(updated);
    },
    [updateOrderInList],
  );

  const handleDeleteAll = async () => {
    if (!confirm('Är du säker på att du vill radera ALLA order? Detta går inte att ångra.')) {
      return;
    }
    try {
      setDeletingAll(true);
      const result = await ordersApi.deleteAll();
      alert(
        `${result.deletedCount} order raderade. Du kan nu importera order på nytt från kanalerna.`,
      );
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
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => String(o.id))));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    if (!confirm(`Radera ${selectedIds.size} valda order? Detta går inte att ångra.`)) {
      return;
    }
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

  const handleBatchUpdate = (forceUpdate = false) => {
    if (selectedIds.size === 0) {
      setBatchUpdateResult({ error: 'Välj minst en order.' });
      return;
    }

    const ids = Array.from(selectedIds);
    const data = {
      status: batchStatus,
      carrier: batchCarrier.trim() || undefined,
      trackingNumber: batchTracking.trim() || undefined,
    };

    if (!forceUpdate) {
      for (const id of ids) {
        const order = orders.find((o) => String(o.id) === id);
        if (!order) {
          continue;
        }
        const err = validateTrackingRequirement(order, data.status, data.trackingNumber);
        if (err) {
          setBatchUpdateResult({ error: err.message, trackingValidation: true });
          return;
        }
      }
    }

    setBatchUpdateResult(null);
    setSelectedIds(new Set());
    setShowBatchDialog(false);
    setBatchCarrier('');
    setBatchTracking('');

    updateOrdersInList(ids, {
      status: data.status,
      shippingCarrier: data.carrier ?? undefined,
      shippingTrackingNumber: data.trackingNumber ?? undefined,
    });

    ordersApi
      .batchUpdateStatus(ids, data, forceUpdate ? { forceUpdate: true } : undefined)
      .catch((err: any) => {
        console.error('Batch update error (background):', err);
      });
  };

  const handleExportPlocklista = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    setExportingPlocklista(true);
    try {
      const ids = Array.from(selectedIds);
      const channelLabels: Record<string, string> = {};
      ids.forEach((id) => {
        const order = orders.find((o) => String(o.id) === id);
        if (order) {
          channelLabels[id] = formatChannelName(order);
        }
      });
      const blob = await ordersApi.downloadPlocklistaPdf(ids, channelLabels);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plocklista-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err?.message || err?.toString?.() || 'Kunde inte ladda ner plocklista.';
      setBatchUpdateResult({ error: msg });
      console.error('Plocklista PDF export error:', err);
    } finally {
      setExportingPlocklista(false);
    }
  };

  const toolbarActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {selectedIds.size > 0 && (
        <>
          <Button
            onClick={() => openBookModal(Array.from(selectedIds))}
            variant="outline"
            size="sm"
          >
            Boka frakt
          </Button>
          <Button
            onClick={handleExportPlocklista}
            disabled={exportingPlocklista}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4" />
            {exportingPlocklista ? 'Skapar PDF…' : 'Exportera plocklista (PDF)'}
          </Button>
          <Button
            onClick={() => {
              setBatchUpdateResult(null);
              setShowBatchDialog(true);
            }}
            size="sm"
          >
            Update {selectedIds.size} selected
          </Button>
          <Button
            onClick={handleDeleteSelected}
            disabled={deletingSelected}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
            {deletingSelected ? 'Raderar…' : `Radera ${selectedIds.size} valda`}
          </Button>
        </>
      )}
      <Button variant="outline" size="sm" onClick={() => setShowOrderListSettings(true)}>
        <Settings className="h-4 w-4 mr-2" />
        Inställningar
      </Button>
      <Button
        onClick={() => reloadOrders()}
        variant="outline"
        size="sm"
        disabled={ordersListLoading}
        aria-busy={ordersListLoading}
      >
        {ordersListLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden />
            Laddar…
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Reload
          </>
        )}
      </Button>
      <Button
        onClick={() => void handleSyncOrders()}
        disabled={syncing}
        variant="outline"
        size="sm"
      >
        {syncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
            Syncing…
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync orders
          </>
        )}
      </Button>
      <Button
        onClick={handleDeleteAll}
        disabled={deletingAll || orders.length === 0}
        variant="destructive"
        size="sm"
      >
        <Trash2 className="h-4 w-4" />
        {deletingAll ? 'Rensar…' : 'Rensa alla order'}
      </Button>
      <Button
        onClick={handleImportAll}
        disabled={importing.channel !== null}
        variant="outline"
        size="sm"
      >
        <Download className="h-4 w-4" />
        {importing.channel === 'all' ? 'Importing…' : 'Import orders'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {syncing && (
        <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-900">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Synkar ordrar…</span>
        </div>
      )}

      {batchUpdateResult && (
        <div
          className={`flex items-center justify-between gap-3 py-2 px-3 rounded-md border text-sm ${
            'error' in batchUpdateResult
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-green-50 border-green-200 text-green-900'
          }`}
        >
          <span>
            {'error' in batchUpdateResult
              ? batchUpdateResult.error
              : `${batchUpdateResult.updated} av ${batchUpdateResult.requested} order uppdaterade.`}
          </span>
          <button
            type="button"
            onClick={() => setBatchUpdateResult(null)}
            className="shrink-0 underline hover:no-underline"
          >
            Stäng
          </button>
        </div>
      )}

      {importResult && importResult.length > 0 && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200">
          <div className="text-sm font-medium text-green-900 mb-1">Import result</div>
          <ul className="text-sm text-green-800 space-y-0.5">
            {importResult.map((r) => (
              <li key={r.channel}>
                {r.error ? (
                  <span>
                    <strong className="capitalize">{r.channel}:</strong>{' '}
                    <span className="text-amber-700">{r.error}</span>
                  </span>
                ) : (
                  <span>
                    <strong className="capitalize">{r.channel}:</strong> {r.fetched} fetched,{' '}
                    {r.created} new, {r.skippedExisting} already existed
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <ContentToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Sök kund, ordernr, belopp, spårning, kanal…"
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
            setShowBatchDialog(false);
            setBatchCarrier('');
            setBatchTracking('');
          }}
        >
          <Card className="max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">Update {selectedIds.size} orders</h2>
            {batchUpdateResult && 'error' in batchUpdateResult && (
              <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-900 flex flex-col gap-2">
                <span>{batchUpdateResult.error}</span>
                {batchUpdateResult.trackingValidation && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start border-red-300 text-red-800 hover:bg-red-100"
                    onClick={() => handleBatchUpdate(true)}
                  >
                    Uppdatera ändå
                  </Button>
                )}
              </div>
            )}
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
                  {BATCH_CARRIERS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
              <Button onClick={() => handleBatchUpdate()} className="flex-1">
                Update
              </Button>
              <Button
                onClick={() => {
                  setShowBatchDialog(false);
                  setBatchCarrier('');
                  setBatchTracking('');
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Card
        className="relative shadow-none overflow-hidden min-h-[200px]"
        aria-busy={ordersListLoading}
      >
        {ordersListLoading && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Laddar order"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-md bg-background/75 backdrop-blur-[1px]"
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">Laddar order…</span>
          </div>
        )}
        {orders.length === 0 && !ordersListLoading ? (
          <div className="p-6 text-center text-muted-foreground">
            {filters.q
              ? 'Inga order matchar sökningen.'
              : 'No orders yet. Import orders from channels to get started.'}
          </div>
        ) : orders.length === 0 ? (
          <div className="min-h-[240px]" aria-hidden />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-5 p-0" aria-hidden />
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onChange={handleSelectAll}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer rounded border-input"
                      aria-label={
                        orders.length > 0 && selectedIds.size === orders.length
                          ? 'Unselect all'
                          : 'Select all'
                      }
                    />
                  </TableHead>
                  <SortableOrderHead
                    label="Channel"
                    field="channel"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSortClick}
                  />
                  <SortableOrderHead
                    label="Order #"
                    field="order_number"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSortClick}
                  />
                  <SortableOrderHead
                    label="Customer"
                    field="customer"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSortClick}
                  />
                  <SortableOrderHead
                    label="Placed"
                    field="placed"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSortClick}
                  />
                  <SortableOrderHead
                    label="Total"
                    field="total"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSortClick}
                  />
                  <SortableOrderHead
                    label="Status"
                    field="status"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSortClick}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: OrderListItem) => {
                  const id = String(o.id);
                  const isExpanded = expandedId === id;
                  const detail = detailCache[id];
                  const loading = detailLoading === id;
                  const orderNum =
                    o.orderNumber !== null && o.orderNumber !== undefined ? o.orderNumber : null;
                  const isSelected = selectedIds.has(id);
                  const groupInfo = getGroupInfo(o);

                  return (
                    <React.Fragment key={o.id}>
                      <TableRow
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded
                            ? `Collapse order ${orderNum ?? o.id}`
                            : `Expand order ${orderNum ?? o.id}`
                        }
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
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 ${isExpanded ? 'bg-muted/50' : ''} ${isSelected ? 'bg-muted/30' : ''} ${groupInfo ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
                      >
                        <TableCell
                          className={`w-5 p-0 align-top ${groupInfo ? 'border-l-2 border-emerald-400' : ''}`}
                          aria-hidden
                        />
                        <TableCell
                          className={`w-12 ${groupInfo ? 'pl-3' : ''}`}
                          onClick={(e) => handleToggleSelect(id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) {
                                  next.delete(id);
                                } else {
                                  next.add(id);
                                }
                                return next;
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer rounded border-input"
                            aria-label={isSelected ? 'Unselect order' : 'Select order'}
                          />
                        </TableCell>
                        <TableCell className={groupInfo ? 'pl-3' : ''}>
                          <span className="inline-flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            {formatChannelName(o)}
                          </span>
                        </TableCell>
                        <TableCell className={groupInfo ? 'pl-3' : ''}>
                          <div className="font-medium">{orderNum ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {o.platformOrderNumber || o.channelOrderId || '—'}
                          </div>
                        </TableCell>
                        <TableCell className={groupInfo ? 'pl-3' : ''}>
                          <div className="font-medium text-sm">
                            {(() => {
                              const s = o.shippingAddress as any;
                              const full = s?.full_name || s?.fullName || s?.name;
                              if (full) {
                                return full;
                              }
                              if (s?.first_name || s?.last_name) {
                                return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
                              }
                              return '—';
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className={groupInfo ? 'pl-3' : ''}>
                          {fmtDate(o.placedAt)}
                        </TableCell>
                        <TableCell className={groupInfo ? 'pl-3' : ''}>
                          {fmtMoney(o.totalAmount, o.currency)}
                        </TableCell>
                        <TableCell className={groupInfo ? 'pl-3' : ''}>
                          {statusDisplayLabel(o.status)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          {groupInfo ? (
                            <TableCell
                              className="w-5 p-0 border-l-2 border-emerald-400 align-top"
                              aria-hidden
                            />
                          ) : null}
                          <TableCell
                            colSpan={groupInfo ? 7 : 8}
                            className={`p-0 align-top ${groupInfo ? 'pl-3' : ''}`}
                          >
                            {loading ? (
                              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Loading…
                              </div>
                            ) : detail ? (
                              <OrderDetailInline order={detail} onUpdated={handleDetailUpdated} />
                            ) : (
                              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Could not load order.
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {totalOrders === 0
                  ? 'Inga order'
                  : `Visar ${from} till ${to} av ${totalOrders} order`}
                {ordersListLoading ? ' · Laddar…' : ''}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || ordersListLoading}
                    onClick={() => goToPage(currentPage - 1)}
                    aria-label="Föregående sida"
                  >
                    Föregående
                  </Button>
                  {(() => {
                    let ellipsisKey = 0;
                    return paginationItems.map((item) =>
                      item === 'ellipsis' ? (
                        <span
                          key={`ellipsis-${ellipsisKey++}`}
                          className="px-2 text-sm text-muted-foreground select-none"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <Button
                          key={item}
                          variant={item === currentPage ? 'default' : 'outline'}
                          size="sm"
                          className="min-w-[2rem]"
                          disabled={ordersListLoading}
                          onClick={() => goToPage(item)}
                          aria-label={`Sida ${item}`}
                          aria-current={item === currentPage ? 'page' : undefined}
                        >
                          {item}
                        </Button>
                      ),
                    );
                  })()}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages || ordersListLoading}
                    onClick={() => goToPage(currentPage + 1)}
                    aria-label="Nästa sida"
                  >
                    Nästa
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <Dialog open={showOrderListSettings} onOpenChange={setShowOrderListSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Orderinställningar</DialogTitle>
          </DialogHeader>
          <OrderListSettingsForm onClose={() => setShowOrderListSettings(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
