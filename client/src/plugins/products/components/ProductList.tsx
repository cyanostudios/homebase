import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Pencil,
  Settings,
  X,
  Minus,
  Plus,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { useCdonProducts } from '@/plugins/cdon-products/context/CdonProductsContext';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';
import { useFyndiqProducts } from '@/plugins/fyndiq-products/context/FyndiqProductsContext';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';

import { productsApi } from '../api/productsApi';
import { useProducts } from '../hooks/useProducts';

import { ProductSettingsForm } from './ProductSettingsForm';

type SortField = 'id' | 'title' | 'quantity' | 'priceAmount' | 'sku';
type SortOrder = 'asc' | 'desc';

const PUBLISH_MARKETS = [
  { key: 'se' as const, label: 'Sweden' },
  { key: 'dk' as const, label: 'Denmark' },
  { key: 'fi' as const, label: 'Finland' },
];

/** Returns true if product is a variant (has groupVariationType) but the variation value is empty. */
function variantMissingValue(p: {
  groupVariationType?: string | null;
  color?: string | null;
  colorText?: string | null;
  size?: string | null;
  sizeText?: string | null;
  model?: string | null;
}): boolean {
  const t = p?.groupVariationType?.toLowerCase();
  if (!t || !['color', 'size', 'model'].includes(t)) {
    return false;
  }
  if (t === 'color') {
    return !(String(p?.color ?? '').trim() || String(p?.colorText ?? '').trim());
  }
  if (t === 'size') {
    return !(String(p?.size ?? '').trim() || String(p?.sizeText ?? '').trim());
  }
  return !String(p?.model ?? '').trim();
}

const VARIATION_TYPE_LABEL: Record<string, string> = {
  color: 'Färg',
  size: 'Storlek',
  model: 'Modell',
};

