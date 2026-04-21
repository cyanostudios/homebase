import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Columns2,
  Upload,
  Download,
  Pencil,
  Settings,
  X,
  Minus,
  Plus,
  Loader2,
  RefreshCw,
  Share2,
  Layers,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { navigateToPage } from '@/core/navigation/navigateToPage';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { buildListPaginationItems } from '@/core/utils/listPagination';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { useCdonProducts } from '@/plugins/cdon-products/context/CdonProductsContext';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';
import { useFyndiqProducts } from '@/plugins/fyndiq-products/context/FyndiqProductsContext';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';

import { productsApi } from '../api/productsApi';
import type { ProductListParams } from '../api/productsApi';
import {
  CATALOG_SEARCH_INPUT_PLACEHOLDER,
  DEFAULT_PRODUCT_CATALOG_SEARCH_SCOPE,
  isProductCatalogSearchScope,
  PRODUCT_CATALOG_SEARCH_SCOPE_LABELS,
  PRODUCT_CATALOG_SEARCH_SCOPES,
  type ProductCatalogSearchScope,
} from '../constants/productCatalogSearchScopes';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types/products';
import { normalizeCatalogPageSize } from '../types/products';

import {
  DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS,
  formatProductListPlainColumn,
  normalizeVisibleColumnSelection,
  parseStoredProductListColumns,
  PRODUCT_LIST_COLUMN_META,
  type ProductListDataColumnId,
  storageKeyProductListColumns,
} from './productListColumns';
import { ProductSettingsForm } from './ProductSettingsForm';
import { ProductTitleWithLinksHover } from './ProductTitleWithLinksHover';

/** Match Orders toolbar dropdown density. */
const PRODUCTS_DROPDOWN_CONTENT_CLASS = 'min-w-[16rem] p-2 text-base';
const PRODUCTS_DROPDOWN_ITEM_CLASS =
  'text-base py-2.5 min-h-[2.75rem] gap-2 [&_svg]:size-5 [&_svg]:shrink-0';

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

const VARIANT_GROUP_PALETTES = [
  {
    rowBg: 'bg-emerald-50/95 dark:bg-emerald-950/35',
    rowHover: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-950/45',
    border: 'border-emerald-400',
    accent: 'border-emerald-400',
  },
  {
    rowBg: 'bg-sky-50/95 dark:bg-sky-950/35',
    rowHover: 'hover:bg-sky-100/80 dark:hover:bg-sky-950/45',
    border: 'border-sky-400',
    accent: 'border-sky-400',
  },
  {
    rowBg: 'bg-amber-50/95 dark:bg-amber-950/35',
    rowHover: 'hover:bg-amber-100/80 dark:hover:bg-amber-950/45',
    border: 'border-amber-400',
    accent: 'border-amber-400',
  },
  {
    rowBg: 'bg-violet-50/95 dark:bg-violet-950/35',
    rowHover: 'hover:bg-violet-100/80 dark:hover:bg-violet-950/45',
    border: 'border-violet-400',
    accent: 'border-violet-400',
  },
  {
    rowBg: 'bg-rose-50/95 dark:bg-rose-950/35',
    rowHover: 'hover:bg-rose-100/80 dark:hover:bg-rose-950/45',
    border: 'border-rose-400',
    accent: 'border-rose-400',
  },
  {
    rowBg: 'bg-cyan-50/95 dark:bg-cyan-950/35',
    rowHover: 'hover:bg-cyan-100/80 dark:hover:bg-cyan-950/45',
    border: 'border-cyan-400',
    accent: 'border-cyan-400',
  },
] as const;

/** Stable palette index from groupId so neighbouring groups get different colours. */
function hashVariantGroupPaletteIndex(groupKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < groupKey.length; i++) {
    h ^= groupKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % VARIANT_GROUP_PALETTES.length;
}

function isNonNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getSortComparable(p: Record<string, unknown>, field: SortField): number | string {
  switch (field) {
    case 'id':
      return Number(p.id) || 0;
    case 'title':
      return String(p.title || '').toLowerCase();
    case 'quantity':
      return Number(p.quantity) || 0;
    case 'priceAmount':
      return Number(p.priceAmount) || 0;
    case 'sku':
      return String(p.sku || '').toLowerCase();
    default:
      return 0;
  }
}

function cmpSort(a: number | string, b: number | string, order: SortOrder): number {
  if (typeof a === 'string' || typeof b === 'string') {
    const sa = String(a);
    const sb = String(b);
    return order === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  }
  const na = Number(a);
  const nb = Number(b);
  return order === 'asc' ? na - nb : nb - na;
}

function sortRowsByField(rows: Record<string, unknown>[], field: SortField, order: SortOrder) {
  return [...rows].sort((x, y) =>
    cmpSort(getSortComparable(x, field), getSortComparable(y, field), order),
  );
}

function aggregateGroupRank(values: (number | string)[], order: SortOrder): number | string {
  if (values.length === 0) {
    return 0;
  }
  if (typeof values[0] === 'string') {
    const strs = values as string[];
    return order === 'asc'
      ? strs.reduce((a, b) => (a < b ? a : b))
      : strs.reduce((a, b) => (a > b ? a : b));
  }
  const nums = values as number[];
  return order === 'asc' ? Math.min(...nums) : Math.max(...nums);
}

/**
 * Reorder current page so variant groups (≥2 products with same groupId) stay contiguous:
 * groups are ordered by min/max of the active sort column (same as list sort direction),
 * members within a group follow the same sort.
 */
