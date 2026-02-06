import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trash2, ChevronUp, ChevronDown, Upload, Plus, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useProducts } from '../hooks/useProducts';
import { useWooCommerce } from '@/plugins/woocommerce-products/context/WooCommerceContext';
import { useCdonProducts } from '@/plugins/cdon-products/context/CdonProductsContext';
import { useFyndiqProducts } from '@/plugins/fyndiq-products/context/FyndiqProductsContext';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';

type SortField = 'productNumber' | 'title' | 'status' | 'quantity' | 'priceAmount' | 'sku';
type SortOrder = 'asc' | 'desc';

const PUBLISH_MARKETS = [
  { key: 'se' as const, label: 'Sweden' },
  { key: 'dk' as const, label: 'Denmark' },
  { key: 'fi' as const, label: 'Finland' },
];

const statusClass = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'for sale') return 'bg-green-100 text-green-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (s === 'archived') return 'bg-gray-100 text-gray-700';
  return 'bg-blue-100 text-blue-800';
};

export const ProductList: React.FC = () => {
  const {
    products,
    openProductForView,
    openProductForEdit,
    openProductPanel,
    // Selection API
    selectedProductIds,
    toggleProductSelected,
    selectAllProducts,
    clearProductSelection,
    // Bulk delete
    deleteProducts,
    // Batch update
    batchUpdateProducts,
    // Import
    importProducts,
  } = useProducts();

  const { settings: cdonSettings } = useCdonProducts();
  const { settings: fyndiqSettings } = useFyndiqProducts();

  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('productNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);

  const [wooInstances, setWooInstances] = useState<Array<{ id: string; instanceKey?: string; label?: string | null }>>([]);
  useEffect(() => {
    woocommerceApi.getInstances().then((r) => {
      if (r?.items?.length) setWooInstances(r.items);
    }).catch(() => setWooInstances([]));
  }, []);

  // Publish-modal state (WooCommerce is per-store)
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishWooInstanceIds, setPublishWooInstanceIds] = useState<string[]>([]);
  const [publishCdonMarkets, setPublishCdonMarkets] = useState<string[]>([]);
  const [publishFyndiqMarkets, setPublishFyndiqMarkets] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [lastPublishResult, setLastPublishResult] = useState<{
    woo?: { ok: boolean; result?: { create?: unknown[]; update?: unknown[] }; endpoint?: string; instances?: Array<{ instanceId: string | null; label: string | null; ok: boolean; counts?: { success?: number; error?: number } }> };
    cdon?: { ok: boolean; counts?: { requested?: number; success?: number; error?: number }; endpoint?: string };
    fyndiq?: { ok: boolean; counts?: { requested?: number; success?: number; error?: number }; endpoint?: string };
  } | null>(null);

  // Delete-modal state (WooCommerce is per-store)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFromWooInstanceIds, setDeleteFromWooInstanceIds] = useState<string[]>([]);
  const [deleteFromCdonMarkets, setDeleteFromCdonMarkets] = useState<string[]>([]);
  const [deleteFromFyndiqMarkets, setDeleteFromFyndiqMarkets] = useState<string[]>([]);
  const [alsoDeleteFromPlatform, setAlsoDeleteFromPlatform] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [lastDeleteResult, setLastDeleteResult] = useState<{
    woo?: { ok: boolean; deleted: number; endpoint?: string; errors?: string[] };
    cdon?: { ok: boolean; deleted: number; endpoint?: string };
    fyndiq?: { ok: boolean; deleted: number; endpoint?: string };
    platform?: { ok: boolean; deleted: number };
  } | null>(null);

  // Batch-edit modal state
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchEditUpdates, setBatchEditUpdates] = useState<{ priceAmount?: string; quantity?: string; status?: string; vatRate?: string; currency?: string }>({});
  const [batchEditApplying, setBatchEditApplying] = useState(false);
  const [lastBatchEditResult, setLastBatchEditResult] = useState<{ updatedCount: number } | null>(null);

  // Import-modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'update-only' | 'create-only' | 'upsert'>('upsert');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<any | null>(null);

  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Normalize products for consistent handling
  const normalize = (p: any) => {
    const rowId =
      p?.id ??
      p?._id ??
      p?.uuid ??
      p?.productId ??
      p?.productNumber ??
      p?.sku ??
      `${p?.title || 'item'}|${p?.createdAt || ''}|${p?.updatedAt || ''}`;

    return {
      id: String(rowId),
      productNumber: p.productNumber || '',
      title: p.title || '',
      status: p.status || 'for sale',
      quantity: Number.isFinite(p.quantity) ? p.quantity : 0,
      priceAmount: Number.isFinite(p.priceAmount) ? p.priceAmount : 0,
      currency: p.currency || 'SEK',
      sku: p.sku || '',
      mpn: p.mpn || null,
      vatRate: p.vatRate || 25,
      description: p.description || null,
      mainImage: p.mainImage || null,
      images: Array.isArray(p.images) ? p.images : [],
      categories: Array.isArray(p.categories) ? p.categories : [],
      brand: p.brand || null,
      gtin: p.gtin || null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      raw: p,
    };
  };

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const filtered = products.map(normalize).filter((p: any) => {
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        String(p.productNumber).toLowerCase().includes(needle) ||
        String(p.sku).toLowerCase().includes(needle) ||
        String(p.mpn || '').toLowerCase().includes(needle)
      );
    });

    const cmp = (a: any, b: any) => {
      let av: string | number = '';
      let bv: string | number = '';

      switch (sortField) {
        case 'title':
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case 'status':
          av = a.status.toLowerCase();
          bv = b.status.toLowerCase();
          break;
        case 'quantity':
          av = a.quantity;
          bv = b.quantity;
          break;
        case 'priceAmount':
          av = a.priceAmount;
          bv = b.priceAmount;
          break;
        case 'sku':
          av = (a.sku || '').toLowerCase();
          bv = (b.sku || '').toLowerCase();
          break;
        case 'productNumber':
        default:
          av = String(a.productNumber).toLowerCase();
          bv = String(b.productNumber).toLowerCase();
          break;
      }

      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const res = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [products, searchTerm, sortField, sortOrder]);

  // Selected products (actual objects)
  const selectedProducts = useMemo(() => {
    const set = new Set(selectedProductIds.map(String));
    return products.filter((p: any) => set.has(String(p?.id)));
  }, [products, selectedProductIds]);

  // Selection helpers
  const visibleIds = useMemo(
    () => filteredAndSorted.map((p: any) => String(p.id)),
    [filteredAndSorted],
  );
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.includes(id)),
    [visibleIds, selectedProductIds],
  );
  const someVisibleSelected = useMemo(
    () => visibleIds.some((id) => selectedProductIds.includes(id)),
    [visibleIds, selectedProductIds],
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = () => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedProductIds.filter((id) => !set.has(id));
      selectAllProducts(remaining);
    } else {
      const union = Array.from(new Set([...selectedProductIds, ...visibleIds]));
      selectAllProducts(union);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  // Protected navigation handlers
  const handleOpenForView = (product: any) => attemptNavigation(() => openProductForView(product));
  const handleOpenForEdit = (product: any) => attemptNavigation(() => openProductForEdit(product));
  const handleOpenPanel = () => attemptNavigation(() => openProductPanel(null));

  const total = products.length;
  const filtered = filteredAndSorted.length;
  const isWooConfigured = wooInstances.length > 0;
  const isCdonConfigured = !!(cdonSettings?.connected && cdonSettings?.apiKey && cdonSettings?.apiSecret);
  const isFyndiqConfigured = !!(fyndiqSettings?.connected && fyndiqSettings?.apiKey && fyndiqSettings?.apiSecret);

  // Delete action (modal confirm)
  const runDeleteFlow = async () => {
    if (selectedProductIds.length === 0) return;
    setDeleting(true);

    const attemptedPlatformIds = Array.from(new Set(selectedProductIds.map(String))).filter(Boolean);

    try {
      const nextResult: {
        woo?: { ok: boolean; deleted: number; endpoint?: string; errors?: string[] };
        cdon?: { ok: boolean; deleted: number; endpoint?: string };
        fyndiq?: { ok: boolean; deleted: number; endpoint?: string };
        platform?: { ok: boolean; deleted: number };
      } = {};

      // 1) WooCommerce (per-instance: send productIds + instanceIds so backend resolves external_id per store)
      if (deleteFromWooInstanceIds.length > 0 && isWooConfigured) {
        const wooResp = await woocommerceApi.deleteProducts({
          productIds: attemptedPlatformIds,
          ...(deleteFromWooInstanceIds.length > 0 ? { instanceIds: deleteFromWooInstanceIds } : {}),
        });

        const errors = Array.isArray(wooResp?.items)
          ? wooResp.items
              .filter((x: any) => x?.status === 'error')
              .map((x: any) => String(x?.message || 'Delete failed'))
          : [];

        nextResult.woo = {
          ok: errors.length === 0,
          deleted: Number(wooResp?.deleted || 0),
          endpoint: wooResp?.endpoint,
          errors: errors.length ? errors.slice(0, 5) : undefined,
        };
      }

      // 2) CDON (selected markets)
      if (deleteFromCdonMarkets.length > 0 && isCdonConfigured) {
        try {
          const r = await cdonApi.batchDelete(attemptedPlatformIds, {
            markets: deleteFromCdonMarkets as ('se' | 'dk' | 'fi')[],
          });
          nextResult.cdon = {
            ok: !!r?.ok,
            deleted: Number(r?.deleted ?? 0),
            endpoint: r?.endpoint,
          };
        } catch (e) {
          console.error('CDON batch delete failed', e);
          nextResult.cdon = { ok: false, deleted: 0 };
        }
      }

      // 3) Fyndiq (selected markets)
      if (deleteFromFyndiqMarkets.length > 0 && isFyndiqConfigured) {
        try {
          const r = await fyndiqApi.batchDelete(attemptedPlatformIds, {
            markets: deleteFromFyndiqMarkets as ('se' | 'dk' | 'fi')[],
          });
          nextResult.fyndiq = {
            ok: !!r?.ok,
            deleted: Number(r?.deleted ?? 0),
            endpoint: r?.endpoint,
          };
        } catch (e) {
          console.error('Fyndiq batch delete failed', e);
          nextResult.fyndiq = { ok: false, deleted: 0 };
        }
      }

      // 4) Platform (our DB)
      if (alsoDeleteFromPlatform) {
        await deleteProducts(attemptedPlatformIds);
        nextResult.platform = { ok: true, deleted: attemptedPlatformIds.length };
      }

      setLastDeleteResult(nextResult);
      setShowDeleteModal(false);

      if (alsoDeleteFromPlatform) {
        clearProductSelection();
      }
    } catch (err: any) {
      console.error('Bulk delete failed', err);
      setLastDeleteResult({
        woo: deleteFromWooInstanceIds.length > 0 ? { ok: false, deleted: 0, errors: [String(err?.message || err)] } : undefined,
        cdon: deleteFromCdonMarkets.length ? { ok: false, deleted: 0 } : undefined,
        fyndiq: deleteFromFyndiqMarkets.length ? { ok: false, deleted: 0 } : undefined,
        platform: alsoDeleteFromPlatform ? { ok: false, deleted: 0 } : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const runImportFlow = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const resp = await importProducts(importFile, importMode);
      setLastImportResult(resp);
      // After import, selection may be stale
      clearProductSelection();
    } catch (err: any) {
      console.error('Import failed:', err);
      setLastImportResult({
        ok: false,
        error: String(err?.message || err?.error || err),
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {filtered !== total ? `${filtered} of ${total}` : `${total}`} products
          </p>
          {selectedProductIds.length > 0 && (
            <div className="mt-2 text-sm flex items-center flex-wrap gap-2">
              <Badge variant="secondary">{selectedProductIds.length} selected</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearProductSelection()}
              >
                Clear selection
              </Button>

              {/* Publish… */}
              <button
                className="ml-1 inline-flex items-center px-3 py-1.5 rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm"
                onClick={() => {
                  setPublishWooInstanceIds(isWooConfigured ? wooInstances.map((i) => i.id) : []);
                  setPublishCdonMarkets(isCdonConfigured ? ['se'] : []);
                  setPublishFyndiqMarkets(isFyndiqConfigured ? ['se'] : []);
                  setLastPublishResult(null);
                  setShowPublishModal(true);
                }}
              >
                Publish…
              </button>

              {/* Batch Edit… */}
              <button
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-amber-600 text-amber-700 hover:bg-amber-50 text-sm"
                onClick={() => {
                  setBatchEditUpdates({});
                  setLastBatchEditResult(null);
                  setShowBatchEditModal(true);
                }}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Batch Edit…
              </button>

              {/* Delete… */}
              <button
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-red-600 text-red-700 hover:bg-red-50 text-sm"
                onClick={() => {
                  setDeleteFromWooInstanceIds([]);
                  setDeleteFromCdonMarkets(isCdonConfigured ? ['se'] : []);
                  setDeleteFromFyndiqMarkets(isFyndiqConfigured ? ['se'] : []);
                  setAlsoDeleteFromPlatform(false);
                  setShowDeleteModal(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete…
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title, SKU or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-4 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLastImportResult(null);
                setImportFile(null);
                setImportMode('upsert');
                setShowImportModal(true);
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
      </div>

      {/* Publish-feedback after execution */}
      {lastPublishResult && (
        <div className="mb-4">
          <div
            className={`rounded-md border p-3 text-sm ${
              Object.values(lastPublishResult).every((r) => r?.ok !== false)
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">
              {Object.values(lastPublishResult).every((r) => r?.ok !== false)
                ? 'Publish completed'
                : 'Publish failed'}
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {lastPublishResult.woo != null && (
                <div>
                  WooCommerce:{' '}
                  {lastPublishResult.woo.ok ? (
                    Array.isArray(lastPublishResult.woo.instances) && lastPublishResult.woo.instances.length > 0 ? (
                      <>{(lastPublishResult.woo.instances as any[]).filter((i) => i.ok).length} store(s) updated</>
                    ) : (
                      <>
                        Created {Array.isArray(lastPublishResult.woo.result?.create) ? lastPublishResult.woo.result.create.length : 0},{' '}
                        Updated {Array.isArray(lastPublishResult.woo.result?.update) ? lastPublishResult.woo.result.update.length : 0}
                      </>
                    )
                  ) : (
                    'failed'
                  )}
                </div>
              )}
              {lastPublishResult.cdon != null && (
                <div>
                  CDON:{' '}
                  {lastPublishResult.cdon.ok ? (
                    <>
                      {lastPublishResult.cdon.counts?.requested ?? 0} requested,{' '}
                      {lastPublishResult.cdon.counts?.success ?? 0} success
                    </>
                  ) : (
                    'failed'
                  )}
                </div>
              )}
              {lastPublishResult.fyndiq != null && (
                <div>
                  Fyndiq:{' '}
                  {lastPublishResult.fyndiq.ok ? (
                    <>
                      {lastPublishResult.fyndiq.counts?.requested ?? 0} requested,{' '}
                      {lastPublishResult.fyndiq.counts?.success ?? 0} success
                    </>
                  ) : (
                    'failed'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete-feedback after execution */}
      {lastDeleteResult && (
        <div className="mb-4">
          <div
            className={`rounded-md border p-3 text-sm ${
              Object.values(lastDeleteResult).every((r) => r?.ok !== false)
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">
              {Object.values(lastDeleteResult).every((r) => r?.ok !== false)
                ? 'Delete completed'
                : 'Delete failed'}
            </div>

            {lastDeleteResult.woo && (
              <div className="mt-2">
                <div className="text-sm">WooCommerce deleted: {lastDeleteResult.woo.deleted}</div>
                {lastDeleteResult.woo.endpoint && (
                  <div className="mt-1 text-xs break-all">Endpoint: {lastDeleteResult.woo.endpoint}</div>
                )}
                {lastDeleteResult.woo.errors?.length ? (
                  <div className="mt-2 text-xs">
                    {lastDeleteResult.woo.errors.map((e, i) => (
                      <div key={i} className="break-all">
                        • {e}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {lastDeleteResult.cdon != null && (
              <div className="mt-2 text-sm">CDON deleted: {lastDeleteResult.cdon.deleted}</div>
            )}

            {lastDeleteResult.fyndiq != null && (
              <div className="mt-2 text-sm">Fyndiq deleted: {lastDeleteResult.fyndiq.deleted}</div>
            )}

            {lastDeleteResult.platform && (
              <div className="mt-2 text-sm">Platform deleted: {lastDeleteResult.platform.deleted}</div>
            )}
          </div>
        </div>
      )}

      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search products..."
      />

      <Card className="shadow-none">
        {!isMobileView ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="rounded border-input"
                    aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('productNumber')}
                >
                  <div className="flex items-center gap-2">
                    #<SortIcon field="productNumber" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    Title<SortIcon field="title" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('sku')}
                >
                  <div className="flex items-center gap-2">
                    SKU<SortIcon field="sku" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status<SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center gap-2">
                    Qty<SortIcon field="quantity" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('priceAmount')}
                >
                  <div className="flex items-center gap-2">
                    Price<SortIcon field="priceAmount" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-6 text-center text-muted-foreground">
                    {searchTerm
                      ? 'No products found matching your search.'
                      : 'No products yet. Click "Add Product" to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((p: any) => {
                  const raw = p.raw;
                  const isSelected = selectedProductIds.includes(p.id);
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      data-list-item={JSON.stringify(raw)}
                      data-plugin-name="products"
                      role="button"
                      aria-label={`Open product ${p.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenForView(raw);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleProductSelected(p.id)}
                          aria-label={isSelected ? 'Unselect product' : 'Select product'}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono font-medium">
                          #{p.productNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{p.sku || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusClass(p.status)}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{p.quantity}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {p.priceAmount?.toFixed
                            ? p.priceAmount.toFixed(2)
                            : Number(p.priceAmount || 0).toFixed(2)}{' '}
                          {p.currency}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenForView(raw);
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenForEdit(raw);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="divide-y">
            {filteredAndSorted.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm
                  ? 'No products found matching your search.'
                  : 'No products yet. Click "Add Product" to get started.'}
              </div>
            ) : (
              filteredAndSorted.map((p: any) => {
                const isSelected = selectedProductIds.includes(p.id);
                return (
                  <div key={p.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={isSelected}
                          onChange={() => toggleProductSelected(p.id)}
                          aria-label={isSelected ? 'Unselect product' : 'Select product'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium">{p.title}</h3>
                        <div className="mt-1 space-y-1">
                          <div className="text-xs text-muted-foreground">
                            #{p.productNumber} · {p.sku || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.priceAmount?.toFixed
                              ? p.priceAmount.toFixed(2)
                              : Number(p.priceAmount || 0).toFixed(2)}{' '}
                            {p.currency}
                          </div>
                          <div>
                            <Badge className={statusClass(p.status)}>{p.status}</Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => attemptNavigation(() => openProductForView(p.raw))}
                          className="h-8 px-3"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>

      {/* Publish-modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPublishModal(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
              <h3 className="mb-0 text-lg font-semibold">
                  Publish selected products
                </h3>
                <div className="text-xs text-gray-500">
                  {selectedProducts.length} products selected
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Choose channels / stores</div>
                  <div className="space-y-3">
                    <div className={!isWooConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">WooCommerce {isWooConfigured ? '' : '(not connected)'}</div>
                      {wooInstances.length > 0 ? (
                        <div className="flex flex-wrap gap-4 pl-5">
                          {wooInstances.map((inst) => (
                            <label key={inst.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!isWooConfigured}
                                checked={isWooConfigured && publishWooInstanceIds.includes(inst.id)}
                                onChange={(e) => {
                                  if (!isWooConfigured) return;
                                  setPublishWooInstanceIds((prev) =>
                                    e.target.checked ? [...prev, inst.id] : prev.filter((id) => id !== inst.id)
                                  );
                                }}
                              />
                              <span>{inst.label || inst.instanceKey || inst.id}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 pl-5">No WooCommerce stores added. Add a store in Settings.</p>
                      )}
                    </div>
                    <div className={!isCdonConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">CDON {isCdonConfigured ? '' : '(not connected)'}</div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isCdonConfigured}
                              checked={isCdonConfigured && publishCdonMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isCdonConfigured) return;
                                setPublishCdonMarkets((prev) =>
                                  e.target.checked ? [...prev.filter((m) => m !== key), key] : prev.filter((m) => m !== key)
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={!isFyndiqConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">Fyndiq {isFyndiqConfigured ? '' : '(not connected)'}</div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isFyndiqConfigured}
                              checked={isFyndiqConfigured && publishFyndiqMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isFyndiqConfigured) return;
                                setPublishFyndiqMarkets((prev) =>
                                  e.target.checked ? [...prev.filter((m) => m !== key), key] : prev.filter((m) => m !== key)
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md border text-sm"
                  onClick={() => setShowPublishModal(false)}
                  disabled={publishing}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
                  disabled={
                    publishing ||
                    selectedProducts.length === 0 ||
                    (publishWooInstanceIds.length === 0 && !publishCdonMarkets.length && !publishFyndiqMarkets.length)
                  }
                  onClick={async () => {
                    const payload = selectedProducts.map((p: any) => ({
                      id: p.id,
                      productNumber: p.productNumber,
                      sku: p.sku,
                      mpn: p.mpn,
                      title: p.title,
                      status: p.status,
                      quantity: p.quantity,
                      priceAmount: p.priceAmount,
                      currency: p.currency,
                      vatRate: p.vatRate,
                      description: p.description,
                      mainImage: p.mainImage,
                      images: p.images,
                      categories: p.categories,
                      brand: p.brand,
                      gtin: p.gtin,
                      createdAt: p.createdAt,
                      updatedAt: p.updatedAt,
                    }));
                    setPublishing(true);
                    const result: NonNullable<typeof lastPublishResult> = {};
                    try {
                      if (publishWooInstanceIds.length > 0 && isWooConfigured) {
                        try {
                          const r = await woocommerceApi.exportProducts(
                            payload,
                            publishWooInstanceIds.length > 0 ? { instanceIds: publishWooInstanceIds } : undefined
                          );
                          result.woo = {
                            ok: !!r?.ok,
                            result: r?.result,
                            endpoint: r?.endpoint,
                            instances: (r as any)?.instances,
                          };
                        } catch (e) {
                          console.error('WooCommerce export failed', e);
                          result.woo = { ok: false };
                        }
                      }
                      if (publishCdonMarkets.length > 0 && isCdonConfigured) {
                        try {
                          const r = await cdonApi.exportProducts(payload, {
                            markets: publishCdonMarkets as ('se' | 'dk' | 'fi')[],
                          });
                          result.cdon = { ok: !!r?.ok, counts: r?.counts, endpoint: r?.endpoint };
                        } catch (e) {
                          console.error('CDON export failed', e);
                          result.cdon = { ok: false };
                        }
                      }
                      if (publishFyndiqMarkets.length > 0 && isFyndiqConfigured) {
                        try {
                          const r = await fyndiqApi.exportProducts(payload, {
                            markets: publishFyndiqMarkets as ('se' | 'dk' | 'fi')[],
                          });
                          result.fyndiq = { ok: !!r?.ok, counts: r?.counts, endpoint: r?.endpoint };
                        } catch (e) {
                          console.error('Fyndiq export failed', e);
                          result.fyndiq = { ok: false };
                        }
                      }
                      setLastPublishResult(result);
                      setShowPublishModal(false);
                    } finally {
                      setPublishing(false);
                    }
                  }}
                >
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import-modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!importing) setShowImportModal(false);
            }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">
                  Import products
                </h3>
                <div className="text-xs text-gray-500">
                  Upload a .csv or .xlsx file and choose how to apply it.
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Mode</div>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                    disabled={importing}
                  >
                    <option value="upsert">Upsert (update if SKU exists, else create)</option>
                    <option value="update-only">Update-only (skip new SKUs)</option>
                    <option value="create-only">Create-only (skip existing SKUs)</option>
                  </select>
                  <div className="text-xs text-gray-500">
                    SKU is always required. For new products, Title is required.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">File</div>
                  <input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={importing}
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <div className="text-xs text-gray-600">
                      Selected: <span className="font-mono">{importFile.name}</span>
                    </div>
                  )}
                </div>

                {lastImportResult && (
                  <div className="rounded-md border p-3 text-sm">
                    {lastImportResult.ok === false ? (
                      <div className="text-red-700">Import failed: {String(lastImportResult.error || 'Unknown error')}</div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium">Import result</div>
                        <div className="text-xs text-gray-600">
                          Mode: {lastImportResult.mode} · Rows: {lastImportResult.totalRows}
                        </div>
                        <div>
                          Created: {lastImportResult.created} · Updated: {lastImportResult.updated}
                        </div>
                        <div className="text-xs text-gray-600">
                          Missing SKU: {Array.isArray(lastImportResult.skippedMissingSku) ? lastImportResult.skippedMissingSku.length : 0}
                          {' · '}
                          Invalid: {Array.isArray(lastImportResult.skippedInvalid) ? lastImportResult.skippedInvalid.length : 0}
                          {' · '}
                          Conflicts: {Array.isArray(lastImportResult.conflicts) ? lastImportResult.conflicts.length : 0}
                          {' · '}
                          Not found: {Array.isArray(lastImportResult.notFound) ? lastImportResult.notFound.length : 0}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md border text-sm"
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                >
                  Close
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
                  disabled={importing || !importFile}
                  onClick={runImportFlow}
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Edit modal */}
      {showBatchEditModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBatchEditModal(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">Batch Edit</h3>
                <div className="text-xs text-gray-500">{selectedProductIds.length} products selected. Set only the fields you want to change.</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Price</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Leave empty to skip"
                      value={batchEditUpdates.priceAmount ?? ''}
                      onChange={(e) => setBatchEditUpdates((u) => ({ ...u, priceAmount: e.target.value }))}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Quantity</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Leave empty to skip"
                      value={batchEditUpdates.quantity ?? ''}
                      onChange={(e) => setBatchEditUpdates((u) => ({ ...u, quantity: e.target.value }))}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={batchEditUpdates.status ?? ''}
                      onChange={(e) => setBatchEditUpdates((u) => ({ ...u, status: e.target.value || undefined }))}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">— No change —</option>
                      <option value="for sale">For sale</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">VAT rate (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Leave empty to skip"
                      value={batchEditUpdates.vatRate ?? ''}
                      onChange={(e) => setBatchEditUpdates((u) => ({ ...u, vatRate: e.target.value }))}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Currency</label>
                    <select
                      value={batchEditUpdates.currency ?? ''}
                      onChange={(e) => setBatchEditUpdates((u) => ({ ...u, currency: e.target.value || undefined }))}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">— No change —</option>
                      <option value="SEK">SEK</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="NOK">NOK</option>
                      <option value="DKK">DKK</option>
                    </select>
                  </div>
                </div>
                {lastBatchEditResult != null && (
                  <div className="rounded-md border border-green-200 bg-green-50 text-green-800 p-2 text-sm">
                    Updated {lastBatchEditResult.updatedCount} product(s).
                  </div>
                )}
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md border text-sm"
                  onClick={() => setShowBatchEditModal(false)}
                  disabled={batchEditApplying}
                >
                  Close
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm disabled:opacity-50"
                  disabled={
                    batchEditApplying ||
                    selectedProductIds.length === 0 ||
                    (!batchEditUpdates.priceAmount &&
                      !batchEditUpdates.quantity &&
                      !batchEditUpdates.status &&
                      !batchEditUpdates.vatRate &&
                      !batchEditUpdates.currency)
                  }
                  onClick={async () => {
                    const updates: { priceAmount?: number; quantity?: number; status?: string; vatRate?: number; currency?: string } = {};
                    if (batchEditUpdates.priceAmount != null && batchEditUpdates.priceAmount !== '') {
                      const n = Number(batchEditUpdates.priceAmount.replace(',', '.'));
                      if (Number.isFinite(n)) updates.priceAmount = n;
                    }
                    if (batchEditUpdates.quantity != null && batchEditUpdates.quantity !== '') {
                      const n = Number(batchEditUpdates.quantity);
                      if (Number.isFinite(n) && n >= 0) updates.quantity = Math.trunc(n);
                    }
                    if (batchEditUpdates.status) updates.status = batchEditUpdates.status;
                    if (batchEditUpdates.vatRate != null && batchEditUpdates.vatRate !== '') {
                      const n = Number(batchEditUpdates.vatRate.replace(',', '.'));
                      if (Number.isFinite(n)) updates.vatRate = n;
                    }
                    if (batchEditUpdates.currency) updates.currency = batchEditUpdates.currency;
                    if (Object.keys(updates).length === 0) return;
                    setBatchEditApplying(true);
                    try {
                      const result = await batchUpdateProducts(selectedProductIds, updates);
                      setLastBatchEditResult({ updatedCount: result.updatedCount });
                    } catch (err: any) {
                      console.error('Batch edit failed', err);
                      setLastBatchEditResult({ updatedCount: 0 });
                    } finally {
                      setBatchEditApplying(false);
                    }
                  }}
                >
                  {batchEditApplying ? 'Applying…' : `Apply to ${selectedProductIds.length} products`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete-modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">
                  Delete selected products
                </h3>
                <div className="text-xs text-gray-500">
                  {selectedProducts.length} products selected
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Choose channels / stores to delete from</div>
                  <div className="space-y-3">
                    <div className={!isWooConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">WooCommerce {isWooConfigured ? '' : '(not connected)'}</div>
                      {wooInstances.length > 0 ? (
                        <div className="flex flex-wrap gap-4 pl-5">
                          {wooInstances.map((inst) => (
                            <label key={inst.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!isWooConfigured}
                                checked={isWooConfigured && deleteFromWooInstanceIds.includes(inst.id)}
                                onChange={(e) => {
                                  if (!isWooConfigured) return;
                                  setDeleteFromWooInstanceIds((prev) =>
                                    e.target.checked ? [...prev, inst.id] : prev.filter((id) => id !== inst.id)
                                  );
                                }}
                              />
                              <span>{inst.label || inst.instanceKey || inst.id}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 pl-5">No WooCommerce stores added.</p>
                      )}
                    </div>
                    <div className={!isCdonConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">CDON {isCdonConfigured ? '' : '(not connected)'}</div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isCdonConfigured}
                              checked={isCdonConfigured && deleteFromCdonMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isCdonConfigured) return;
                                setDeleteFromCdonMarkets((prev: string[]) =>
                                  e.target.checked
                                    ? [...prev.filter((m: string) => m !== key), key as string]
                                    : prev.filter((m: string) => m !== key)
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={!isFyndiqConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">Fyndiq {isFyndiqConfigured ? '' : '(not connected)'}</div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isFyndiqConfigured}
                              checked={isFyndiqConfigured && deleteFromFyndiqMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isFyndiqConfigured) return;
                                setDeleteFromFyndiqMarkets((prev: string[]) =>
                                  e.target.checked
                                    ? [...prev.filter((m: string) => m !== key), key as string]
                                    : prev.filter((m: string) => m !== key)
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alsoDeleteFromPlatform}
                      onChange={(e) => setAlsoDeleteFromPlatform(e.target.checked)}
                    />
                    <span>Also delete from platform</span>
                  </label>
                  <div className="text-xs text-gray-500 ml-6">
                    If checked, products will be permanently deleted from the platform database (cannot be undone).
                  </div>
                </div>
              </div>

              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md border text-sm"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm disabled:opacity-50"
                  disabled={
                    deleting ||
                    selectedProducts.length === 0 ||
                    (deleteFromWooInstanceIds.length === 0 &&
                      !deleteFromCdonMarkets.length &&
                      !deleteFromFyndiqMarkets.length &&
                      !alsoDeleteFromPlatform)
                  }
                  onClick={runDeleteFlow}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