export const ProductList: React.FC = () => {
  const {
    products,
    openProductForEdit,
    openProductPanel,
    openProductPanelForBatch,
    // Selection API
    selectedProductIds,
    toggleProductSelected,
    selectAllProducts,
    clearProductSelection,
    // Bulk delete
    deleteProducts,
    // Batch update
    batchUpdateProducts,
    // Group products (variant group)
    groupProducts,
    // Import
    importProducts,
  } = useProducts();

  const { settings: cdonSettings } = useCdonProducts();
  const { settings: fyndiqSettings } = useFyndiqProducts();

  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [listFilter, setListFilter] = useState<string>('all');
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    productsApi
      .getLists()
      .then((data) => setLists(data || []))
      .catch(() => setLists([]));
  }, []);

  const [wooInstances, setWooInstances] = useState<
    Array<{ id: string; instanceKey?: string; label?: string | null }>
  >([]);
  useEffect(() => {
    woocommerceApi
      .getInstances()
      .then((r) => {
        if (r?.items?.length) {
          setWooInstances(r.items);
        }
      })
      .catch(() => setWooInstances([]));
  }, []);

  // Publish-modal state (WooCommerce is per-store)
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishWooInstanceIds, setPublishWooInstanceIds] = useState<string[]>([]);
  const [publishCdonMarkets, setPublishCdonMarkets] = useState<string[]>([]);
  const [publishFyndiqMarkets, setPublishFyndiqMarkets] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [lastPublishSkipped, setLastPublishSkipped] = useState<
    Array<{ id: string; title?: string; groupVariationType: string }>
  >([]);
  const [lastPublishResult, setLastPublishResult] = useState<{
    woo?: {
      ok: boolean;
      result?: { create?: unknown[]; update?: unknown[] };
      endpoint?: string;
      instances?: Array<{
        instanceId: string | null;
        label: string | null;
        ok: boolean;
        counts?: { success?: number; error?: number };
      }>;
    };
    cdon?: {
      ok: boolean;
      counts?: { requested?: number; success?: number; error?: number };
      endpoint?: string;
    };
    fyndiq?: {
      ok: boolean;
      counts?: { requested?: number; success?: number; error?: number };
      endpoint?: string;
    };
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
  const [batchEditUpdates, setBatchEditUpdates] = useState<{
    priceAmount?: string;
    quantity?: string;
    vatRate?: string;
    currency?: string;
  }>({});
  const [batchEditApplying, setBatchEditApplying] = useState(false);
  const [lastBatchEditResult, setLastBatchEditResult] = useState<{ updatedCount: number } | null>(
    null,
  );

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupVariationType, setGroupVariationType] = useState<'color' | 'size' | 'model'>('color');
  const [groupMainProductId, setGroupMainProductId] = useState<string>('');
  const [groupApplying, setGroupApplying] = useState(false);
  const [quantityUpdatingId, setQuantityUpdatingId] = useState<string | null>(null);
  const [quantityDialog, setQuantityDialog] = useState<{
    productId: string;
    currentQty: number;
    direction: 'plus' | 'minus';
  } | null>(null);
  const [quantityDialogInput, setQuantityDialogInput] = useState('1');

  // Import-modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProductSettings, setShowProductSettings] = useState(false);
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

  const openQuantityDialog = (
    productId: string,
    currentQty: number,
    direction: 'plus' | 'minus',
  ) => {
    setQuantityDialog({ productId, currentQty, direction });
    setQuantityDialogInput('1');
  };

  const confirmQuantityDialog = async () => {
    if (!quantityDialog) {
      return;
    }
    const delta = Math.floor(Number(quantityDialogInput));
    if (!Number.isFinite(delta) || delta < 1) {
      return;
    }
    const { productId, currentQty, direction } = quantityDialog;
    const newQty = direction === 'plus' ? currentQty + delta : Math.max(0, currentQty - delta);
    setQuantityDialog(null);
    setQuantityUpdatingId(productId);
    try {
      await batchUpdateProducts([productId], { quantity: newQty });
    } finally {
      setQuantityUpdatingId(null);
    }
  };

  // Normalize products for consistent handling
  const normalize = (p: any) => {
    const rowId =
      p?.id ??
      p?._id ??
      p?.uuid ??
      p?.productId ??
      p?.sku ??
      `${p?.title || 'item'}|${p?.createdAt || ''}|${p?.updatedAt || ''}`;
    const raw = p?.raw ?? p;
    const groupId =
      p?.groupId ??
      raw?.groupId ??
      (raw?.group_id !== null && raw?.group_id !== undefined ? String(raw.group_id) : null);
    const parentProductId =
      p?.parentProductId ??
      raw?.parentProductId ??
      (raw?.parent_product_id !== null && raw?.parent_product_id !== undefined
        ? String(raw.parent_product_id)
        : null);
    const groupVariationType =
      p?.groupVariationType ??
      raw?.groupVariationType ??
      (raw?.group_variation_type !== null && raw?.group_variation_type !== undefined
        ? String(raw.group_variation_type)
        : null);

    return {
      id: String(rowId),
      title: p.title || '',
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
      listId: p.listId ?? null,
      listName: p.listName ?? null,
      groupId: groupId && String(groupId).trim() ? String(groupId).trim() : null,
      parentProductId:
        parentProductId && String(parentProductId).trim() ? String(parentProductId).trim() : null,
      groupVariationType:
        groupVariationType && String(groupVariationType).trim()
          ? String(groupVariationType).trim()
          : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      raw: p,
    };
  };

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    let filtered = products.map(normalize).filter((p: any) => {
      if (!needle) {
        return true;
      }
      return (
        p.title.toLowerCase().includes(needle) ||
        String(p.id).toLowerCase().includes(needle) ||
        String(p.sku).toLowerCase().includes(needle) ||
        String(p.mpn || '')
          .toLowerCase()
          .includes(needle)
      );
    });

    if (listFilter !== 'all') {
      filtered = filtered.filter((p: any) => {
        const lid = p.raw?.listId ?? p.listId ?? null;
        const empty = (lid ?? null) === null || String(lid).trim() === '';
        if (listFilter === 'main') {
          return empty;
        }
        return String(lid) === String(listFilter);
      });
    }

    const cmp = (a: any, b: any) => {
      let av: string | number = '';
      let bv: string | number = '';

      switch (sortField) {
        case 'title':
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
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
        case 'id':
        default:
          av = String(a.id).toLowerCase();
          bv = String(b.id).toLowerCase();
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
  }, [products, searchTerm, listFilter, sortField, sortOrder]);

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
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  /** Product groups by groupId (only groups with ≥2 products) for visual grouping like in order list. */
  const productGroups = useMemo(() => {
    const map = new Map<string, typeof filteredAndSorted>();
    for (const p of filteredAndSorted) {
      const key = p.groupId ?? null;
      if (key) {
        const arr = map.get(key) ?? [];
        arr.push(p);
        map.set(key, arr);
      }
    }
    for (const [k, v] of map.entries()) {
      if (v.length < 2) {
        map.delete(k);
      }
    }
    return map;
  }, [filteredAndSorted]);

  const getGroupInfo = useCallback(
    (p: { id: string; groupId?: string | null }) => {
      const key = p.groupId ?? null;
      if (!key || !productGroups.has(key)) {
        return null;
      }
      const arr = productGroups.get(key)!;
      const idx = arr.findIndex((x) => String(x.id) === String(p.id));
      if (idx < 0) {
        return null;
      }
      const typeLabel =
        VARIATION_TYPE_LABEL[arr[0]?.groupVariationType ?? ''] ??
        arr[0]?.groupVariationType ??
        'variant';
      return {
        key,
        index: idx,
        total: arr.length,
        isFirst: idx === 0,
        isLast: idx === arr.length - 1,
        typeLabel,
      };
    },
    [productGroups],
  );

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
    if (sortField !== field) {
      return null;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  // Protected navigation handlers
  const handleOpenProduct = (product: any) => attemptNavigation(() => openProductForEdit(product));
  const _handleOpenPanel = () => attemptNavigation(() => openProductPanel(null));

  const total = products.length;
  const filtered = filteredAndSorted.length;
  const isWooConfigured = wooInstances.length > 0;
  const isCdonConfigured = !!(
    cdonSettings?.connected &&
    cdonSettings?.apiKey &&
    cdonSettings?.apiSecret
  );
  const isFyndiqConfigured = !!(
    fyndiqSettings?.connected &&
    fyndiqSettings?.apiKey &&
    fyndiqSettings?.apiSecret
  );

  // Delete action (modal confirm)
  const runDeleteFlow = async () => {
    if (selectedProductIds.length === 0) {
      return;
    }
    setDeleting(true);

    const attemptedPlatformIds = Array.from(new Set(selectedProductIds.map(String))).filter(
      Boolean,
    );

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
        woo:
          deleteFromWooInstanceIds.length > 0
            ? { ok: false, deleted: 0, errors: [String(err?.message || err)] }
            : undefined,
        cdon: deleteFromCdonMarkets.length ? { ok: false, deleted: 0 } : undefined,
        fyndiq: deleteFromFyndiqMarkets.length ? { ok: false, deleted: 0 } : undefined,
        platform: alsoDeleteFromPlatform ? { ok: false, deleted: 0 } : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const runImportFlow = async () => {
    if (!importFile) {
      return;
    }
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
              <Button variant="ghost" size="sm" onClick={() => clearProductSelection()}>
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
                  setLastPublishSkipped([]);
                  setShowPublishModal(true);
                }}
              >
                Publish…
              </button>

              {/* Batch Edit… — opens same product form in batch mode (only filled fields applied) */}
              <button
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-amber-600 text-amber-700 hover:bg-amber-50 text-sm"
                onClick={() =>
                  attemptNavigation(() => openProductPanelForBatch(selectedProductIds))
                }
              >
                <Pencil className="w-4 h-4 mr-1" />
                Batch Edit…
              </button>

              {/* Group… — set variant group (color/size/model) + parent */}
              {selectedProductIds.length >= 2 && (
                <button
                  className="inline-flex items-center px-3 py-1.5 rounded-md border border-violet-600 text-violet-700 hover:bg-violet-50 text-sm"
                  onClick={() => {
                    setGroupVariationType('color');
                    setGroupMainProductId(selectedProductIds[0] ?? '');
                    setShowGroupModal(true);
                  }}
                >
                  Group…
                </button>
              )}

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
          <select
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Filter by list"
          >
            <option value="all">Alla produkter</option>
            <option value="main">Huvudlista</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProductSettings(true)}
              title="Produktinställningar"
            >
              <Settings className="w-4 h-4 mr-2" />
              Inställningar
            </Button>
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
      {lastPublishSkipped.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-medium">
            {lastPublishSkipped.length} produkt(er) exporterades inte: varianter saknar{' '}
            {[
              ...new Set(
                lastPublishSkipped.map(
                  (s) => VARIATION_TYPE_LABEL[s.groupVariationType] || s.groupVariationType,
                ),
              ),
            ].join(' eller ')}
            .
          </div>
          <ul className="mt-2 list-disc list-inside text-xs">
            {lastPublishSkipped.slice(0, 10).map((s) => (
              <li key={s.id}>
                {s.title || s.id} (saknar{' '}
                {VARIATION_TYPE_LABEL[s.groupVariationType] || s.groupVariationType})
              </li>
            ))}
            {lastPublishSkipped.length > 10 && <li>… och {lastPublishSkipped.length - 10} till</li>}
          </ul>
        </div>
      )}
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
              {lastPublishResult.woo !== null && lastPublishResult.woo !== undefined && (
                <div>
                  WooCommerce:{' '}
                  {lastPublishResult.woo.ok ? (
                    Array.isArray(lastPublishResult.woo.instances) &&
                    lastPublishResult.woo.instances.length > 0 ? (
                      <>
                        {(lastPublishResult.woo.instances as any[]).filter((i) => i.ok).length}{' '}
                        store(s) updated
                      </>
                    ) : (
                      <>
                        Created{' '}
                        {Array.isArray(lastPublishResult.woo.result?.create)
                          ? lastPublishResult.woo.result.create.length
                          : 0}
                        , Updated{' '}
                        {Array.isArray(lastPublishResult.woo.result?.update)
                          ? lastPublishResult.woo.result.update.length
                          : 0}
                      </>
                    )
                  ) : (
                    'failed'
                  )}
                </div>
              )}
              {lastPublishResult.cdon !== null && lastPublishResult.cdon !== undefined && (
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
              {lastPublishResult.fyndiq !== null && lastPublishResult.fyndiq !== undefined && (
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
                  <div className="mt-1 text-xs break-all">
                    Endpoint: {lastDeleteResult.woo.endpoint}
                  </div>
                )}
                {lastDeleteResult.woo.errors?.length ? (
                  <div className="mt-2 text-xs">
                    {lastDeleteResult.woo.errors.map((e, i) => (
                      /* eslint-disable-next-line react/no-array-index-key -- error list has no stable ids */
                      <div key={i} className="break-all">
                        • {e}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {lastDeleteResult.cdon !== null && lastDeleteResult.cdon !== undefined && (
              <div className="mt-2 text-sm">CDON deleted: {lastDeleteResult.cdon.deleted}</div>
            )}

            {lastDeleteResult.fyndiq !== null && lastDeleteResult.fyndiq !== undefined && (
              <div className="mt-2 text-sm">Fyndiq deleted: {lastDeleteResult.fyndiq.deleted}</div>
            )}

            {lastDeleteResult.platform && (
              <div className="mt-2 text-sm">
                Platform deleted: {lastDeleteResult.platform.deleted}
              </div>
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
                <TableHead className="w-5 p-0" aria-hidden />
                <TableHead className="w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-input"
                    aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-2">
                    #<SortIcon field="id" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    Title
                    <SortIcon field="title" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('sku')}
                >
                  <div className="flex items-center gap-2">
                    SKU
                    <SortIcon field="sku" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center gap-2">
                    Qty
                    <SortIcon field="quantity" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('priceAmount')}
                >
                  <div className="flex items-center gap-2">
                    Price
                    <SortIcon field="priceAmount" />
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
                  const groupInfo = getGroupInfo(p);
                  return (
                    <TableRow
                      key={p.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${groupInfo ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
                      data-list-item={JSON.stringify(raw)}
                      data-plugin-name="products"
                    >
                      <TableCell
                        className={`w-5 p-0 align-top ${groupInfo ? 'border-l-2 border-emerald-400' : ''}`}
                        aria-hidden
                      />
                      <TableCell className={`w-12 ${groupInfo ? 'pl-3' : ''}`}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-input"
                          checked={isSelected}
                          onChange={() => toggleProductSelected(p.id)}
                          aria-label={isSelected ? 'Unselect product' : 'Select product'}
                        />
                      </TableCell>
                      <TableCell className={groupInfo ? 'pl-3' : ''}>
                        <div className="text-sm font-mono font-medium">#{p.id}</div>
                      </TableCell>
                      <TableCell className={groupInfo ? 'pl-3' : ''}>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{p.title}</div>
                          {groupInfo ? (
                            <Badge variant="secondary" className="text-xs font-normal shrink-0">
                              {groupInfo.total} varianter · {groupInfo.typeLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={groupInfo ? 'pl-3' : ''}>
                        <div className="text-sm text-muted-foreground">{p.sku || '—'}</div>
                      </TableCell>
                      <TableCell className={groupInfo ? 'pl-3' : ''}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={quantityUpdatingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = Number.isFinite(p.quantity) ? p.quantity : 0;
                              openQuantityDialog(p.id, current, 'minus');
                            }}
                            aria-label="Minska antal"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="min-w-[1.5rem] text-center text-sm tabular-nums">
                            {p.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={quantityUpdatingId === p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = Number.isFinite(p.quantity) ? p.quantity : 0;
                              openQuantityDialog(p.id, current, 'plus');
                            }}
                            aria-label="Öka antal"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className={groupInfo ? 'pl-3' : ''}>
                        <div className="text-sm">
                          {p.priceAmount?.toFixed
                            ? p.priceAmount.toFixed(2)
                            : Number(p.priceAmount || 0).toFixed(2)}{' '}
                          {p.currency}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right ${groupInfo ? 'pl-3' : ''}`}>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenProduct(raw)}
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
                const groupInfo = getGroupInfo(p);
                return (
                  <div
                    key={p.id}
                    className={`p-4 ${groupInfo ? 'border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 pl-3' : ''}`}
                  >
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
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium">{p.title}</h3>
                          {groupInfo ? (
                            <Badge variant="secondary" className="text-xs font-normal">
                              {groupInfo.total} varianter · {groupInfo.typeLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 space-y-1">
                          <div className="text-xs text-muted-foreground">
                            #{p.id} · {p.sku || '—'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              disabled={quantityUpdatingId === p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = Number.isFinite(p.quantity) ? p.quantity : 0;
                                openQuantityDialog(p.id, current, 'minus');
                              }}
                              aria-label="Minska antal"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-[1.25rem] text-center text-xs tabular-nums">
                              {p.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              disabled={quantityUpdatingId === p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = Number.isFinite(p.quantity) ? p.quantity : 0;
                                openQuantityDialog(p.id, current, 'plus');
                              }}
                              aria-label="Öka antal"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.priceAmount?.toFixed
                              ? p.priceAmount.toFixed(2)
                              : Number(p.priceAmount || 0).toFixed(2)}{' '}
                            {p.currency}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => attemptNavigation(() => openProductForEdit(p.raw))}
                          className="h-8 px-3"
                        >
                          Edit
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

      {/* Quantity change dialog */}
      <Dialog
        open={quantityDialog !== null}
        onOpenChange={(open) => !open && setQuantityDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quantityDialog?.direction === 'plus' ? 'Öka lagersaldo' : 'Minska lagersaldo'}
            </DialogTitle>
            <DialogDescription>
              {quantityDialog?.direction === 'plus'
                ? 'Hur mycket vill du öka lagersaldot med?'
                : 'Hur mycket vill du minska lagersaldot med?'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="number"
              min={1}
              value={quantityDialogInput}
              onChange={(e) => setQuantityDialogInput(e.target.value)}
              placeholder="1"
              className="w-24"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuantityDialog(null)}>
              Avbryt
            </Button>
            <Button
              onClick={confirmQuantityDialog}
              disabled={
                !Number.isFinite(Number(quantityDialogInput)) ||
                Math.floor(Number(quantityDialogInput)) < 1
              }
            >
              Ändra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish-modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowPublishModal(false)}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">Publish selected products</h3>
                <div className="text-xs text-gray-500">
                  {selectedProducts.length} products selected
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Choose channels / stores</div>
                  <div className="space-y-3">
                    <div className={!isWooConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">
                        WooCommerce {isWooConfigured ? '' : '(not connected)'}
                      </div>
                      {wooInstances.length > 0 ? (
                        <div className="flex flex-wrap gap-4 pl-5">
                          {wooInstances.map((inst) => (
                            <label key={inst.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!isWooConfigured}
                                checked={isWooConfigured && publishWooInstanceIds.includes(inst.id)}
                                onChange={(e) => {
                                  if (!isWooConfigured) {
                                    return;
                                  }
                                  setPublishWooInstanceIds((prev) =>
                                    e.target.checked
                                      ? [...prev, inst.id]
                                      : prev.filter((id) => id !== inst.id),
                                  );
                                }}
                              />
                              <span>{inst.label || inst.instanceKey || inst.id}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 pl-5">
                          No WooCommerce stores added. Add a store in Settings.
                        </p>
                      )}
                    </div>
                    <div className={!isCdonConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">
                        CDON {isCdonConfigured ? '' : '(not connected)'}
                      </div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isCdonConfigured}
                              checked={isCdonConfigured && publishCdonMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isCdonConfigured) {
                                  return;
                                }
                                setPublishCdonMarkets((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((m) => m !== key), key]
                                    : prev.filter((m) => m !== key),
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={!isFyndiqConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">
                        Fyndiq {isFyndiqConfigured ? '' : '(not connected)'}
                      </div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isFyndiqConfigured}
                              checked={isFyndiqConfigured && publishFyndiqMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isFyndiqConfigured) {
                                  return;
                                }
                                setPublishFyndiqMarkets((prev) =>
                                  e.target.checked
                                    ? [...prev.filter((m) => m !== key), key]
                                    : prev.filter((m) => m !== key),
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
                    (publishWooInstanceIds.length === 0 &&
                      !publishCdonMarkets.length &&
                      !publishFyndiqMarkets.length)
                  }
                  onClick={async () => {
                    const payload = selectedProducts.map((p: any) => ({
                      id: p.id,
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
                      condition: p.condition,
                      knNumber: p.knNumber,
                      channelSpecific: p.channelSpecific,
                      parentProductId: p.parentProductId,
                      groupVariationType: p.groupVariationType,
                      color: p.color,
                      colorText: p.colorText,
                      size: p.size,
                      sizeText: p.sizeText,
                      model: p.model,
                      createdAt: p.createdAt,
                      updatedAt: p.updatedAt,
                    }));
                    const skippedMissingVariation = payload.filter((p: any) =>
                      variantMissingValue(p),
                    );
                    const exportPayload = payload.filter((p: any) => !variantMissingValue(p));
                    setLastPublishSkipped(
                      skippedMissingVariation.map((p: any) => ({
                        id: String(p.id),
                        title: p.title,
                        groupVariationType: p.groupVariationType || 'color',
                      })),
                    );
                    setPublishing(true);
                    const result: NonNullable<typeof lastPublishResult> = {};
                    try {
                      if (publishWooInstanceIds.length > 0 && isWooConfigured) {
                        try {
                          const r = await woocommerceApi.exportProducts(
                            exportPayload,
                            publishWooInstanceIds.length > 0
                              ? { instanceIds: publishWooInstanceIds }
                              : undefined,
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
                          const r = await cdonApi.exportProducts(exportPayload, {
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
                          const r = await fyndiqApi.exportProducts(exportPayload, {
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
              if (!importing) {
                setShowImportModal(false);
              }
            }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">Import products</h3>
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
                      <div className="text-red-700">
                        Import failed: {String(lastImportResult.error || 'Unknown error')}
                      </div>
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
                          Missing SKU:{' '}
                          {Array.isArray(lastImportResult.skippedMissingSku)
                            ? lastImportResult.skippedMissingSku.length
                            : 0}
                          {' · '}
                          Invalid:{' '}
                          {Array.isArray(lastImportResult.skippedInvalid)
                            ? lastImportResult.skippedInvalid.length
                            : 0}
                          {' · '}
                          Conflicts:{' '}
                          {Array.isArray(lastImportResult.conflicts)
                            ? lastImportResult.conflicts.length
                            : 0}
                          {' · '}
                          Not found:{' '}
                          {Array.isArray(lastImportResult.notFound)
                            ? lastImportResult.notFound.length
                            : 0}
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
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowBatchEditModal(false)}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">Batch Edit</h3>
                <div className="text-xs text-gray-500">
                  {selectedProductIds.length} products selected. Set only the fields you want to
                  change.
                </div>
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
                      onChange={(e) =>
                        setBatchEditUpdates((u) => ({ ...u, priceAmount: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setBatchEditUpdates((u) => ({ ...u, quantity: e.target.value }))
                      }
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">VAT rate (%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Leave empty to skip"
                      value={batchEditUpdates.vatRate ?? ''}
                      onChange={(e) =>
                        setBatchEditUpdates((u) => ({ ...u, vatRate: e.target.value }))
                      }
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Currency</label>
                    <select
                      value={batchEditUpdates.currency ?? ''}
                      onChange={(e) =>
                        setBatchEditUpdates((u) => ({
                          ...u,
                          currency: e.target.value || undefined,
                        }))
                      }
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
                {lastBatchEditResult !== null && lastBatchEditResult !== undefined && (
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
                      !batchEditUpdates.vatRate &&
                      !batchEditUpdates.currency)
                  }
                  onClick={async () => {
                    const updates: {
                      priceAmount?: number;
                      quantity?: number;
                      vatRate?: number;
                      currency?: string;
                    } = {};
                    if (
                      batchEditUpdates.priceAmount !== null &&
                      batchEditUpdates.priceAmount !== undefined &&
                      batchEditUpdates.priceAmount !== ''
                    ) {
                      const n = Number(batchEditUpdates.priceAmount.replace(',', '.'));
                      if (Number.isFinite(n)) {
                        updates.priceAmount = n;
                      }
                    }
                    if (
                      batchEditUpdates.quantity !== null &&
                      batchEditUpdates.quantity !== undefined &&
                      batchEditUpdates.quantity !== ''
                    ) {
                      const n = Number(batchEditUpdates.quantity);
                      if (Number.isFinite(n) && n >= 0) {
                        updates.quantity = Math.trunc(n);
                      }
                    }
                    if (
                      batchEditUpdates.vatRate !== null &&
                      batchEditUpdates.vatRate !== undefined &&
                      batchEditUpdates.vatRate !== ''
                    ) {
                      const n = Number(batchEditUpdates.vatRate.replace(',', '.'));
                      if (Number.isFinite(n)) {
                        updates.vatRate = n;
                      }
                    }
                    if (batchEditUpdates.currency) {
                      updates.currency = batchEditUpdates.currency;
                    }
                    if (Object.keys(updates).length === 0) {
                      return;
                    }
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
                  {batchEditApplying
                    ? 'Applying…'
                    : `Apply to ${selectedProductIds.length} products`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group modal — set variant group type (color/size/model) and main product */}
      {showGroupModal && selectedProductIds.length >= 2 && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !groupApplying && setShowGroupModal(false)}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <h3 className="mb-0 text-lg font-semibold">Group as variants</h3>
                <div className="text-xs text-gray-500">
                  {selectedProductIds.length} products. Choose variation type (Färg/Storlek/Modell).
                  Each variant must have that field filled before export.
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Variation type</label>
                  <select
                    value={groupVariationType}
                    onChange={(e) =>
                      setGroupVariationType(e.target.value as 'color' | 'size' | 'model')
                    }
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="color">Färg</option>
                    <option value="size">Storlek</option>
                    <option value="model">Modell</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Huvudprodukt (valfri)</label>
                  <select
                    value={groupMainProductId}
                    onChange={(e) => setGroupMainProductId(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {selectedProductIds.map((id) => {
                      const p = products.find((x) => String(x.id) === id);
                      return (
                        <option key={id} value={id}>
                          {p ? `${p.title || 'Untitled'} (${p.id})` : id}
                        </option>
                      );
                    })}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    Övriga produkter blir varianter under denna.
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md border text-sm"
                  onClick={() => setShowGroupModal(false)}
                  disabled={groupApplying}
                >
                  Avbryt
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-violet-600 text-white text-sm disabled:opacity-50"
                  disabled={groupApplying}
                  onClick={async () => {
                    setGroupApplying(true);
                    try {
                      await groupProducts(
                        selectedProductIds,
                        groupVariationType,
                        groupMainProductId || undefined,
                      );
                      setShowGroupModal(false);
                      clearProductSelection();
                    } catch (err: any) {
                      console.error('Group failed', err);
                      alert(err?.message || err?.error || 'Failed to group products');
                    } finally {
                      setGroupApplying(false);
                    }
                  }}
                >
                  {groupApplying ? 'Applying…' : 'Group'}
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
                <h3 className="mb-0 text-lg font-semibold">Delete selected products</h3>
                <div className="text-xs text-gray-500">
                  {selectedProducts.length} products selected
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">
                    Choose channels / stores to delete from
                  </div>
                  <div className="space-y-3">
                    <div className={!isWooConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">
                        WooCommerce {isWooConfigured ? '' : '(not connected)'}
                      </div>
                      {wooInstances.length > 0 ? (
                        <div className="flex flex-wrap gap-4 pl-5">
                          {wooInstances.map((inst) => (
                            <label key={inst.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!isWooConfigured}
                                checked={
                                  isWooConfigured && deleteFromWooInstanceIds.includes(inst.id)
                                }
                                onChange={(e) => {
                                  if (!isWooConfigured) {
                                    return;
                                  }
                                  setDeleteFromWooInstanceIds((prev) =>
                                    e.target.checked
                                      ? [...prev, inst.id]
                                      : prev.filter((id) => id !== inst.id),
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
                      <div className="text-sm font-medium mb-1">
                        CDON {isCdonConfigured ? '' : '(not connected)'}
                      </div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isCdonConfigured}
                              checked={isCdonConfigured && deleteFromCdonMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isCdonConfigured) {
                                  return;
                                }
                                setDeleteFromCdonMarkets((prev: string[]) =>
                                  e.target.checked
                                    ? [...prev.filter((m: string) => m !== key), key as string]
                                    : prev.filter((m: string) => m !== key),
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={!isFyndiqConfigured ? 'opacity-50' : ''}>
                      <div className="text-sm font-medium mb-1">
                        Fyndiq {isFyndiqConfigured ? '' : '(not connected)'}
                      </div>
                      <div className="flex flex-wrap gap-4 pl-5">
                        {PUBLISH_MARKETS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!isFyndiqConfigured}
                              checked={isFyndiqConfigured && deleteFromFyndiqMarkets.includes(key)}
                              onChange={(e) => {
                                if (!isFyndiqConfigured) {
                                  return;
                                }
                                setDeleteFromFyndiqMarkets((prev: string[]) =>
                                  e.target.checked
                                    ? [...prev.filter((m: string) => m !== key), key as string]
                                    : prev.filter((m: string) => m !== key),
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
                    If checked, products will be permanently deleted from the platform database
                    (cannot be undone).
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

      {/* Product Settings Modal */}
      {showProductSettings && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowProductSettings(false)}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl max-h-[90vh] overflow-y-auto">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Produktinställningar</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowProductSettings(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <ProductSettingsForm onClose={() => setShowProductSettings(false)} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