function clusterCatalogRowsByVariantGroup(
  rows: Record<string, unknown>[],
  sortField: SortField,
  sortOrder: SortOrder,
): Record<string, unknown>[] {
  if (rows.length <= 1) {
    return rows;
  }
  const counts = new Map<string, number>();
  for (const p of rows) {
    const g =
      p.groupId !== null && p.groupId !== undefined && String(p.groupId).trim()
        ? String(p.groupId).trim()
        : '';
    if (g) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  const multi = new Set<string>();
  for (const [g, c] of counts.entries()) {
    if (c >= 2) {
      multi.add(g);
    }
  }

  const groupBuckets = new Map<string, Record<string, unknown>[]>();
  const standalone: Record<string, unknown>[] = [];
  for (const p of rows) {
    const g =
      p.groupId !== null && p.groupId !== undefined && String(p.groupId).trim()
        ? String(p.groupId).trim()
        : '';
    if (g && multi.has(g)) {
      const arr = groupBuckets.get(g) ?? [];
      arr.push(p);
      groupBuckets.set(g, arr);
    } else {
      standalone.push(p);
    }
  }

  type Seg =
    | { kind: 'group'; gid: string; rank: number | string; rows: Record<string, unknown>[] }
    | { kind: 'solo'; rank: number | string; row: Record<string, unknown> };

  const segments: Seg[] = [];
  for (const [gid, members] of groupBuckets.entries()) {
    const sortedMembers = sortRowsByField(members, sortField, sortOrder);
    const vals = members.map((m) => getSortComparable(m, sortField));
    const rank = aggregateGroupRank(vals, sortOrder);
    segments.push({ kind: 'group', gid, rank, rows: sortedMembers });
  }
  for (const p of standalone) {
    segments.push({ kind: 'solo', rank: getSortComparable(p, sortField), row: p });
  }

  segments.sort((a, b) => {
    const c = cmpSort(a.rank, b.rank, sortOrder);
    if (c !== 0) {
      return c;
    }
    const ida = a.kind === 'group' ? a.gid : String(a.row.id);
    const idb = b.kind === 'group' ? b.gid : String(b.row.id);
    return String(ida).localeCompare(String(idb));
  });

  const out: Record<string, unknown>[] = [];
  for (const s of segments) {
    if (s.kind === 'group') {
      out.push(...s.rows);
    } else {
      out.push(s.row);
    }
  }
  return out;
}

function variantGroupRowChrome(
  gi: { isFirst: boolean; isLast: boolean },
  rowIndex: number,
  borderClass: string,
): string {
  const gap = gi.isFirst && rowIndex > 0 ? 'mt-2.5' : '';
  if (gi.isFirst && gi.isLast) {
    return `${gap} border-2 ${borderClass} rounded-lg`;
  }
  if (gi.isFirst) {
    return `${gap} border-t-2 border-x-2 ${borderClass} rounded-t-lg`;
  }
  if (gi.isLast) {
    return `border-b-2 border-x-2 ${borderClass} rounded-b-lg`;
  }
  return `border-x-2 ${borderClass}`;
}

export const ProductList: React.FC = () => {
  const {
    products,
    totalProducts,
    loadProducts,
    productSettings,
    isProductCatalogBootstrap,
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
    applyOptimisticQuantity,
    resyncProducts,
    // Group products (variant group)
    groupProducts,
  } = useProducts();

  const { activeTenantId } = useApp();

  const { settings: cdonSettings } = useCdonProducts();
  const { settings: fyndiqSettings } = useFyndiqProducts();

  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTitleExtra } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<ProductCatalogSearchScope>(
    DEFAULT_PRODUCT_CATALOG_SEARCH_SCOPE,
  );
  const [listFilter, setListFilter] = useState<string>('all');
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<ProductListDataColumnId[]>(() => [
    ...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS,
  ]);
  const [catalogColumnsHydrated, setCatalogColumnsHydrated] = useState(false);

  const [offset, setOffset] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);

  const limit = normalizeCatalogPageSize(productSettings?.catalogPageSize);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, searchScope, listFilter, sortField, sortOrder, limit]);

  const listApiParam = useMemo(
    () => (listFilter === 'all' ? 'all' : listFilter === 'main' ? 'main' : String(listFilter)),
    [listFilter],
  );

  const loadParams: ProductListParams = useMemo(
    () => ({
      limit,
      offset,
      sort: sortField,
      order: sortOrder,
      q: debouncedSearch ? debouncedSearch : undefined,
      searchIn: searchScope,
      list: listApiParam,
    }),
    [limit, offset, sortField, sortOrder, debouncedSearch, searchScope, listApiParam],
  );

  useEffect(() => {
    if (!isProductCatalogBootstrap) {
      return;
    }
    let cancelled = false;
    setListLoading(true);
    void loadProducts(loadParams).finally(() => {
      if (!cancelled) {
        setListLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isProductCatalogBootstrap, loadParams, loadProducts]);

  useEffect(() => {
    if (totalProducts <= 0) {
      return;
    }
    const totalPages = Math.ceil(totalProducts / limit) || 1;
    const maxOffset = Math.max(0, (totalPages - 1) * limit);
    if (offset > maxOffset) {
      setOffset(maxOffset);
    }
  }, [totalProducts, limit, offset]);

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
  const [resyncing, setResyncing] = useState(false);
  const [lastResyncResult, setLastResyncResult] = useState<{
    woo?: {
      ok: boolean;
      counts?: { requested?: number; success?: number; error?: number };
      endpoint?: string;
      instances?: Array<{
        instanceId: string | null;
        label: string | null;
        ok: boolean;
        counts?: { requested?: number; success?: number; error?: number };
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

  const [showProductSettings, setShowProductSettings] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    setCatalogColumnsHydrated(false);
    if (activeTenantId === null) {
      return;
    }
    try {
      const raw = localStorage.getItem(storageKeyProductListColumns(activeTenantId));
      const parsed = parseStoredProductListColumns(raw);
      setVisibleColumnIds(normalizeVisibleColumnSelection(parsed));
    } catch {
      setVisibleColumnIds([...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS]);
    } finally {
      setCatalogColumnsHydrated(true);
    }
  }, [activeTenantId]);

  useEffect(() => {
    if (activeTenantId === null || !catalogColumnsHydrated) {
      return;
    }
    try {
      localStorage.setItem(
        storageKeyProductListColumns(activeTenantId),
        JSON.stringify(visibleColumnIds),
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [activeTenantId, visibleColumnIds, catalogColumnsHydrated]);

  const toggleCatalogColumn = useCallback((id: ProductListDataColumnId, checked: boolean) => {
    setVisibleColumnIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev;
        }
        return normalizeVisibleColumnSelection([...prev, id]);
      }
      if (prev.length <= 1) {
        return prev;
      }
      return normalizeVisibleColumnSelection(prev.filter((x) => x !== id));
    });
  }, []);

  const resetCatalogColumns = useCallback(() => {
    setVisibleColumnIds([...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS]);
  }, []);

  const totalTableColSpan = 2 + visibleColumnIds.length + 1;

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
    applyOptimisticQuantity(productId, newQty);
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

  /** Current page rows (search/sort/filter are applied server-side), then variant groups clustered for display. */
  const displayRows = useMemo((): ReturnType<typeof normalize>[] => {
    const normalized = products.map(normalize);
    return clusterCatalogRowsByVariantGroup(
      normalized as unknown as Record<string, unknown>[],
      sortField,
      sortOrder,
    ) as ReturnType<typeof normalize>[];
  }, [products, sortField, sortOrder]);

  const totalPages = limit > 0 ? Math.ceil(totalProducts / limit) || 1 : 1;
  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const from = totalProducts === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, totalProducts);
  const paginationItems = useMemo(
    () => buildListPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setOffset((p - 1) * limit);
  };

  // Selected products (actual objects)
  const selectedProducts = useMemo(() => {
    const set = new Set(selectedProductIds.map(String));
    return products.filter((p: any) => set.has(String(p?.id)));
  }, [products, selectedProductIds]);

  // Selection helpers
  const visibleIds = useMemo(() => displayRows.map((p: any) => String(p.id)), [displayRows]);
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
    const map = new Map<string, typeof displayRows>();
    for (const p of displayRows) {
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
  }, [displayRows]);

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

  type CatalogGroupInfo = ReturnType<typeof getGroupInfo>;

  const renderDesktopCatalogCell = (
    columnId: ProductListDataColumnId,
    p: ReturnType<typeof normalize>,
    groupInfo: CatalogGroupInfo,
  ) => {
    const product = p.raw as Product;
    const pad = groupInfo ? 'pl-3' : '';
    const giForTitle = groupInfo
      ? { total: groupInfo.total, typeLabel: groupInfo.typeLabel }
      : undefined;

    switch (columnId) {
      case 'id':
        return (
          <TableCell className={pad}>
            <div className="text-sm font-mono font-medium">#{p.id}</div>
          </TableCell>
        );
      case 'title':
        return (
          <TableCell className={pad}>
            <ProductTitleWithLinksHover productId={p.id} title={p.title} groupInfo={giForTitle} />
          </TableCell>
        );
      case 'sku':
        return (
          <TableCell className={pad}>
            <div className="text-sm text-muted-foreground">{p.sku || '—'}</div>
          </TableCell>
        );
      case 'quantity':
        return (
          <TableCell className={pad}>
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
              <span className="min-w-[1.5rem] text-center text-sm tabular-nums">{p.quantity}</span>
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
        );
      case 'priceAmount':
        return (
          <TableCell className={pad}>
            <div className="text-sm">
              {p.priceAmount?.toFixed
                ? p.priceAmount.toFixed(2)
                : Number(p.priceAmount || 0).toFixed(2)}{' '}
              {p.currency}
            </div>
          </TableCell>
        );
      case 'status':
        return (
          <TableCell className={pad}>
            <Badge variant={product.status === 'paused' ? 'secondary' : 'default'}>
              {formatProductListPlainColumn('status', product)}
            </Badge>
          </TableCell>
        );
      default:
        return (
          <TableCell className={pad}>
            <div className="text-sm text-muted-foreground">
              {formatProductListPlainColumn(columnId, product)}
            </div>
          </TableCell>
        );
    }
  };

  // Protected navigation handlers
  const handleOpenProduct = (product: any) => attemptNavigation(() => openProductForEdit(product));
  const _handleOpenPanel = () => attemptNavigation(() => openProductPanel(null));

  const totalResultCount = totalProducts;
  useEffect(() => {
    setHeaderTitleExtra(`${totalResultCount} produkter totalt`);
    return () => setHeaderTitleExtra(null);
  }, [totalResultCount, setHeaderTitleExtra]);

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

  const hasProductSelection = selectedProductIds.length > 0;

  const productToolbarActions = (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Hantera
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={PRODUCTS_DROPDOWN_CONTENT_CLASS}>
          <DropdownMenuItem
            disabled={!hasProductSelection}
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => {
              setPublishWooInstanceIds(isWooConfigured ? wooInstances.map((i) => i.id) : []);
              setPublishCdonMarkets(isCdonConfigured ? ['se'] : []);
              setPublishFyndiqMarkets(isFyndiqConfigured ? ['se'] : []);
              setLastPublishResult(null);
              setLastPublishSkipped([]);
              setShowPublishModal(true);
            }}
          >
            <Share2 className="mr-2" aria-hidden />
            Publish…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasProductSelection || resyncing}
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => {
              void (async () => {
                setLastResyncResult(null);
                setResyncing(true);
                try {
                  const result = await resyncProducts(selectedProductIds);
                  setLastResyncResult(result);
                } catch (error: any) {
                  console.error('Batch resync failed', error);
                  setLastResyncResult(null);
                  alert(error?.message || error?.error || 'Synka om misslyckades');
                } finally {
                  setResyncing(false);
                }
              })();
            }}
          >
            {resyncing ? (
              <Loader2 className="mr-2 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2" aria-hidden />
            )}
            {resyncing ? 'Synkar om…' : 'Synka om'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasProductSelection}
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            title="Öppnar produktpanelen. Endast ändrade fält och ikryssade kanalbutiker skrivs till alla markerade produkter. Efter förhandsgranskning köas synk (Homebase sedan Woo/CDON/Fyndiq); följ Synkstatus under Kanaler."
            onSelect={() => attemptNavigation(() => openProductPanelForBatch(selectedProductIds))}
          >
            <Pencil className="mr-2" aria-hidden />
            Redigera…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={selectedProductIds.length < 2}
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => {
              setGroupVariationType('color');
              setGroupMainProductId(selectedProductIds[0] ?? '');
              setShowGroupModal(true);
            }}
          >
            <Layers className="mr-2" aria-hidden />
            Group…
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem
            disabled={!hasProductSelection || deleting}
            className={cn(
              PRODUCTS_DROPDOWN_ITEM_CLASS,
              hasProductSelection &&
                !deleting &&
                'text-destructive focus:text-destructive focus:bg-destructive/10',
            )}
            onSelect={() => {
              setDeleteFromWooInstanceIds([]);
              setDeleteFromCdonMarkets([]);
              setDeleteFromFyndiqMarkets([]);
              setAlsoDeleteFromPlatform(false);
              setShowDeleteModal(true);
            }}
          >
            <Trash2 className="mr-2" aria-hidden />
            {deleting ? 'Raderar…' : 'Delete…'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1" type="button">
            <Columns2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Kolumner
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[min(70vh,28rem)] overflow-y-auto p-2">
          <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            Synliga kolumner
          </div>
          {PRODUCT_LIST_COLUMN_META.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              className="text-sm"
              checked={visibleColumnIds.includes(col.id)}
              onCheckedChange={(c) => toggleCatalogColumn(col.id, c === true)}
              onSelect={(e) => e.preventDefault()}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => resetCatalogColumns()}
          >
            Återställ standard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Alternativ
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={PRODUCTS_DROPDOWN_CONTENT_CLASS}>
          <DropdownMenuItem
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => setShowProductSettings(true)}
          >
            <Settings className="mr-2" aria-hidden />
            Inställningar
          </DropdownMenuItem>
          <DropdownMenuItem
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => attemptNavigation(() => navigateToPage('products-import'))}
          >
            <Upload className="mr-2" aria-hidden />
            Import
          </DropdownMenuItem>
          <DropdownMenuItem
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => attemptNavigation(() => navigateToPage('products-export'))}
          >
            <Download className="mr-2" aria-hidden />
            Export (Excel)
          </DropdownMenuItem>
          <DropdownMenuItem
            className={PRODUCTS_DROPDOWN_ITEM_CLASS}
            onSelect={() => attemptNavigation(() => openProductPanel(null))}
          >
            <Plus className="mr-2" aria-hidden />
            Lägg till produkt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <ContentToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={CATALOG_SEARCH_INPUT_PLACEHOLDER}
          showSearchIcon={false}
          searchLeading={
            <Select
              value={searchScope}
              onValueChange={(v) => {
                setSearchScope(
                  isProductCatalogSearchScope(v) ? v : DEFAULT_PRODUCT_CATALOG_SEARCH_SCOPE,
                );
              }}
            >
              <SelectTrigger
                aria-label="Begränsa sökningen"
                title={PRODUCT_CATALOG_SEARCH_SCOPE_LABELS[searchScope]}
                className="h-10 w-full min-w-0 justify-start gap-1.5 rounded-r-none border-r-0 bg-muted/30 px-2 text-left text-sm [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:shrink [&>span]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="min-w-0 max-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]"
              >
                {PRODUCT_CATALOG_SEARCH_SCOPES.map((scope) => (
                  <SelectItem key={scope} value={scope} className="pr-8">
                    {PRODUCT_CATALOG_SEARCH_SCOPE_LABELS[scope]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          searchRowTrailing={
            <NativeSelect
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              aria-label="Filter by list"
              className="h-10 w-full min-w-[11rem] max-w-[18rem] shrink-0 sm:w-[min(100%,16rem)]"
            >
              <option value="all">Alla produkter</option>
              <option value="main">Huvudlista</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          }
          afterSearch={
            hasProductSelection ? (
              <>
                <Badge variant="secondary">
                  {selectedProductIds.length === 1
                    ? '1 vald'
                    : `${selectedProductIds.length} valda`}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => clearProductSelection()}
                >
                  Nollställ
                </Button>
              </>
            ) : null
          }
          rightActions={productToolbarActions}
        />
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

      {lastResyncResult && (
        <div className="mb-4">
          <div
            className={`rounded-md border p-3 text-sm ${
              Object.values(lastResyncResult).every((r) => r?.ok !== false)
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">
              {Object.values(lastResyncResult).every((r) => r?.ok !== false)
                ? 'Synka om completed'
                : 'Synka om failed'}
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {lastResyncResult.woo && (
                <div>
                  WooCommerce:{' '}
                  {lastResyncResult.woo.ok ? (
                    Array.isArray(lastResyncResult.woo.instances) &&
                    lastResyncResult.woo.instances.length > 0 ? (
                      <>
                        {lastResyncResult.woo.instances.filter((instance) => instance.ok).length}{' '}
                        store(s) updated
                      </>
                    ) : (
                      <>
                        {lastResyncResult.woo.counts?.requested ?? 0} requested,{' '}
                        {lastResyncResult.woo.counts?.success ?? 0} success
                      </>
                    )
                  ) : (
                    'failed'
                  )}
                </div>
              )}
              {lastResyncResult.cdon && (
                <div>
                  CDON:{' '}
                  {lastResyncResult.cdon.ok ? (
                    <>
                      {lastResyncResult.cdon.counts?.requested ?? 0} requested,{' '}
                      {lastResyncResult.cdon.counts?.success ?? 0} success
                    </>
                  ) : (
                    'failed'
                  )}
                </div>
              )}
              {lastResyncResult.fyndiq && (
                <div>
                  Fyndiq:{' '}
                  {lastResyncResult.fyndiq.ok ? (
                    <>
                      {lastResyncResult.fyndiq.counts?.requested ?? 0} requested,{' '}
                      {lastResyncResult.fyndiq.counts?.success ?? 0} success
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

      <Card className="shadow-none">
        {!isMobileView ? (
          <Table className="border-separate border-spacing-0">
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
                {visibleColumnIds.map((colId) => {
                  const meta = PRODUCT_LIST_COLUMN_META.find((m) => m.id === colId);
                  const label = meta?.label ?? colId;
                  const sf = meta?.sortField;
                  if (sf) {
                    return (
                      <TableHead
                        key={colId}
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort(sf)}
                      >
                        <div className="flex items-center gap-2">
                          {label}
                          <SortIcon field={sf} />
                        </div>
                      </TableHead>
                    );
                  }
                  return <TableHead key={colId}>{label}</TableHead>;
                })}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading && displayRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={totalTableColSpan}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Laddar…
                  </TableCell>
                </TableRow>
              ) : displayRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={totalTableColSpan}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {debouncedSearch
                      ? 'No products found matching your search.'
                      : 'No products yet. Click "Add Product" to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((p: any, rowIndex: number) => {
                  const raw = p.raw;
                  const isSelected = selectedProductIds.includes(p.id);
                  const groupInfo = getGroupInfo(p);
                  const pal = isNonNullish(groupInfo)
                    ? VARIANT_GROUP_PALETTES[hashVariantGroupPaletteIndex(groupInfo.key)]
                    : null;
                  const chrome =
                    isNonNullish(groupInfo) && isNonNullish(pal)
                      ? variantGroupRowChrome(groupInfo, rowIndex, pal.border)
                      : '';
                  const rowBg =
                    isNonNullish(groupInfo) && isNonNullish(pal)
                      ? `${pal.rowBg} ${pal.rowHover}`
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/50';
                  return (
                    <React.Fragment key={p.id}>
                      {groupInfo?.isFirst && rowIndex > 0 ? (
                        <TableRow
                          className="h-2.5 border-0 hover:bg-transparent pointer-events-none"
                          aria-hidden
                        >
                          <TableCell
                            colSpan={totalTableColSpan}
                            className="h-2.5 border-0 bg-transparent p-0"
                          />
                        </TableRow>
                      ) : null}
                      <TableRow
                        className={`${rowBg} ${chrome} ${
                          !isNonNullish(groupInfo) ? '[&>td]:border-b [&>td]:border-gray-200' : ''
                        }`}
                        data-list-item={JSON.stringify(raw)}
                        data-plugin-name="products"
                      >
                        <TableCell
                          className={`w-5 p-0 align-top ${isNonNullish(groupInfo) && isNonNullish(pal) ? `border-l-2 ${pal.accent}` : ''}`}
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
                        {visibleColumnIds.map((colId) => (
                          <React.Fragment key={colId}>
                            {renderDesktopCatalogCell(colId, p, groupInfo)}
                          </React.Fragment>
                        ))}
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
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="divide-y">
            {listLoading && displayRows.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Laddar…</div>
            ) : displayRows.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {debouncedSearch
                  ? 'No products found matching your search.'
                  : 'No products yet. Click "Add Product" to get started.'}
              </div>
            ) : (
              displayRows.map((p: any, rowIndex: number) => {
                const isSelected = selectedProductIds.includes(p.id);
                const groupInfo = getGroupInfo(p);
                const pal = isNonNullish(groupInfo)
                  ? VARIANT_GROUP_PALETTES[hashVariantGroupPaletteIndex(groupInfo.key)]
                  : null;
                const chrome =
                  isNonNullish(groupInfo) && isNonNullish(pal)
                    ? variantGroupRowChrome(groupInfo, rowIndex, pal.border)
                    : '';
                const rowBg = isNonNullish(groupInfo) && isNonNullish(pal) ? pal.rowBg : '';
                return (
                  <React.Fragment key={p.id}>
                    {groupInfo?.isFirst && rowIndex > 0 ? (
                      <div className="h-2.5 shrink-0" aria-hidden />
                    ) : null}
                    <div
                      className={`p-4 ${rowBg} ${chrome} ${isNonNullish(groupInfo) && isNonNullish(pal) ? 'pl-3' : 'border-b border-border'}`}
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
                            {visibleColumnIds.includes('title') ? (
                              <ProductTitleWithLinksHover
                                productId={p.id}
                                title={p.title}
                                groupInfo={
                                  groupInfo
                                    ? { total: groupInfo.total, typeLabel: groupInfo.typeLabel }
                                    : undefined
                                }
                              />
                            ) : (
                              <div className="text-sm font-mono font-medium">
                                #{p.id}
                                {visibleColumnIds.includes('sku') ? null : (
                                  <span className="text-muted-foreground font-normal">
                                    {' '}
                                    · {p.sku || '—'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-1 space-y-1">
                            {visibleColumnIds
                              .filter((colId) => colId !== 'title')
                              .map((colId) => {
                                const meta = PRODUCT_LIST_COLUMN_META.find((m) => m.id === colId);
                                const label = meta?.label ?? colId;
                                const product = p.raw as Product;
                                if (colId === 'quantity') {
                                  return (
                                    <div key={colId} className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground w-14 shrink-0">
                                        {label}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        disabled={quantityUpdatingId === p.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const current = Number.isFinite(p.quantity)
                                            ? p.quantity
                                            : 0;
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
                                          const current = Number.isFinite(p.quantity)
                                            ? p.quantity
                                            : 0;
                                          openQuantityDialog(p.id, current, 'plus');
                                        }}
                                        aria-label="Öka antal"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                }
                                if (colId === 'priceAmount') {
                                  return (
                                    <div key={colId} className="text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground/80">
                                        {label}:
                                      </span>{' '}
                                      {p.priceAmount?.toFixed
                                        ? p.priceAmount.toFixed(2)
                                        : Number(p.priceAmount || 0).toFixed(2)}{' '}
                                      {p.currency}
                                    </div>
                                  );
                                }
                                if (colId === 'status') {
                                  return (
                                    <div key={colId} className="flex items-center gap-2 text-xs">
                                      <span className="font-medium text-foreground/80">
                                        {label}
                                      </span>
                                      <Badge
                                        variant={
                                          product.status === 'paused' ? 'secondary' : 'default'
                                        }
                                      >
                                        {formatProductListPlainColumn('status', product)}
                                      </Badge>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={colId} className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground/80">{label}:</span>{' '}
                                    {formatProductListPlainColumn(colId, product)}
                                  </div>
                                );
                              })}
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
                  </React.Fragment>
                );
              })
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {totalResultCount === 0
              ? 'Inga resultat'
              : `Visar ${from} till ${to} av ${totalResultCount} resultat`}
            {listLoading ? ' · Laddar…' : ''}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || listLoading}
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
                      disabled={listLoading}
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
                disabled={currentPage >= totalPages || listLoading}
                onClick={() => goToPage(currentPage + 1)}
                aria-label="Nästa sida"
              >
                Nästa
              </Button>
            </div>
          )}
        </div>
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
                      mpn: p.mpn ?? null,
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
                      weight: p.weight ?? null,
                      volume: p.volume ?? null,
                      volumeUnit: p.volumeUnit ?? null,
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
                    <span>Delete from platform</span>
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
