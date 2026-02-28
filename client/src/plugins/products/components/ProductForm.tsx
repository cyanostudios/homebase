import { ChevronDown, ChevronRight, Plus, Star, Trash2, Upload } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import { filesApi } from '@/plugins/files/api/filesApi';
import type { ChannelInstance } from '@/plugins/channels/types/channels';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { getFxLatest } from '@/core/api/fxApi';
import { productsApi } from '../api/productsApi';
import { useProducts } from '../hooks/useProducts';

const MARKETS = [
  { key: 'se' as const, label: 'Sverige', currency: 'SEK', lang: 'sv-SE' },
  { key: 'dk' as const, label: 'Danmark', currency: 'DKK', lang: 'da-DK' },
  { key: 'fi' as const, label: 'Finland', currency: 'EUR', lang: 'fi-FI' },
  { key: 'no' as const, label: 'Norge', currency: 'NOK', lang: 'nb-NO' },
];

const DEFAULT_LANGUAGE = 'sv-SE'; // Default market/language (Svenska)

/** CDON/Fyndiq preset-size_SML (storlek dropdown) */
const SIZE_OPTIONS = [
  { value: '', label: '— Välj storlek —' },
  { value: 'one size', label: 'One size' },
  { value: 'xxs', label: 'XXS' },
  { value: 'xs', label: 'XS' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
  { value: 'xxl', label: 'XXL' },
];

/** CDON/Fyndiq preset-pattern (Fyndiq-mönster dropdown) */
const PATTERN_OPTIONS = [
  { value: '', label: '— Välj mönster —' },
  { value: 'abstract and geometry', label: 'Abstract and geometry' },
  { value: 'animals and animal patterns', label: 'Animals and animal patterns' },
  { value: 'nature and environment', label: 'Nature and environment' },
  { value: 'plants and fruit', label: 'Plants and fruit' },
  { value: 'space and scifi', label: 'Space and scifi' },
  { value: 'text and quotes', label: 'Text and quotes' },
  { value: 'camouflage', label: 'Camouflage' },
  { value: 'glitter', label: 'Glitter' },
  { value: 'marble and stone', label: 'Marble and stone' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'flags and symbols', label: 'Flags and symbols' },
  { value: 'maps', label: 'Maps' },
  { value: 'characters and celebrities', label: 'Characters and celebrities' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'retro', label: 'Retro' },
];

type CategoryTreeNode = { id: string; name: string; children: CategoryTreeNode[] };

/** WooCommerce categories: build tree structure for collapsible UI. */
function buildWooCategoryTree(
  flat: Array<{ id: string; name: string; parent?: number }>,
): CategoryTreeNode[] {
  if (!flat.length) return [];
  const byParent = new Map<number, Array<{ id: string; name: string; parent?: number }>>();
  for (const x of flat) {
    const p = x.parent ?? 0;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(x);
  }
  function toNode(c: { id: string; name: string; parent?: number }): CategoryTreeNode {
    const children = (byParent.get(Number(c.id)) ?? []).map(toNode);
    return { id: c.id, name: c.name, children };
  }
  return (byParent.get(0) ?? []).map(toNode);
}

/** CDON/Fyndiq category tree node. Hierarchy from id dot notation: "1.423.18326" → under "1.423" under "1". */
type ChannelCategoryNode = { id: string; name: string; children: ChannelCategoryNode[] };

/** Flatten tree to list of { id, pathLabel } for search results (pathLabel = "Root > Child > Leaf"). */
function flattenTreeWithPaths<T extends { id: string; name: string; children: T[] }>(
  nodes: T[],
  parentPath: string[] = [],
): Array<{ id: string; pathLabel: string }> {
  const result: Array<{ id: string; pathLabel: string }> = [];
  for (const node of nodes) {
    const path = [...parentPath, node.name];
    const pathLabel = path.join(' > ');
    result.push({ id: node.id, pathLabel });
    result.push(...flattenTreeWithPaths(node.children, path));
  }
  return result;
}

/** Filter flat category list by search string (match on pathLabel or id). */
function filterCategorySearchResults(
  items: Array<{ id: string; pathLabel: string }>,
  query: string,
): Array<{ id: string; pathLabel: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.pathLabel.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
  );
}

/** Memoized search results for Woo: flatten tree once per list, filter on query. */
function WooCategorySearchList({
  list,
  searchQuery,
  wooCats,
  addWooCategory,
  removeWooCategory,
}: {
  list: Array<{ id: string; name: string; parent?: number }>;
  searchQuery: string;
  wooCats: string[];
  addWooCategory: (id: string) => void;
  removeWooCategory: (id: string) => void;
}) {
  const tree = React.useMemo(() => buildWooCategoryTree(list), [list]);
  const flattened = React.useMemo(() => flattenTreeWithPaths(tree), [tree]);
  const filtered = React.useMemo(
    () => filterCategorySearchResults(flattened, searchQuery),
    [flattened, searchQuery],
  );
  return (
    <>
      <ul className="py-1">
        {filtered.map((item) => (
          <li key={item.id} className="list-none">
            <button
              type="button"
              className="w-full text-left text-sm py-2 px-3 hover:bg-gray-100 rounded flex items-center gap-2"
              onClick={() => addWooCategory(item.id)}
            >
              <Checkbox
                checked={wooCats.includes(item.id)}
                onCheckedChange={(checked) => (checked ? addWooCategory(item.id) : removeWooCategory(item.id))}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              />
              <span className="flex-1 min-w-0 truncate" title={item.pathLabel}>
                {item.pathLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && searchQuery.trim() !== '' && (
        <p className="text-sm text-gray-500 px-2 py-2">Ingen träff</p>
      )}
    </>
  );
}

/** Memoized search results for CDON/Fyndiq: flatten tree once per list, filter on query. */
function ChannelCategorySearchList({
  list,
  isFyndiq,
  searchQuery,
  validIds,
  selectedId,
  setChannelCategory,
}: {
  list: Array<{ id: string; name: string; path?: string }>;
  isFyndiq: boolean;
  searchQuery: string;
  validIds: Set<string>;
  selectedId: string;
  setChannelCategory: (id: string) => void;
}) {
  const tree = React.useMemo(
    () => (isFyndiq ? buildFyndiqCategoryTree(list) : buildChannelCategoryTree(list)),
    [list, isFyndiq],
  );
  const flattened = React.useMemo(() => flattenTreeWithPaths(tree), [tree]);
  const filteredByQuery = React.useMemo(
    () => filterCategorySearchResults(flattened, searchQuery),
    [flattened, searchQuery],
  );
  const filtered = filteredByQuery.filter((item) => validIds.has(item.id));
  return (
    <>
      <ul className="py-1">
        {filtered.map((item) => (
          <li key={item.id} className="list-none">
            <button
              type="button"
              className={`w-full text-left text-sm py-2 px-3 hover:bg-gray-100 rounded ${selectedId === item.id ? 'bg-blue-50 text-blue-800' : ''}`}
              onClick={() => setChannelCategory(item.id)}
            >
              <span className="flex-1 min-w-0 truncate block" title={item.pathLabel}>
                {item.pathLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && searchQuery.trim() !== '' && (
        <p className="text-sm text-gray-500 px-2 py-2">Ingen träff</p>
      )}
    </>
  );
}

/** Build tree from flat list. One node per id; missing parents get same id as parentId (no synthetic __parent: id). Better name wins. Sorted by id (numeric). */
function buildChannelCategoryTree(
  list: Array<{ id: string; name: string; path?: string }>,
): ChannelCategoryNode[] {
  if (!list.length) return [];
  const byId = new Map<string, ChannelCategoryNode>();

  function parentId(id: string): string {
    return id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : '';
  }
  function lastSegment(id: string): string {
    return id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id;
  }
  function isWeakName(name: string, forId: string): boolean {
    if (!name || /^\d+$/.test(name)) return true;
    return name.trim() === lastSegment(forId);
  }
  function ensureParent(pid: string): void {
    if (!pid) return;
    if (byId.has(pid)) return;
    ensureParent(parentId(pid));
    const node: ChannelCategoryNode = { id: pid, name: lastSegment(pid), children: [] };
    byId.set(pid, node);
  }

  // Step 1: create all nodes (placeholders for missing parents, real from list); better name wins
  for (const item of list) {
    ensureParent(parentId(item.id));
    const existing = byId.get(item.id);
    if (existing) {
      if (isWeakName(existing.name, item.id) && !isWeakName(item.name, item.id)) existing.name = item.name;
    } else {
      byId.set(item.id, { id: item.id, name: item.name, children: [] });
    }
  }

  // Step 2: attach children to parents, build roots
  const roots: ChannelCategoryNode[] = [];
  for (const node of byId.values()) {
    const pid = parentId(node.id);
    if (pid) byId.get(pid)!.children.push(node);
    else roots.push(node);
  }

  function sortTree(nodes: ChannelCategoryNode[]): void {
    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    nodes.forEach((n) => sortTree(n.children));
  }
  sortTree(roots);
  return roots;
}

/** Fyndiq category tree: hierarchy from path. parentId = segment immediately before leaf (not full prefix). One node per item.id; no synthetic parents. */
function buildFyndiqCategoryTree(
  list: Array<{ id: string; name: string; path?: string }>,
): ChannelCategoryNode[] {
  if (!list.length) return [];
  const byId = new Map<string, ChannelCategoryNode>();
  const parentById = new Map<string, string>();
  const skippedMissingPath: Array<{ id: string; name: string }> = [];
  const skippedLeafMismatch: Array<{ path: string; leafId: string; itemId: string }> = [];

  for (const item of list) {
    const pathStr = item.path != null && item.path !== '' ? String(item.path) : null;
    if (pathStr == null) {
      skippedMissingPath.push({ id: item.id, name: item.name });
      continue;
    }
    const pathSegments = pathStr.split('.').filter(Boolean);
    const leafId = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';
    if (leafId !== item.id) {
      skippedLeafMismatch.push({ path: pathStr, leafId, itemId: item.id });
      continue;
    }
    const parentId = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : '';
    byId.set(item.id, { id: item.id, name: item.name, children: [] });
    parentById.set(item.id, parentId);
  }

  if (process.env.NODE_ENV === 'development' && (skippedMissingPath.length > 0 || skippedLeafMismatch.length > 0)) {
    const totalSkipped = skippedMissingPath.length + skippedLeafMismatch.length;
    console.warn('[buildFyndiqCategoryTree] Skipped items:', totalSkipped, 'missing path:', skippedMissingPath.length, 'leafId mismatch:', skippedLeafMismatch.length);
    const pathExamples = skippedLeafMismatch.slice(0, 5);
    if (pathExamples.length) console.warn('[buildFyndiqCategoryTree] Example paths skipped (leafId !== item.id):', pathExamples);
    const missingPathExamples = skippedMissingPath.slice(0, 5);
    if (missingPathExamples.length) console.warn('[buildFyndiqCategoryTree] Example items skipped (missing path):', missingPathExamples);
  }

  const roots: ChannelCategoryNode[] = [];
  const missingParentIds = new Set<string>();
  for (const node of byId.values()) {
    const pid = parentById.get(node.id) ?? '';
    if (pid === '') {
      roots.push(node);
      continue;
    }
    const parent = byId.get(pid);
    if (parent) {
      parent.children.push(node);
    } else {
      missingParentIds.add(pid);
      roots.push(node);
      if (process.env.NODE_ENV === 'development') {
        console.warn('[buildFyndiqCategoryTree] Parent not in list, node at root', { nodeId: node.id, parentId: pid });
      }
    }
  }

  if (process.env.NODE_ENV === 'development' && missingParentIds.size > 0) {
    const examples = Array.from(missingParentIds).slice(0, 5);
    console.warn('[buildFyndiqCategoryTree] Missing parent ids (count):', missingParentIds.size, 'examples:', examples);
  }

  function maxDepth(nodes: ChannelCategoryNode[], d: number): number {
    if (nodes.length === 0) return d;
    return Math.max(d, ...nodes.map((n) => maxDepth(n.children, d + 1)));
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn('[buildFyndiqCategoryTree] roots:', roots.length, 'maxDepth:', maxDepth(roots, 0));
  }

  function sortByNameThenId(nodes: ChannelCategoryNode[]): void {
    nodes.sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
    nodes.forEach((n) => sortByNameThenId(n.children));
  }
  sortByNameThenId(roots);
  return roots;
}

function CategoryTreeRow({
  node,
  selectedId,
  selectedIds,
  expandedIds,
  onToggleExpand,
  onSelect,
  onToggle,
  depth,
  showId,
  channelListStyle,
}: {
  node: CategoryTreeNode;
  selectedId: string;
  selectedIds?: Set<string>;
  expandedIds: Set<string>;
  onToggleExpand: (id: string, open: boolean) => void;
  onSelect: (id: string) => void;
  onToggle?: (id: string, checked: boolean) => void;
  depth: number;
  showId?: boolean;
  /** CDON/Fyndiq: show as "Namn (egna numret)" in list */
  channelListStyle?: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedIds ? selectedIds.has(node.id) : selectedId === node.id;
  const useCheckbox = selectedIds != null && onToggle != null;
  const displayId = showId && node.id ? node.id : '';
  const ownNumber = node.id.includes('.') ? node.id.slice(node.id.lastIndexOf('.') + 1) : node.id;
  const label = channelListStyle
    ? `${node.name} (${ownNumber})`
    : showId && displayId
      ? `${displayId} – ${node.name}`
      : node.name;
  return (
    <li className="list-none">
      <div
        className={`flex items-center gap-2 py-1 pr-2 rounded hover:bg-gray-100 ${isSelected && !useCheckbox ? 'bg-blue-50 text-blue-800' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-gray-200 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id, !isExpanded);
            }}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        {useCheckbox ? (
          <>
            <Checkbox
              id={`woo-cat-${node.id}`}
              checked={selectedIds.has(node.id)}
              onCheckedChange={(checked) => onToggle(node.id, checked === true)}
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
            {hasChildren ? (
              <button
                type="button"
                className="flex-1 text-left text-sm truncate min-w-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(node.id, !isExpanded);
                }}
              >
                {label}
              </button>
            ) : (
              <span className="flex-1 text-sm truncate min-w-0">{label}</span>
            )}
          </>
        ) : (
          <button
            type="button"
            className="flex-1 text-left text-sm truncate min-w-0"
            onClick={() => onSelect(node.id)}
          >
            {label}
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="py-0">
          {node.children.map((child) => (
            <CategoryTreeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
              showId={showId}
              channelListStyle={channelListStyle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

type MarketKey = 'se' | 'dk' | 'fi' | 'no';

type DeliveryTypeValue = '' | 'mailbox' | 'service_point' | 'home_delivery';

type MarketData = {
  price: number;
  currency: string;
  vatRate: number;
  shippingMin: number;
  shippingMax: number;
  deliveryType: DeliveryTypeValue;
  active: boolean;
};

type TextData = {
  title: string;
  description: string;
  /** For non-default languages: which channels get this text (cdon, fyndiq) */
  validFor?: { cdon?: boolean; fyndiq?: boolean };
};

type ChannelCategory = {
  /** One category ID for CDON (all markets). */
  cdon?: string;
  /** One category ID for Fyndiq (all markets). */
  fyndiq?: string;
  /** WooCommerce: array of category ids per instance */
  woocommerce?: Record<string, string | string[]>;
};

interface ProductFormProps {
  currentItem?: any;
  onSave: (
    data: any,
    options?: {
      hadChanges?: boolean;
      channelTargets?: Array<{ channel: string; channelInstanceId: number | null }>;
      channelTargetsWithMarket?: Array<{ channel: string; channelInstanceId: number | null; market: string }>;
      channelOverridesToSave?: Array<{ channelInstanceId: number | string; category?: string | null; priceAmount?: number | null }>;
    },
  ) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

type FormData = {
  productNumber: string;
  title: string;
  status: 'for sale' | 'draft' | 'archived';
  quantity: number | '';
  priceAmount: number | '';
  purchasePrice: number | '';
  salePrice: number | '';
  currency: string;
  vatRate: number | '';
  sku: string;
  mpn: string;
  description: string;
  mainImage: string;
  images: string[];
  categories: string[];
  brand: string;
  brandId: string;
  ean: string;
  gtin: string;
  supplierId: string;
  manufacturerId: string;
  /** Produkt-fliken: lagerplats (frivillig) */
  lagerplats: string;
  /** Detaljer: färg, storlek, mönster, vikt, mått */
  color: string;
  colorText: string;
  size: string;
  sizeText: string;
  pattern: string;
  weight: number | '';
  lengthCm: number | '';
  widthCm: number | '';
  heightCm: number | '';
  depthCm: number | '';
  /** Produkt-fliken: lista ('' = Huvudlista, annars list id) */
  listId: string;
  /** Per-market: price, shipping, delivery_type, active */
  markets: Record<MarketKey, MarketData>;
  /** Per-market language: title, description (SE/DK/FI/NO) */
  texts: Record<MarketKey, TextData>;
  /** Per-channel categories: one value for CDON, one for Fyndiq; Woo per instance */
  channelCategories: ChannelCategory;
  /** CDON/Fyndiq advanced (stored in channelSpecific) */
  channelSpecific?: Record<string, unknown>;
};

export const ProductForm: React.FC<ProductFormProps> = ({
  currentItem,
  onSave,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
}) => {
  const {
    validationErrors,
    clearValidationErrors,
    batchProductIds,
    batchUpdateProducts,
    closeProductPanel,
    productSettings,
    getChannelDataCache,
    setChannelDataCache,
    getChannelCategories,
  } = useProducts();
  const { isDirty, markDirty, markClean } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentProduct = currentItem;
  const isBatchMode = batchProductIds.length > 0;

  const getDefaultDelivery = (market: MarketKey) =>
    productSettings?.defaultDeliveryCdon?.[market.toUpperCase() as 'SE' | 'DK' | 'NO' | 'FI'] ??
    productSettings?.defaultDeliveryFyndiq?.[market as 'se' | 'dk' | 'fi' | 'no'] ??
    productSettings?.defaultDelivery?.[market];
  const createEmptyMarket = (market: MarketKey, currency: string): MarketData => {
    const dd = getDefaultDelivery(market);
    return {
      price: 0,
      currency,
      vatRate: 25,
      shippingMin: dd?.shippingMin ?? 1,
      shippingMax: dd?.shippingMax ?? 3,
      deliveryType: '',
      active: true,
    };
  };

  const createEmptyText = (): TextData => ({ title: '', description: '' });

  const initialState: FormData = {
    productNumber: '',
    title: '',
    status: 'for sale',
    quantity: 0,
    priceAmount: 0,
    purchasePrice: '',
    salePrice: '',
    currency: 'SEK',
    vatRate: 25,
    sku: '',
    mpn: '',
    description: '',
    mainImage: '',
    images: [],
    categories: [],
    brand: '',
    brandId: '',
    ean: '',
    gtin: '',
    supplierId: '',
    manufacturerId: '',
    lagerplats: '',
    color: '',
    colorText: '',
    size: '',
    sizeText: '',
    pattern: '',
    weight: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    depthCm: '',
    listId: '',
    markets: {
      se: createEmptyMarket('se', 'SEK'),
      dk: createEmptyMarket('dk', 'DKK'),
      fi: createEmptyMarket('fi', 'EUR'),
      no: createEmptyMarket('no', 'NOK'),
    },
    texts: {
      se: createEmptyText(),
      dk: createEmptyText(),
      fi: createEmptyText(),
      no: createEmptyText(),
    },
    channelCategories: {},
  };

  const [formData, setFormData] = useState<FormData>(initialState);
  const [activeTab, setActiveTab] = useState<'kanaler' | 'produkt' | 'texter' | 'media' | 'priser' | 'kategori' | 'detaljer' | 'statistik'>('kanaler');
  // If true: MPN mirrors SKU automatically (until user overrides MPN)
  const [isMpnAuto, setIsMpnAuto] = useState(true);
  const [isGtinAuto, setIsGtinAuto] = useState(true);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [manufacturers, setManufacturers] = useState<Array<{ id: string; name: string }>>([]);
  const [newImage, setNewImage] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [statsRange, setStatsRange] = useState<'7d' | '30d' | '3m' | 'all'>('30d');
  const [stats, setStats] = useState<{ soldCount: number; bestChannel: string | null; activeTargetsCount: number; timeline: any[] } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  // Kanaler tab: instances + targets + overrides
  const [channelInstances, setChannelInstances] = useState<ChannelInstance[]>([]);
  const [channelOverrides, setChannelOverrides] = useState<any[]>([]);
  /** Per-butik (per instance) price overrides for Priser tab. Key = instance id. */
  const [channelPriceOverrides, setChannelPriceOverrides] = useState<Record<string, { priceAmount: string; salePrice: string }>>({});
  /** Marknadspriser SE/DK/FI/NO: amount + source (auto = beräknat från baspris, manual = användarinskrivet). */
  const [marketPrices, setMarketPrices] = useState<Record<MarketKey, { amount: number | ''; source: 'auto' | 'manual' }>>({
    se: { amount: '', source: 'auto' },
    dk: { amount: '', source: 'auto' },
    fi: { amount: '', source: 'auto' },
    no: { amount: '', source: 'auto' },
  });
  const [lastFxObservedAt, setLastFxObservedAt] = useState<string | null>(null);
  const [fxUpdating, setFxUpdating] = useState(false);
  const [channelTargetsLoading, setChannelTargetsLoading] = useState(false);
  const [currentTargetKeys, setCurrentTargetKeys] = useState<Set<string>>(new Set());
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(new Set());
  /** Fetched category lists per channel instance (key = instance id). WooCommerce items could have parent for hierarchy. */
  const [channelCategoriesList, setChannelCategoriesList] = useState<Record<string, Array<{ id: string; name: string; path?: string; parent?: number }>>>({});
  const [channelCategoriesLoading, setChannelCategoriesLoading] = useState<Record<string, boolean>>({});
  const [channelCategoriesError, setChannelCategoriesError] = useState<Record<string, string>>({});
  const categoryFetchStartedRef = useRef<Set<string>>(new Set());
  /** WooCommerce: which category nodes are expanded (key = instance id). Default all collapsed. */
  const [wooExpandedIds, setWooExpandedIds] = useState<Record<string, Set<string>>>({});
  /** WooCommerce: which instance's category panel is open. Default closed to save vertical space. */
  const [wooPanelOpen, setWooPanelOpen] = useState<Record<string, boolean>>({});
  /** CDON/Fyndiq: which category nodes are expanded (key = instance id). */
  const [channelCategoryExpandedIds, setChannelCategoryExpandedIds] = useState<Record<string, Set<string>>>({});
  /** CDON/Fyndiq: which instance's category panel is open. */
  const [channelCategoryPanelOpen, setChannelCategoryPanelOpen] = useState<Record<string, boolean>>({});
  /** Category search filter per row (key = inst.id). */
  const [categorySearch, setCategorySearch] = useState<Record<string, string>>({});

  // Target key: "channel" or "channel:instanceId" for matching
  const targetKey = (channel: string, channelInstanceId: string | null) =>
    channelInstanceId ? `${channel}:${channelInstanceId}` : channel;

  /** CDON/Fyndiq kräver marknad (SE, DK, FI, NO). WooCommerce behöver inte. Används för att visa aktiva/inaktiva i Kanaler och filtrera Priser/Kategorier. */
  const hasValidMarket = (inst: ChannelInstance) => {
    const ch = String(inst.channel).toLowerCase();
    if (ch === 'woocommerce') return true;
    const m = inst.market?.trim()?.toLowerCase().slice(0, 2);
    return !!m && ['se', 'dk', 'fi', 'no'].includes(m);
  };

  // Load channel instances (for both new and existing products) and, when product exists, current targets + overrides.
  // Use context cache so we don’t refetch when switching tabs (cache survives form remount).
  useEffect(() => {
    if (isBatchMode) return;
    const productKey = currentProduct?.id ?? 'new';
    const cached = getChannelDataCache(productKey);
    if (cached) {
      setChannelOverrides(cached.overrides);
      const priceInit: Record<string, { priceAmount: string; salePrice: string }> = {};
      for (const inst of cached.instances) {
        const ov = (cached.overrides as any[]).find((o: any) => String(o.instanceId) === String(inst.id));
        priceInit[String(inst.id)] = { priceAmount: ov?.priceAmount != null ? String(ov.priceAmount) : '', salePrice: '' };
      }
      setChannelPriceOverrides(priceInit);
      setCurrentTargetKeys(new Set(cached.targetKeys));
      setSelectedTargetKeys(new Set(cached.targetKeys));
      setChannelInstances(cached.instances);

      // Stale-while-revalidate: fetch fresh instances in background so labels stay up-to-date (e.g. after editing in Channels)
      let revalidateCancelled = false;
      channelsApi.getInstances().then((resp) => {
        if (revalidateCancelled) return;
        const insts = resp?.items ?? [];
        setChannelInstances(insts);
        setChannelDataCache(productKey, { ...cached, instances: insts });
      }).catch(() => {
        // Keep cached data on error
      });
      return () => { revalidateCancelled = true; };
    }

    let cancelled = false;
    setChannelTargetsLoading(true);
    (async () => {
      try {
        const instResp = await channelsApi.getInstances();
        if (cancelled) return;
        const insts = instResp?.items ?? [];
        setChannelInstances(insts);

        if (!currentProduct?.id) {
          setChannelOverrides([]);
          setCurrentTargetKeys(new Set());
          setChannelDataCache('new', { instances: insts, overrides: [], targetKeys: [] });
          setChannelTargetsLoading(false);
          return;
        }

        const [targetsResp, ovResp] = await Promise.all([
          channelsApi.getProductTargets(String(currentProduct.id)),
          channelsApi.getOverrides({ productId: String(currentProduct.id) }),
        ]);
        if (cancelled) return;
        const targets = targetsResp?.targets ?? [];
        const ovs = ovResp?.items ?? [];
        setChannelOverrides(ovs);
        const keys = new Set<string>();
        for (const t of targets) {
          keys.add(targetKey(t.channel, t.channelInstanceId ?? null));
        }
        const keyList = Array.from(keys);
        setCurrentTargetKeys(keys);
        setSelectedTargetKeys(keys);
        setChannelDataCache(String(currentProduct.id), { instances: insts, overrides: ovs, targetKeys: keyList });
      } catch (err) {
        if (!cancelled) {
          setChannelInstances([]);
          setChannelOverrides([]);
          setCurrentTargetKeys(new Set());
          if (currentProduct?.id) setSelectedTargetKeys(new Set());
        }
        console.error('Failed to load channel targets', err);
      } finally {
        if (!cancelled) setChannelTargetsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentProduct?.id, isBatchMode, getChannelDataCache, setChannelDataCache]);

  // Parse WooCommerce category from override (single id or JSON array)
  const parseWooCategory = (cat: string | null): string[] => {
    if (!cat?.trim()) return [];
    const s = cat.trim();
    if (s.startsWith('[')) {
      try {
        const a = JSON.parse(s);
        return Array.isArray(a) ? a.map(String).filter(Boolean) : [s];
      } catch {
        return [s];
      }
    }
    return [s];
  };

  // Sync overrides into channelCategories (Woo only) and channelPriceOverrides when overrides first load. CDON/Fyndiq category come from channelSpecific only.
  const hasSyncedOverridesRef = React.useRef(false);
  useEffect(() => {
    if (!currentProduct?.id || channelOverrides.length === 0 || channelInstances.length === 0 || hasSyncedOverridesRef.current) return;
    hasSyncedOverridesRef.current = true;
    setFormData((prev) => {
      const nextWoo = { ...(prev.channelCategories?.woocommerce ?? {}) };
      for (const ov of channelOverrides) {
        if (!ov.instanceId) continue;
        const inst = channelInstances.find((i) => i.id === ov.instanceId);
        if (!inst || String(inst.channel).toLowerCase() !== 'woocommerce') continue;
        const key = inst.instanceKey;
        nextWoo[key] = ov.category != null ? parseWooCategory(ov.category) : [];
      }
      return {
        ...prev,
        channelCategories: {
          ...prev.channelCategories,
          cdon: prev.channelCategories?.cdon ?? '',
          fyndiq: prev.channelCategories?.fyndiq ?? '',
          woocommerce: nextWoo,
        },
      };
    });
    const priceInit: Record<string, { priceAmount: string; salePrice: string }> = {};
    for (const inst of channelInstances) {
      const ov = channelOverrides.find((o: any) => String(o.instanceId) === String(inst.id));
      priceInit[String(inst.id)] = { priceAmount: ov?.priceAmount != null ? String(ov.priceAmount) : '', salePrice: ov?.salePrice != null ? String(ov.salePrice) : '' };
    }
    setChannelPriceOverrides(priceInit);
  }, [channelOverrides, channelInstances, currentProduct?.id]);
  useEffect(() => {
    if (!currentProduct?.id) hasSyncedOverridesRef.current = false;
  }, [currentProduct?.id]);

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = isBatchMode
      ? `product-form-batch-${batchProductIds.join(',')}`
      : `product-form-${currentProduct?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentProduct, isBatchMode, batchProductIds, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load current product (or leave empty for batch mode)
  useEffect(() => {
    if (isBatchMode) {
      setFormData(initialState);
      setIsMpnAuto(true);
      markClean();
      return;
    }
    if (currentProduct) {
      const sku = currentProduct.sku ?? '';
      const mpn = currentProduct.mpn ?? '';
      const baseTitle = currentProduct.title ?? '';
      const baseDesc = currentProduct.description ?? '';
      const cs = (currentProduct.channelSpecific && typeof currentProduct.channelSpecific === 'object') ? currentProduct.channelSpecific : {};
      const markets: FormData['markets'] = { ...initialState.markets };
      const texts: FormData['texts'] = { ...initialState.texts };
      for (const m of MARKETS) {
        const mData = (cs.cdon as any)?.markets?.[m.key] ?? (cs.fyndiq as any)?.markets?.[m.key];
        const defShip = getDefaultDelivery(m.key);
        const deliveryTypeFromApi = (arr: Array<{ market?: string; value?: string }> | undefined, marketKey: string) => {
          const upper = marketKey.toUpperCase();
          const entry = arr?.find((e) => String(e.market).toUpperCase() === upper);
          const v = entry?.value as DeliveryTypeValue | undefined;
          return (v === 'mailbox' || v === 'service_point' || v === 'home_delivery') ? v : '';
        };
        const cdonDelivery = (cs.cdon as any)?.delivery_type;
        const fyndiqDelivery = (cs.fyndiq as any)?.delivery_type;
        const deliveryType = deliveryTypeFromApi(Array.isArray(cdonDelivery) ? cdonDelivery : undefined, m.key)
          || deliveryTypeFromApi(Array.isArray(fyndiqDelivery) ? fyndiqDelivery : undefined, m.key);
        if (mData && typeof mData === 'object') {
          markets[m.key] = {
            price: Number.isFinite(mData.price) ? Number(mData.price) : (Number.isFinite(currentProduct.priceAmount) ? Number(currentProduct.priceAmount) : 0),
            currency: mData.currency ?? m.currency,
            vatRate: Number.isFinite(mData.vatRate) ? Number(mData.vatRate) : 25,
            shippingMin: Number.isFinite(mData.shippingMin) ? Number(mData.shippingMin) : (defShip?.shippingMin ?? 1),
            shippingMax: Number.isFinite(mData.shippingMax) ? Number(mData.shippingMax) : (defShip?.shippingMax ?? 3),
            deliveryType: (mData as any).deliveryType ?? deliveryType,
            active: mData.active !== false,
          };
        } else {
          markets[m.key].price = Number.isFinite(currentProduct.priceAmount) ? Number(currentProduct.priceAmount) : markets[m.key].price;
          markets[m.key].currency = currentProduct.currency ?? markets[m.key].currency;
          markets[m.key].shippingMin = defShip?.shippingMin ?? 1;
          markets[m.key].shippingMax = defShip?.shippingMax ?? 3;
          markets[m.key].deliveryType = deliveryType;
        }
        const tData = (cs.cdon as any)?.texts?.[m.key] ?? (cs.fyndiq as any)?.texts?.[m.key];
        const validFor = tData?.validFor ?? { cdon: true, fyndiq: true };
        texts[m.key] = tData && typeof tData === 'object'
          ? { title: tData.title ?? baseTitle, description: tData.description ?? baseDesc, validFor }
          : m.key === 'se' ? { title: baseTitle, description: baseDesc } : { title: '', description: '', validFor: { cdon: true, fyndiq: true } };
      }
      if (!texts.se.title) texts.se = { title: baseTitle, description: baseDesc };
      const pricing = (cs as any)?.pricing;
      const baseAmount = Number.isFinite(currentProduct.priceAmount) ? Number(currentProduct.priceAmount) : 0;
      const baseCur = currentProduct.currency ?? 'SEK';
      const initMarketPrices: Record<MarketKey, { amount: number | ''; source: 'auto' | 'manual' }> = {
        se: { amount: '', source: 'auto' },
        dk: { amount: '', source: 'auto' },
        fi: { amount: '', source: 'auto' },
        no: { amount: '', source: 'auto' },
      };
      if (pricing?.markets && typeof pricing.markets === 'object') {
        for (const m of MARKETS) {
          const pm = pricing.markets[m.key];
          if (pm && typeof pm === 'object') {
            const amt = pm.amount;
            initMarketPrices[m.key] = {
              amount: amt != null && Number.isFinite(Number(amt)) ? Number(amt) : '',
              source: pm.source === 'manual' ? 'manual' : 'auto',
            };
          }
        }
      } else {
        initMarketPrices.se = { amount: baseAmount || '', source: 'auto' };
        for (const m of MARKETS) {
          if (markets[m.key]?.price != null && Number.isFinite(markets[m.key].price)) {
            initMarketPrices[m.key].amount = markets[m.key].price;
          }
        }
      }
      setMarketPrices(initMarketPrices);
      setLastFxObservedAt(typeof pricing?.lastFxObservedAt === 'string' ? pricing.lastFxObservedAt : null);
      setFormData({
        productNumber: currentProduct.productNumber ?? '',
        title: baseTitle,
        status: (currentProduct.status as FormData['status']) ?? 'for sale',
        quantity: Number.isFinite(currentProduct.quantity) ? Number(currentProduct.quantity) : 0,
        priceAmount: baseAmount,
        purchasePrice: (currentProduct as any).purchasePrice != null && Number.isFinite((currentProduct as any).purchasePrice) ? (currentProduct as any).purchasePrice : '',
        salePrice: (currentProduct as any).salePrice != null && Number.isFinite((currentProduct as any).salePrice) ? (currentProduct as any).salePrice : '',
        currency: baseCur,
        vatRate: Number.isFinite(currentProduct.vatRate) ? Number(currentProduct.vatRate) : 25,
        sku,
        mpn,
        description: baseDesc,
        mainImage: currentProduct.mainImage ?? '',
        images: Array.isArray(currentProduct.images) ? currentProduct.images : [],
        categories: Array.isArray(currentProduct.categories) ? currentProduct.categories : [],
        brand: currentProduct.brand ?? '',
        brandId: (currentProduct as any).brandId ?? '',
        ean: (currentProduct as any).ean ?? '',
        gtin: currentProduct.gtin ?? '',
        supplierId: (currentProduct as any).supplierId ?? '',
        manufacturerId: (currentProduct as any).manufacturerId ?? '',
        lagerplats: currentProduct.lagerplats ?? '',
        color: (currentProduct as any).color ?? '',
        colorText: (currentProduct as any).colorText ?? '',
        size: (currentProduct as any).size ?? '',
        sizeText: (currentProduct as any).sizeText ?? '',
        pattern: (currentProduct as any).pattern ?? '',
        weight: (currentProduct as any).weight != null && (currentProduct as any).weight !== '' ? (currentProduct as any).weight : '',
        lengthCm: (currentProduct as any).lengthCm != null && (currentProduct as any).lengthCm !== '' ? (currentProduct as any).lengthCm : '',
        widthCm: (currentProduct as any).widthCm != null && (currentProduct as any).widthCm !== '' ? (currentProduct as any).widthCm : '',
        heightCm: (currentProduct as any).heightCm != null && (currentProduct as any).heightCm !== '' ? (currentProduct as any).heightCm : '',
        depthCm: (currentProduct as any).depthCm != null && (currentProduct as any).depthCm !== '' ? (currentProduct as any).depthCm : '',
        listId: (currentProduct as any).listId ?? '',
        markets,
        texts,
        channelCategories: {
          cdon: (cs.cdon as any)?.category != null && String((cs.cdon as any).category).trim() !== '' ? String((cs.cdon as any).category).trim() : '',
          fyndiq: (Array.isArray((cs.fyndiq as any)?.categories) && (cs.fyndiq as any).categories[0] != null) ? String((cs.fyndiq as any).categories[0]) : '',
          woocommerce: (cs.woocommerce as any)?.categories && typeof (cs.woocommerce as any).categories === 'object' ? (cs.woocommerce as any).categories : {},
        },
        channelSpecific: cs,
      });
      setIsMpnAuto(!(mpn && mpn !== sku));
      const ean = (currentProduct as any).ean ?? '';
      const gtin = currentProduct.gtin ?? '';
      setIsGtinAuto(!(gtin && gtin !== ean));
      markClean();
    } else {
      setFormData(initialState);
      setMarketPrices({ se: { amount: '', source: 'auto' }, dk: { amount: '', source: 'auto' }, fi: { amount: '', source: 'auto' }, no: { amount: '', source: 'auto' } });
      setLastFxObservedAt(null);
      setIsMpnAuto(true);
      markClean();
    }
  }, [currentProduct, isBatchMode, batchProductIds, markClean, productSettings]);

  // Load lists when Produkt tab is active (for List dropdown)
  useEffect(() => {
    if (activeTab !== 'produkt' || isBatchMode) return;
    productsApi.getLists().then((data) => setLists(data || [])).catch(() => setLists([]));
  }, [activeTab, isBatchMode]);

  // Load brands, suppliers, manufacturers when Detaljer tab is active
  useEffect(() => {
    if (activeTab !== 'detaljer' || isBatchMode) return;
    (async () => {
      try {
        const [b, s, m] = await Promise.all([
          productsApi.getBrands(),
          productsApi.getSuppliers(),
          productsApi.getManufacturers(),
        ]);
        setBrands(b);
        setSuppliers(s);
        setManufacturers(m);
      } catch (_) {
        setBrands([]);
        setSuppliers([]);
        setManufacturers([]);
      }
    })();
  }, [activeTab, isBatchMode]);

  // Aggregated list for Kategorier tab: one row CDON, one row Fyndiq, then one per Woo store.
  const categoryTabInstances = React.useMemo(() => {
    const base = channelInstances.filter((i) =>
      ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()) && hasValidMarket(i),
    );
    const hasCdon = base.some((i) => String(i.channel).toLowerCase() === 'cdon');
    const hasFyndiq = base.some((i) => String(i.channel).toLowerCase() === 'fyndiq');
    const result: Array<{ channel: string; id: string; label: string; instanceKey: string; isVirtual?: boolean }> = [];
    if (hasCdon) result.push({ channel: 'cdon', id: 'cdon', label: 'CDON', instanceKey: 'cdon', isVirtual: true });
    if (hasFyndiq) result.push({ channel: 'fyndiq', id: 'fyndiq', label: 'Fyndiq', instanceKey: 'fyndiq', isVirtual: true });
    for (const inst of base) {
      if (String(inst.channel).toLowerCase() === 'woocommerce') {
        result.push({
          channel: inst.channel,
          id: String(inst.id),
          label: inst.label || `WooCommerce.${inst.instanceKey}`,
          instanceKey: inst.instanceKey,
        });
      }
    }
    return result;
  }, [channelInstances]);

  // Fetch category lists from server cache when Kategorier tab is active (one fetch for CDON, one for Fyndiq, per Woo store).
  useEffect(() => {
    if (activeTab !== 'kategori' || isBatchMode || !categoryTabInstances.length) return;
    for (const inst of categoryTabInstances) {
      const key = inst.id;
      if (categoryFetchStartedRef.current.has(key)) continue;
      categoryFetchStartedRef.current.add(key);
      setChannelCategoriesLoading((prev) => ({ ...prev, [key]: true }));
      setChannelCategoriesError((prev) => ({ ...prev, [key]: '' }));
      const fetchInst = inst.isVirtual ? { channel: inst.channel, id: inst.id } : { channel: inst.channel, id: Number(inst.id), instanceKey: inst.instanceKey };
      (async () => {
        try {
          const items = await getChannelCategories(fetchInst as any);
          setChannelCategoriesList((prev) => ({ ...prev, [key]: items }));
          if (String(inst.channel).toLowerCase() === 'woocommerce') {
            setWooExpandedIds((prev) => ({ ...prev, [key]: new Set<string>() }));
          }
        } catch (e: any) {
          const main = e?.message ?? 'Kunde inte hämta kategorier';
          const detail = e?.detail;
          const msg = typeof detail === 'string' && detail && detail !== main ? `${main}. ${detail}` : main;
          setChannelCategoriesError((prev) => ({ ...prev, [key]: typeof msg === 'string' ? msg : JSON.stringify(msg) }));
          setChannelCategoriesList((prev) => ({ ...prev, [key]: [] }));
        } finally {
          setChannelCategoriesLoading((prev) => ({ ...prev, [key]: false }));
        }
      })();
    }
  }, [activeTab, isBatchMode, categoryTabInstances, getChannelCategories]);

  const updateField = (field: keyof FormData, value: string | number | string[]) => {
    setFormData((prev) => {
      // SKU change should update MPN if MPN is in auto mode
      if (field === 'sku') {
        const sku = String(value ?? '');
        if (isMpnAuto) {
          return { ...prev, sku, mpn: sku };
        }
        return { ...prev, sku };
      }

      // MPN change: if user clears it, return to auto mode and mirror SKU
      if (field === 'mpn') {
        const mpn = String(value ?? '');
        const trimmed = mpn.trim();
        if (!trimmed) {
          setIsMpnAuto(true);
          return { ...prev, mpn: prev.sku };
        }
        setIsMpnAuto(false);
        return { ...prev, mpn };
      }

      // EAN change: if GTIN is in auto mode, mirror GTIN from EAN
      if (field === 'ean') {
        const ean = String(value ?? '').trim();
        if (isGtinAuto) {
          return { ...prev, ean, gtin: ean };
        }
        return { ...prev, ean };
      }

      // GTIN change: if user clears it, return to auto mode and mirror EAN
      if (field === 'gtin') {
        const gtin = String(value ?? '');
        const trimmed = gtin.trim();
        if (!trimmed) {
          setIsGtinAuto(true);
          return { ...prev, gtin: prev.ean };
        }
        setIsGtinAuto(false);
        return { ...prev, gtin };
      }

      // Title/description: also sync to texts.se (default market)
      if (field === 'title') return { ...prev, title: String(value), texts: { ...prev.texts, se: { ...prev.texts.se, title: String(value) } } } as FormData;
      if (field === 'description') return { ...prev, description: String(value), texts: { ...prev.texts, se: { ...prev.texts.se, description: String(value) } } } as FormData;

      return ({ ...prev, [field]: value } as FormData);
    });
    markDirty();
    clearValidationErrors();
  };

  const updateNumber = (field: 'quantity' | 'priceAmount' | 'vatRate', raw: string) => {
    const n = raw === '' ? NaN : Number(raw.replace(',', '.'));
    updateField(field, Number.isFinite(n) ? n : field === 'vatRate' ? 25 : 0);
  };

  const updateMarket = (market: MarketKey, field: keyof MarketData, value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      markets: {
        ...prev.markets,
        [market]: { ...prev.markets[market], [field]: value },
      },
    }));
    markDirty();
  };

  const updateText = (market: MarketKey, field: keyof TextData, value: string | { cdon?: boolean; fyndiq?: boolean }) => {
    setFormData((prev) => {
      const next = { ...prev, texts: { ...prev.texts, [market]: { ...prev.texts[market], [field]: value } } };
      if (market === 'se' && field === 'title' && typeof value === 'string') next.title = value;
      if (market === 'se' && field === 'description' && typeof value === 'string') next.description = value;
      return next;
    });
    markDirty();
    if (market === 'se' && (field === 'title' || field === 'description')) clearValidationErrors();
  };

  const handleSubmit = useCallback(async () => {
    clearValidationErrors();

    if (isBatchMode) {
      const updates: {
        priceAmount?: number;
        quantity?: number;
        status?: string;
        vatRate?: number;
        currency?: string;
      } = {};
      if (formData.priceAmount !== '' && formData.priceAmount != null && Number.isFinite(Number(formData.priceAmount))) {
        updates.priceAmount = Number(formData.priceAmount);
      }
      if (formData.quantity !== '' && formData.quantity != null && Number.isFinite(Number(formData.quantity))) {
        updates.quantity = Math.max(0, Math.trunc(Number(formData.quantity)));
      }
      if (formData.vatRate !== '' && formData.vatRate != null && Number.isFinite(Number(formData.vatRate))) {
        updates.vatRate = Number(formData.vatRate);
      }
      if (formData.currency?.trim()) {
        updates.currency = formData.currency.trim().toUpperCase();
      }
      if (Object.keys(updates).length === 0) {
        return;
      }
      setIsSubmitting(true);
      try {
        await batchUpdateProducts(batchProductIds, updates);
        markClean();
        closeProductPanel();
      } catch (err) {
        console.error('Batch update failed', err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const hadChanges = !!currentProduct && isDirty;
      // Build API-shaped channelSpecific: shipping_time, delivery_type, title[], description[]
      const shippingTime = MARKETS.map((m) => ({
        market: m.key.toUpperCase(),
        min: formData.markets[m.key].shippingMin,
        max: formData.markets[m.key].shippingMax,
      }));
      const cdonDeliveryType = MARKETS.filter((m) => formData.markets[m.key].deliveryType)
        .map((m) => ({ market: m.key.toUpperCase(), value: formData.markets[m.key].deliveryType }));
      const fyndiqDeliveryType = MARKETS.filter((m) => {
        const dt = formData.markets[m.key].deliveryType;
        return dt && dt !== 'home_delivery'; // Fyndiq: only mailbox, service_point
      }).map((m) => ({ market: m.key.toUpperCase(), value: formData.markets[m.key].deliveryType }));

      // Build title/description arrays per channel from texts + validFor (API format: { language, value }[])
      // Default sv-SE always included. Non-default: only if validFor[channel] is true.
      const buildTextArrays = (channel: 'cdon' | 'fyndiq') => {
        const arr: Array<{ language: string; value: string }> = [];
        const se = formData.texts.se;
        if (se?.title && se.title.trim().length >= 5) {
          arr.push({ language: 'sv-SE', value: se.title.trim().slice(0, 150) });
        }
        for (const m of MARKETS) {
          if (m.key === 'se') continue;
          const t = formData.texts[m.key];
          const vf = t?.validFor;
          const useForChannel = vf?.[channel] === true;
          if (!useForChannel || !t?.title?.trim()) continue;
          const val = t.title.trim().slice(0, 150);
          if (val.length >= 5) arr.push({ language: m.lang, value: val });
        }
        return arr;
      };
      const buildDescArrays = (channel: 'cdon' | 'fyndiq') => {
        const arr: Array<{ language: string; value: string }> = [];
        const se = formData.texts.se;
        if (se?.description && se.description.trim().length >= 10) {
          arr.push({ language: 'sv-SE', value: se.description.trim().slice(0, 4096) });
        }
        for (const m of MARKETS) {
          if (m.key === 'se') continue;
          const t = formData.texts[m.key];
          const vf = t?.validFor;
          const useForChannel = vf?.[channel] === true;
          if (!useForChannel || !t?.description?.trim()) continue;
          const val = t.description.trim().slice(0, 4096);
          if (val.length >= 10) arr.push({ language: m.lang, value: val });
        }
        return arr;
      };
      const cdonTitle = buildTextArrays('cdon');
      const cdonDesc = buildDescArrays('cdon');
      const fyndiqTitle = buildTextArrays('fyndiq');
      const fyndiqDesc = buildDescArrays('fyndiq');

      const channelSpecific: Record<string, unknown> = {
        cdon: {
          markets: formData.markets,
          texts: formData.texts,
          category: (formData.channelCategories?.cdon ?? '').trim() || null,
          shipping_time: shippingTime,
          ...(cdonDeliveryType.length > 0 && { delivery_type: cdonDeliveryType }),
          ...(cdonTitle.length > 0 && { title: cdonTitle }),
          ...(cdonDesc.length > 0 && { description: cdonDesc }),
        },
        fyndiq: {
          markets: formData.markets,
          texts: formData.texts,
          categories: (formData.channelCategories?.fyndiq ?? '').trim() ? [String(formData.channelCategories.fyndiq).trim()] : [],
          shipping_time: shippingTime,
          ...(fyndiqDeliveryType.length > 0 && { delivery_type: fyndiqDeliveryType }),
          ...(fyndiqTitle.length > 0 && { title: fyndiqTitle }),
          ...(fyndiqDesc.length > 0 && { description: fyndiqDesc }),
        },
      };
      const baseAmount = typeof formData.priceAmount === 'number' && Number.isFinite(formData.priceAmount) ? formData.priceAmount : 0;
      const baseCurrency = (formData.currency || 'SEK').trim().toUpperCase();
      const pricing = {
        base: { amount: baseAmount, currency: baseCurrency },
        markets: {
          se: { amount: marketPrices.se.amount === '' ? undefined : Number(marketPrices.se.amount), currency: 'SEK', source: marketPrices.se.source },
          dk: { amount: marketPrices.dk.amount === '' ? undefined : Number(marketPrices.dk.amount), currency: 'DKK', source: marketPrices.dk.source },
          fi: { amount: marketPrices.fi.amount === '' ? undefined : Number(marketPrices.fi.amount), currency: 'EUR', source: marketPrices.fi.source },
          no: { amount: marketPrices.no.amount === '' ? undefined : Number(marketPrices.no.amount), currency: 'NOK', source: marketPrices.no.source },
        },
        ...(lastFxObservedAt && { lastFxObservedAt }),
      };
      (channelSpecific as any).pricing = pricing;
      const payload = { ...formData, channelSpecific };
      // Build desired channel targets from Kanaler tab selections
      const channelTargets = Array.from(selectedTargetKeys).map((k) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
        const instId = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        return {
          channel: ch,
          channelInstanceId: instId && Number.isFinite(Number(instId)) ? Number(instId) : null,
        };
      });
      // Endast kanaler med angiven marknad (ingen fallback – CDON/Fyndiq kräver rätt marknad)
      const channelTargetsWithMarket = Array.from(selectedTargetKeys)
        .map((k) => {
          const colonIdx = k.indexOf(':');
          const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
          const instIdStr = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
          const inst = channelInstances.find(
            (i) => String(i.channel) === ch && String(i.id) === instIdStr,
          );
          const marketRaw = inst?.market?.trim();
          if (!marketRaw) return null;
          const market = marketRaw.toLowerCase().slice(0, 2);
          if (!['se', 'dk', 'fi', 'no'].includes(market)) return null;
          return {
            channel: ch,
            channelInstanceId: instIdStr && Number.isFinite(Number(instIdStr)) ? Number(instIdStr) : null,
            market,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      // Use fresh instances from API at save time so Woo (and all instances) are included for override save
      const instResp = await channelsApi.getInstances({ includeDisabled: true });
      const saveInstances = instResp?.items ?? [];
      const channelOverridesToSave = saveInstances
        .filter((i) => ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()))
        .map((inst) => {
          const ch = String(inst.channel).toLowerCase();
          const rawCat = ch === 'woocommerce'
            ? formData.channelCategories?.woocommerce?.[inst.instanceKey]
            : null;
          const cat = ch === 'woocommerce'
            ? (Array.isArray(rawCat) ? (rawCat.length ? JSON.stringify(rawCat) : null) : (typeof rawCat === 'string' && rawCat?.trim() ? rawCat.trim() : null))
            : null;
          const po = channelPriceOverrides[String(inst.id)];
          const priceStr = (po?.priceAmount ?? '').trim().replace(',', '.');
          const priceAmount = priceStr !== '' && Number.isFinite(Number(priceStr)) && Number(priceStr) >= 0 ? Number(priceStr) : null;
          return {
            channelInstanceId: inst.id,
            category: cat,
            priceAmount,
          };
        })
        .filter((o) => o.channelInstanceId);
      const success = await onSave(payload, { hadChanges, channelTargets, channelTargetsWithMarket, channelOverridesToSave });
      if (success) {
        if (currentProduct?.id) {
          const listId = formData.listId?.trim() || null;
          try {
            await productsApi.setProductList(currentProduct.id, listId);
          } catch (e) {
            console.error('Failed to set product list', e);
          }
        }
        markClean();
        if (!currentProduct) {
          setFormData(initialState);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    onSave,
    markClean,
    currentProduct,
    clearValidationErrors,
    isDirty,
    isBatchMode,
    batchProductIds,
    batchUpdateProducts,
    closeProductPanel,
    selectedTargetKeys,
    channelInstances,
    channelPriceOverrides,
    marketPrices,
    lastFxObservedAt,
  ]);

  // Listen for submit/cancel events from panel footer (cancelProductForm fires after user already confirmed in global nav guard, so close directly)
  useEffect(() => {
    const onSubmit = () => handleSubmit();
    const onCancelEvent = () => onCancel();
    window.addEventListener('submitProductForm', onSubmit);
    window.addEventListener('cancelProductForm', onCancelEvent);
    return () => {
      window.removeEventListener('submitProductForm', onSubmit);
      window.removeEventListener('cancelProductForm', onCancelEvent);
    };
  }, [handleSubmit, onCancel]);

  const getFieldError = (fieldName: string) => validationErrors.find((e) => e.field === fieldName);
  const isWarningMessage = (message: string) =>
    /^varning\b/i.test(String(message || '').trim()) || /^warning\b/i.test(String(message || '').trim());
  const hasBlockingErrors = validationErrors.some((e) => !isWarningMessage(e.message));

  const addImage = () => {
    const v = newImage.trim();
    if (!v) return;
    updateField('images', [...formData.images, v]);
    setNewImage('');
  };

  const removeImage = (idx: number) => {
    const next = formData.images.slice();
    next.splice(idx, 1);
    updateField('images', next);
  };

  const promoteToMain = (idx: number) => {
    const url = formData.images[idx];
    if (!url) return;
    const oldMain = formData.mainImage;
    // Swap: promoted extra becomes main; old main takes that extra's slot (no cycling).
    const newImages = formData.images.slice();
    if (oldMain) {
      newImages[idx] = oldMain;
    } else {
      newImages.splice(idx, 1);
    }
    setFormData((prev) => ({ ...prev, mainImage: url, images: newImages }));
    markDirty();
  };

  const addImageFromUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setMediaUploading(true);
    try {
      const items = await filesApi.uploadFiles(Array.from(files));
      const urls = (items || []).map((i: any) => i?.url).filter(Boolean);
      const toAdd = urls.map((u: string) => (u.startsWith('http') ? u : `${window.location.origin}${u.startsWith('/') ? '' : '/'}${u}`));
      setFormData((prev) => {
        let main = prev.mainImage;
        let imgs = [...prev.images];
        for (const u of toAdd) {
          if (!main) {
            main = u;
          } else if (imgs.length < 10) {
            imgs.push(u);
          } else break;
        }
        return { ...prev, mainImage: main, images: imgs };
      });
      markDirty();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setMediaUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {isBatchMode && (
          <Card padding="sm" className="shadow-none px-0 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              Batch edit: only the fields you fill in (price, quantity, VAT, currency) will be applied to the {batchProductIds.length} selected products. Leave a field empty to keep current values.
            </p>
          </Card>
        )}

        {/* Tab bar (only for single product edit/create) */}
        {!isBatchMode && (
          <div className="flex gap-1 border-b border-gray-200 pb-0">
            {[
              { id: 'kanaler' as const, label: 'Kanaler' },
              { id: 'produkt' as const, label: 'Produkt' },
              { id: 'texter' as const, label: 'Texter' },
              { id: 'media' as const, label: 'Media' },
              { id: 'priser' as const, label: 'Priser' },
              { id: 'kategori' as const, label: 'Kategori' },
              { id: 'detaljer' as const, label: 'Detaljer' },
              { id: 'statistik' as const, label: 'Statistik' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-sm font-medium rounded-t -mb-px border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Validation Summary */}
        {hasBlockingErrors && !isBatchMode && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800">Cannot save product</h3>
              <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                {validationErrors
                  .filter((e) => !isWarningMessage(e.message))
                  .map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Batch mode: only batch-relevant fields */}
        {isBatchMode && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Batch Edit</Heading>
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <Label htmlFor="batch-priceAmount" className="mb-1">Price</Label>
                <Input id="batch-priceAmount" inputMode="decimal" type="text" value={String(formData.priceAmount)} onChange={(e) => updateNumber('priceAmount', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="batch-currency" className="mb-1">Currency</Label>
                <NativeSelect id="batch-currency" value={formData.currency} onChange={(e) => updateField('currency', e.target.value)}>
                  <option value="SEK">SEK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="NOK">NOK</option>
                  <option value="DKK">DKK</option>
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="batch-vatRate" className="mb-1">VAT rate (%)</Label>
                <Input id="batch-vatRate" inputMode="decimal" type="text" value={String(formData.vatRate)} onChange={(e) => updateNumber('vatRate', e.target.value)} placeholder="25" />
              </div>
              <div>
                <Label htmlFor="batch-quantity" className="mb-1">Quantity</Label>
                <Input id="batch-quantity" inputMode="numeric" type="text" value={String(formData.quantity)} onChange={(e) => updateNumber('quantity', e.target.value)} placeholder="0" />
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Produkt – enligt Produktdetaljer.md: Eget namn, SKU, Moms, Antal i lager, Lagerplats, Leveranstid, Lista */}
        {!isBatchMode && activeTab === 'produkt' && (
        <>
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Produkt</Heading>
          <div className="md:max-w-[50%]">
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid md:gap-3 lg:grid-cols-[1fr_1fr_5rem_10rem]">
            <div className="min-w-0">
              <Label htmlFor="productNumber" className="mb-1">Eget namn (frivillig)</Label>
              <Input
                id="productNumber"
                type="text"
                value={formData.productNumber}
                onChange={(e) => updateField('productNumber', e.target.value)}
                placeholder="Frivillig"
                className={getFieldError('productNumber') ? 'border-red-500' : ''}
              />
              {getFieldError('productNumber') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('productNumber')?.message}</p>
              )}
            </div>
            <div className="min-w-0">
              <Label htmlFor="sku" className="mb-1">SKU *</Label>
              <Input
                id="sku"
                type="text"
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                placeholder="SKU"
                required
                className={getFieldError('sku') ? 'border-red-500' : ''}
              />
              {getFieldError('sku') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('sku')?.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="vatRate" className="mb-1">Moms</Label>
              <NativeSelect
                id="vatRate"
                className="w-full"
                value={String(formData.vatRate)}
                onChange={(e) => updateField('vatRate', Number(e.target.value))}
              >
                <option value="25">25%</option>
                <option value="12">12%</option>
                <option value="6">6%</option>
                <option value="0">0%</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="purchasePrice" className="mb-1">Inköpspris</Label>
              <Input
                id="purchasePrice"
                inputMode="decimal"
                type="text"
                className="w-full max-w-[10rem] text-right"
                value={formData.purchasePrice === '' ? '' : String(formData.purchasePrice)}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData((prev) => ({ ...prev, purchasePrice: v === '' ? '' : (Number(v.replace(',', '.')) || 0) }));
                  markDirty();
                }}
              />
            </div>
          </div>

          <div className="mt-6">
            <Heading level={3} className="mb-3">Lager</Heading>
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-3">
              <div>
                <Label htmlFor="quantity" className="mb-1">Antal i lager *</Label>
                <Input
                  id="quantity"
                  inputMode="numeric"
                  type="text"
                  value={String(formData.quantity)}
                  onChange={(e) => updateNumber('quantity', e.target.value)}
                  placeholder="0"
                  required
                  className={getFieldError('quantity') ? 'border-red-500' : ''}
                />
                {getFieldError('quantity') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('quantity')?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lagerplats" className="mb-1">Lagerplats (frivillig)</Label>
                <Input
                  id="lagerplats"
                  type="text"
                  value={formData.lagerplats}
                  onChange={(e) => { setFormData((prev) => ({ ...prev, lagerplats: e.target.value })); markDirty(); }}
                  placeholder="Frivillig"
                />
              </div>
              <div>
                <Label htmlFor="lista" className="mb-1">Lista</Label>
                <NativeSelect
                  id="lista"
                  value={formData.listId}
                  onChange={(e) => { setFormData((prev) => ({ ...prev, listId: e.target.value })); markDirty(); }}
                >
                  <option value="">Huvudlista</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
          </div>
        </Card>

        {/* Leveranstid per marknad: 4x2 (min/max) + leveranstyp. Frivilligt, default från inställningar. */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Leveranstid per marknad</Heading>
          <p className="text-sm text-gray-600 mb-4">Frakt min/max (dagar) per marknad. Frivilligt – default från inställningar om tomt.</p>
          <div className="overflow-x-auto md:max-w-[50%]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-500">Marknad</th>
                  <th className="text-left py-2 font-medium text-gray-500">Min (dagar)</th>
                  <th className="text-left py-2 font-medium text-gray-500">Max (dagar)</th>
                  <th className="text-left py-2 font-medium text-gray-500">Leveranstyp</th>
                </tr>
              </thead>
              <tbody>
                {MARKETS.map((m) => {
                  const data = formData.markets[m.key];
                  return (
                    <tr key={m.key} className="border-b border-gray-100">
                      <td className="py-1.5 font-medium">{m.label}</td>
                      <td className="py-1.5">
                        <Input
                          inputMode="numeric"
                          type="text"
                          value={String(data.shippingMin)}
                          onChange={(e) => {
                            const n = e.target.value === '' ? NaN : parseInt(e.target.value, 10);
                            updateMarket(m.key, 'shippingMin', Number.isFinite(n) ? n : 1);
                          }}
                          placeholder="1"
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="py-1.5">
                        <Input
                          inputMode="numeric"
                          type="text"
                          value={String(data.shippingMax)}
                          onChange={(e) => {
                            const n = e.target.value === '' ? NaN : parseInt(e.target.value, 10);
                            updateMarket(m.key, 'shippingMax', Number.isFinite(n) ? n : 3);
                          }}
                          placeholder="3"
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="py-1.5">
                        <NativeSelect
                          value={data.deliveryType || ''}
                          onChange={(e) => updateMarket(m.key, 'deliveryType', (e.target.value || '') as DeliveryTypeValue)}
                          className="min-h-9 h-9 w-auto max-w-[14rem] py-1.5 pl-3 pr-8 leading-tight"
                        >
                          <option value="">Ej angivet</option>
                          <option value="mailbox">Mailbox</option>
                          <option value="service_point">Service Point</option>
                          <option value="home_delivery">Home Delivery (Endast CDON)</option>
                        </NativeSelect>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>
        )}

        {/* Tab: Texter (per-market title/description) */}
        {!isBatchMode && activeTab === 'texter' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Texter per marknad</Heading>
            <p className="text-sm text-gray-600 mb-4">
              Titel och beskrivning per språk. sv-SE är standard. För andra språk: välj vilka kanaler som ska få texten (annars används svenska).
            </p>
            <div className="space-y-4">
              {MARKETS.map((m) => {
                const t = formData.texts[m.key];
                const isDefault = m.lang === DEFAULT_LANGUAGE;
                const vf = t?.validFor ?? { cdon: true, fyndiq: true };
                return (
                  <Collapsible key={m.key} defaultOpen={m.key === 'se'}>
                    <CollapsibleTrigger className="group flex items-center gap-2 w-full text-left font-medium py-2">
                      <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                      {m.label} ({m.lang}) {isDefault && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Standard</span>}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 pl-6 space-y-3">
                      <div>
                        <Label className="mb-1">Titel {isDefault && '*'}</Label>
                        <Input
                          value={t.title}
                          onChange={(e) => updateText(m.key, 'title', e.target.value)}
                          placeholder={isDefault ? 'Produkttitel' : 'Översättning eller tomt för standard'}
                        />
                      </div>
                      <div>
                        <Label className="mb-1">Beskrivning</Label>
                        <Textarea
                          rows={3}
                          value={t.description}
                          onChange={(e) => updateText(m.key, 'description', e.target.value)}
                          placeholder={isDefault ? 'Produktbeskrivning' : 'Översättning eller tomt'}
                        />
                      </div>
                      {!isDefault && (
                        <div className="flex flex-wrap gap-4 pt-1">
                          <span className="text-xs text-gray-500 self-center">Skicka till:</span>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!vf.cdon}
                              onChange={(e) => updateText(m.key, 'validFor', { ...vf, cdon: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">CDON</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!vf.fyndiq}
                              onChange={(e) => updateText(m.key, 'validFor', { ...vf, fyndiq: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">Fyndiq</span>
                          </label>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </Card>
        )}

        {/* Tab: Media — 11 slots: 1 main + 10 extra */}
        {!isBatchMode && activeTab === 'media' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Bilder</Heading>
            <p className="text-sm text-gray-600 mb-4">
              Huvudbild (1 stor) + upp till 10 extra. Ladda upp eller ange URL. Stjärna = flytta till huvudbild.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Main image — large slot */}
              <div className="col-span-2 row-span-2 md:col-span-2 md:row-span-2">
                <div className="relative aspect-square rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 group">
                  {formData.mainImage ? (
                    <>
                      <img src={formData.mainImage} alt="Huvudbild" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => updateField('mainImage', '')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-white font-medium px-2 py-1 bg-blue-600 rounded">Huvudbild</span>
                      </div>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-full cursor-pointer p-4">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500 text-center">Huvudbild</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImageFromUpload(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>
              {/* 10 smaller slots */}
              {Array.from({ length: 10 }).map((_, idx) => {
                const img = formData.images[idx];
                return (
                  <div key={idx} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50 group">
                    {img ? (
                      <>
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <Button type="button" variant="secondary" size="sm" className="p-1 h-8 w-8" onClick={() => promoteToMain(idx)} title="Flytta till huvudbild">
                            <Star className="w-4 h-4" />
                          </Button>
                          <Button type="button" variant="secondary" size="sm" className="p-1 h-8 w-8" onClick={() => removeImage(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      idx === formData.images.length && (
                        <label className="flex flex-col items-center justify-center h-full cursor-pointer p-2">
                          <Upload className="w-6 h-6 text-gray-400" />
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImageFromUpload(e.target.files)} />
                        </label>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" />
                <span className="text-sm">{mediaUploading ? 'Laddar upp…' : 'Ladda upp'}</span>
                <input type="file" accept="image/*" multiple className="hidden" disabled={mediaUploading} onChange={(e) => addImageFromUpload(e.target.files)} />
              </label>
              <span className="text-xs text-gray-500">eller</span>
              <div className="flex gap-2 flex-1 min-w-0 max-w-md">
                <Input
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  placeholder="Bild-URL"
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addImage}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Kanaler */}
        {!isBatchMode && activeTab === 'kanaler' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Kanaler</Heading>
            <p className="text-sm text-gray-600 mb-4">
              Välj vilka kanaler/instanser produkten ska pushas till. Vid Spara publiceras ändringar direkt (Publish/Delete).
            </p>
            {channelTargetsLoading ? (
              <p className="text-sm text-gray-500">Laddar…</p>
            ) : channelInstances.length === 0 ? (
              <p className="text-sm text-gray-500">
                Inga kanaler konfigurerade. Gå till pluginet <strong>Channels</strong> och lägg till WooCommerce, CDON eller Fyndiq.
              </p>
            ) : (
              <div className="space-y-3">
                {['woocommerce', 'cdon', 'fyndiq'].map((ch) => {
                  const insts = channelInstances.filter(
                    (i) => String(i.channel).toLowerCase() === ch,
                  );
                  if (insts.length === 0) return null;
                  const sectionLabel =
                    ch === 'woocommerce' ? 'Webbshoppar' : ch === 'cdon' ? 'CDON' : 'Fyndiq';
                  return (
                    <div key={ch}>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        {sectionLabel}
                      </div>
                      <div className="space-y-0.5">
                        {insts.map((inst) => {
                          const key = targetKey(inst.channel, inst.id);
                          const checked = selectedTargetKeys.has(key);
                          const selectable = hasValidMarket(inst);
                          const label = inst.label || `${inst.channel}.${inst.instanceKey}`;
                          const sub = selectable
                            ? (inst.market ? `${inst.instanceKey} · ${inst.market}` : inst.instanceKey)
                            : 'Saknar marknad – konfigurera i Channels';
                          return (
                            <label
                              key={inst.id}
                              className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${selectable ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!selectable}
                                onChange={() => {
                                  if (!selectable) return;
                                  setSelectedTargetKeys((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key);
                                    else next.add(key);
                                    return next;
                                  });
                                  markDirty();
                                }}
                                className="rounded border-gray-300"
                              />
                              <div>
                                <span className="text-sm font-medium">{label}</span>
                                <span className={`text-xs ml-2 ${selectable ? 'text-gray-500' : 'text-amber-600'}`}>{sub}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Priser — Baspris + en rad per butik/marknad med Pris per butik, Reapris/Originalpris */}
        {!isBatchMode && activeTab === 'priser' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Priser</Heading>
            {/* Baspris + Valuta + Uppdatera med dagens kurser på samma rad */}
            <div className="flex flex-wrap items-end gap-3 max-w-2xl mb-4">
              <div>
                <Label htmlFor="priceAmount" className="mb-1">Baspris</Label>
                <Input
                  id="priceAmount"
                  inputMode="decimal"
                  type="text"
                  value={String(formData.priceAmount)}
                  onChange={(e) => updateNumber('priceAmount', e.target.value)}
                  placeholder="0"
                  className={getFieldError('priceAmount') ? 'border-red-500' : ''}
                />
                {getFieldError('priceAmount') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('priceAmount')?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="currency" className="mb-1">Valuta</Label>
                <NativeSelect
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                >
                  <option value="SEK">SEK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="NOK">NOK</option>
                  <option value="DKK">DKK</option>
                </NativeSelect>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={fxUpdating}
                  onClick={async () => {
                    setFxUpdating(true);
                    try {
                      const rates = await getFxLatest();
                      const baseAmount = typeof formData.priceAmount === 'number' && Number.isFinite(formData.priceAmount) ? formData.priceAmount : 0;
                      const baseCur = (formData.currency || 'SEK').trim().toUpperCase();
                      if (!rates.EUR || !rates.DKK || !rates.NOK) {
                        return;
                      }
                      const dkk = rates.DKK;
                      const eur = rates.EUR;
                      const nok = rates.NOK;
                      let baseSEK = baseAmount;
                      if (baseCur === 'EUR') baseSEK = baseAmount * eur;
                      else if (baseCur === 'DKK') baseSEK = baseAmount * dkk;
                      else if (baseCur === 'NOK') baseSEK = baseAmount * nok;
                      else if (baseCur !== 'SEK') return;
                      const round = (n: number, decimals: number) => {
                        if (decimals === 0) return Math.round(n);
                        const f = 10 ** decimals;
                        return Math.round(n * f) / f;
                      };
                      setMarketPrices((prev) => {
                        const next = { ...prev };
                        if (prev.se.source === 'auto') next.se = { amount: round(baseSEK, 0), source: 'auto' };
                        if (prev.dk.source === 'auto') next.dk = { amount: round(baseSEK / dkk, 0), source: 'auto' };
                        if (prev.fi.source === 'auto') next.fi = { amount: round(baseSEK / eur, 2), source: 'auto' };
                        if (prev.no.source === 'auto') next.no = { amount: round(baseSEK / nok, 0), source: 'auto' };
                        return next;
                      });
                      if (rates.observedAt) setLastFxObservedAt(rates.observedAt);
                      markDirty();
                    } finally {
                      setFxUpdating(false);
                    }
                  }}
                >
                  {fxUpdating ? 'Uppdaterar…' : 'Uppdatera med dagens kurser'}
                </Button>
              </div>
            </div>
            {/* En rad per butik/marknad: label, Pris per butik, valuta, Reapris/Originalpris */}
            {channelInstances.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pris per butik / marknad</div>
                <p className="text-xs text-gray-500 mb-1.5">Tomt pris = använder Baspris. Fyll i för att sätta ett eget pris för denna butik.</p>
                {channelInstances
                  .filter((i) => ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()) && hasValidMarket(i))
                  .sort((a, b) => {
                    const chA = String(a.channel).toLowerCase();
                    const chB = String(b.channel).toLowerCase();
                    const channelOrder = (c: string) => (c === 'woocommerce' ? 0 : c === 'cdon' ? 1 : 2);
                    if (channelOrder(chA) !== channelOrder(chB)) return channelOrder(chA) - channelOrder(chB);
                    const toMk = (m: string) => { const s = (m || 'se').toLowerCase().slice(0, 2); return s === 'sv' ? 'se' : s; };
                    const marketOrder: Record<string, number> = { se: 0, dk: 1, fi: 2, no: 3 };
                    return (marketOrder[toMk(a.market || '')] ?? 4) - (marketOrder[toMk(b.market || '')] ?? 4);
                  })
                  .map((inst) => {
                    const id = String(inst.id);
                    const po = channelPriceOverrides[id] ?? { priceAmount: '', salePrice: '' };
                    const ch = String(inst.channel).toLowerCase();
                    const channelName = ch === 'woocommerce' ? 'Webbshop' : ch === 'cdon' ? 'CDON' : ch === 'fyndiq' ? 'Fyndiq' : inst.channel;
                    const part = inst.label || inst.instanceKey || inst.market || '';
                    const label = part ? `${channelName} · ${part}` : channelName;
                    const rawMk = (inst.market ?? '').toLowerCase().slice(0, 2);
                    const mk: MarketKey = rawMk === 'sv' ? 'se' : (['se', 'dk', 'fi', 'no'].includes(rawMk) ? rawMk : 'se') as MarketKey;
                    const m = MARKETS.find((x) => x.key === mk) ?? MARKETS[0];
                    const mp = marketPrices[mk];
                    const marketVal = mp.amount === '' ? '' : String(mp.amount);
                    const isFyndiq = String(inst.channel).toLowerCase() === 'fyndiq';
                    const isWoo = String(inst.channel).toLowerCase() === 'woocommerce';
                    const pricePlaceholder = marketVal || '';
                    return (
                      <div key={inst.id} className="flex flex-wrap items-center gap-2 gap-y-1.5 py-1 border-b border-gray-100 last:border-0">
                        <div className="w-[200px] min-w-[200px] shrink-0">
                          <span className="text-sm font-medium block truncate" title={label}>{label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-500">Pris</Label>
                          <Input
                            inputMode="decimal"
                            type="text"
                            className="w-[8ch] text-right"
                            value={po.priceAmount}
                            onChange={(e) => {
                              const v = e.target.value;
                              setChannelPriceOverrides((prev) => ({
                                ...prev,
                                [id]: { ...(prev[id] ?? { priceAmount: '', salePrice: '' }), priceAmount: v },
                              }));
                              markDirty();
                            }}
                            placeholder={pricePlaceholder}
                          />
                          <span className="text-xs text-gray-500 w-10">{m.currency}</span>
                        </div>
                        {(isFyndiq || isWoo) && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-500">{isFyndiq ? 'Originalpris' : 'Reapris'}</Label>
                            <Input
                              inputMode="decimal"
                              type="text"
                              className="w-[8ch] text-right"
                              value={po.salePrice}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChannelPriceOverrides((prev) => ({
                                  ...prev,
                                  [id]: { ...(prev[id] ?? { priceAmount: '', salePrice: '' }), salePrice: v },
                                }));
                                markDirty();
                              }}
                              placeholder="—"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Kategorier — per-channel dropdowns from CDON, Fyndiq, WooCommerce APIs */}
        {!isBatchMode && activeTab === 'kategori' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Kategorier</Heading>
            <p className="text-sm text-gray-600 mb-4">
              Välj kategori per kanal. Listorna hämtas från CDON, Fyndiq respektive WooCommerce.
            </p>
            {categoryTabInstances.length > 0 && (
              <div className="space-y-3">
                {categoryTabInstances.map((inst) => {
                    const isWoo = String(inst.channel).toLowerCase() === 'woocommerce';
                    const rawCatVal = isWoo
                      ? formData.channelCategories?.woocommerce?.[inst.instanceKey]
                      : (inst.channel === 'cdon' ? formData.channelCategories?.cdon : formData.channelCategories?.fyndiq);
                    const label = inst.label;
                    const list = channelCategoriesList[inst.id] ?? [];
                    const loading = channelCategoriesLoading[inst.id];
                    const error = channelCategoriesError[inst.id];
                    const wooCats: string[] = isWoo
                      ? (Array.isArray(rawCatVal) ? rawCatVal : (rawCatVal ? [rawCatVal] : []))
                      : [];
                    const cat = !isWoo ? (typeof rawCatVal === 'string' ? rawCatVal : '') : '';
                    const wooTree = isWoo ? buildWooCategoryTree(list as Array<{ id: string; name: string; parent?: number }>) : [];
                    const expandedSet = wooExpandedIds[inst.id] ?? new Set<string>();
                    const setExpanded = (id: string, open: boolean) => {
                      setWooExpandedIds((prev) => {
                        const next = new Set(prev[inst.id] ?? []);
                        if (open) next.add(id);
                        else next.delete(id);
                        return { ...prev, [inst.id]: next };
                      });
                    };
                    const channelTree = isWoo ? [] : (String(inst.channel).toLowerCase() === 'fyndiq' ? buildFyndiqCategoryTree(list) : buildChannelCategoryTree(list));
                    const channelRealIds = !isWoo ? new Set(list.map((x) => x.id)) : new Set<string>();
                    const channelExpandedSet = channelCategoryExpandedIds[inst.id] ?? new Set<string>();
                    const setChannelExpanded = (id: string, open: boolean) => {
                      setChannelCategoryExpandedIds((prev) => {
                        const next = new Set(prev[inst.id] ?? []);
                        if (open) next.add(id);
                        else next.delete(id);
                        return { ...prev, [inst.id]: next };
                      });
                    };
                    const setChannelCategory = (categoryId: string) => {
                      if (inst.channel === 'cdon') {
                        setFormData((prev) => ({ ...prev, channelCategories: { ...prev.channelCategories, cdon: categoryId } }));
                      } else if (inst.channel === 'fyndiq') {
                        setFormData((prev) => ({ ...prev, channelCategories: { ...prev.channelCategories, fyndiq: categoryId } }));
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          channelCategories: {
                            ...prev.channelCategories,
                            woocommerce: {
                              ...(prev.channelCategories?.woocommerce ?? {}),
                              [inst.instanceKey]: [categoryId],
                            },
                          },
                        }));
                      }
                      markDirty();
                    };
                    const addWooCategory = (id: string) => {
                      if (wooCats.includes(id)) return;
                      setFormData((prev) => ({
                        ...prev,
                        channelCategories: {
                          ...prev.channelCategories,
                          woocommerce: {
                            ...(prev.channelCategories?.woocommerce ?? {}),
                            [inst.instanceKey]: [...wooCats, id],
                          },
                        },
                      }));
                      markDirty();
                    };
                    const removeWooCategory = (id: string) => {
                      setFormData((prev) => ({
                        ...prev,
                        channelCategories: {
                          ...prev.channelCategories,
                          woocommerce: {
                            ...(prev.channelCategories?.woocommerce ?? {}),
                            [inst.instanceKey]: wooCats.filter((c) => c !== id),
                          },
                        },
                      }));
                      markDirty();
                    };
                    return (
                      <div key={inst.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                        <span className="text-sm font-medium w-40 shrink-0 pt-1.5">{label}</span>
                        <div className="flex-1 min-w-0">
                          {loading && (
                            <p className="text-sm text-gray-500 py-2">Laddar kategorier…</p>
                          )}
                          {error && !loading && (
                            <p className="text-sm text-amber-600 py-1">{error}</p>
                          )}
                          {!loading && list.length > 0 && isWoo && (
                            <Collapsible
                              open={wooPanelOpen[inst.id] ?? false}
                              onOpenChange={(open) => setWooPanelOpen((prev) => ({ ...prev, [inst.id]: open }))}
                            >
                              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm border border-gray-200 rounded-md px-3 py-2 bg-gray-50/50 hover:bg-gray-100 min-h-0">
                                {(wooPanelOpen[inst.id] ?? false) ? (
                                  <ChevronDown className="w-4 h-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 shrink-0" />
                                )}
                                {wooCats.length > 0 ? (
                                  <span className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                    {wooCats.map((id) => (
                                      <span
                                        key={id}
                                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {list.find((x) => x.id === id)?.name ?? id}
                                        <button
                                          type="button"
                                          className="rounded hover:bg-gray-200 p-0.5"
                                          onClick={(e) => { e.stopPropagation(); removeWooCategory(id); }}
                                          aria-label="Ta bort kategori"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">Välj kategori</span>
                                )}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 border border-gray-200 rounded-md max-h-64 overflow-y-auto bg-gray-50/50">
                                  {wooTree.length === 0 ? (
                                    <p className="text-sm text-gray-500 px-2 py-2">Inga kategorier</p>
                                  ) : (
                                    <>
                                      <div className="sticky top-0 z-10 p-2 bg-gray-50/50 border-b border-gray-200">
                                        <Input
                                          type="search"
                                          placeholder="Sök kategori..."
                                          className="h-8 text-sm"
                                          value={categorySearch[inst.id] ?? ''}
                                          onChange={(e) =>
                                            setCategorySearch((prev) => ({ ...prev, [inst.id]: e.target.value }))
                                          }
                                        />
                                      </div>
                                      {(categorySearch[inst.id] ?? '').trim() !== '' ? (
                                        <WooCategorySearchList
                                          list={list as Array<{ id: string; name: string; parent?: number }>}
                                          searchQuery={categorySearch[inst.id] ?? ''}
                                          wooCats={wooCats}
                                          addWooCategory={addWooCategory}
                                          removeWooCategory={removeWooCategory}
                                        />
                                      ) : (
                                        <ul className="py-1">
                                          {wooTree.map((node) => (
                                            <CategoryTreeRow
                                              key={node.id}
                                              node={node}
                                              selectedId=""
                                              selectedIds={new Set(wooCats)}
                                              expandedIds={expandedSet}
                                              onToggleExpand={setExpanded}
                                              onSelect={addWooCategory}
                                              onToggle={(id, checked) => (checked ? addWooCategory(id) : removeWooCategory(id))}
                                              depth={0}
                                            />
                                          ))}
                                        </ul>
                                      )}
                                    </>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          {!loading && list.length > 0 && !isWoo && (
                            <Collapsible
                              open={channelCategoryPanelOpen[inst.id] ?? false}
                              onOpenChange={(open) => setChannelCategoryPanelOpen((prev) => ({ ...prev, [inst.id]: open }))}
                            >
                              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm border border-gray-200 rounded-md px-3 py-2 bg-gray-50/50 hover:bg-gray-100 min-h-0">
                                {(channelCategoryPanelOpen[inst.id] ?? false) ? (
                                  <ChevronDown className="w-4 h-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 shrink-0" />
                                )}
                                <span className={`flex-1 min-w-0 truncate ${!cat ? 'text-gray-500' : ''}`}>
                                  {cat
                                    ? (() => {
                                        const item = list.find((x) => x.id === cat);
                                        const name = item?.name ?? cat;
                                        const isFyndiq = String(inst.channel).toLowerCase() === 'fyndiq';
                                        const fullOrder = isFyndiq ? (item?.path ?? '') : cat;
                                        return `${name} (${fullOrder})`;
                                      })()
                                    : 'Välj kategori'}
                                </span>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 border border-gray-200 rounded-md max-h-64 overflow-y-auto bg-gray-50/50">
                                  <div className="sticky top-0 z-10 p-2 bg-gray-50/50 border-b border-gray-200">
                                    <Input
                                      type="search"
                                      placeholder="Sök kategori..."
                                      className="h-8 text-sm"
                                      value={categorySearch[inst.id] ?? ''}
                                      onChange={(e) =>
                                        setCategorySearch((prev) => ({ ...prev, [inst.id]: e.target.value }))
                                      }
                                    />
                                  </div>
                                  {(categorySearch[inst.id] ?? '').trim() !== '' ? (
                                    <ChannelCategorySearchList
                                      list={list}
                                      isFyndiq={String(inst.channel).toLowerCase() === 'fyndiq'}
                                      searchQuery={categorySearch[inst.id] ?? ''}
                                      validIds={channelRealIds}
                                      selectedId={cat}
                                      setChannelCategory={setChannelCategory}
                                    />
                                  ) : (
                                    <ul className="py-1">
                                      {channelTree.map((node) => (
                                        <CategoryTreeRow
                                          key={node.id}
                                          node={node as CategoryTreeNode}
                                          selectedId={cat}
                                          expandedIds={channelExpandedSet}
                                          onToggleExpand={setChannelExpanded}
                                          onSelect={(id) => {
                                            if (id && channelRealIds.has(id)) setChannelCategory(id);
                                          }}
                                          depth={0}
                                          channelListStyle
                                        />
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          {!loading && list.length === 0 && !error && (
                            <p className="text-sm text-gray-500 py-1">Inga kategorier tillgängliga.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Detaljer */}
        {!isBatchMode && activeTab === 'detaljer' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Detaljer</Heading>
            <p className="text-sm text-gray-600 mb-4">EAN, Märke, Tillverkarens artikelnummer m.m. Märke är obligatorisk.</p>
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <Label htmlFor="ean" className="mb-1">EAN</Label>
                <Input
                  id="ean"
                  type="text"
                  inputMode="numeric"
                  value={formData.ean}
                  onChange={(e) => updateField('ean', e.target.value)}
                  placeholder="8–14 siffror"
                  className={getFieldError('ean') ? 'border-yellow-500' : ''}
                />
                {getFieldError('ean') && <p className="mt-1 text-sm text-yellow-600">{getFieldError('ean')?.message}</p>}
              </div>
              <div>
                <Label htmlFor="gtin" className="mb-1">GTIN</Label>
                <Input
                  id="gtin"
                  type="text"
                  inputMode="numeric"
                  value={formData.gtin}
                  onChange={(e) => updateField('gtin', e.target.value)}
                  placeholder="Fylls i automatiskt av EAN om tomt (kan överridas, t.ex. 12 siffror)"
                  className={getFieldError('gtin') ? 'border-yellow-500' : ''}
                />
                {getFieldError('gtin') && <p className="mt-1 text-sm text-yellow-600">{getFieldError('gtin')?.message}</p>}
              </div>
              <div>
                <Label htmlFor="brand" className="mb-1">Märke *</Label>
                <div className="flex gap-2">
                  <NativeSelect
                    id="brand"
                    value={formData.brandId || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const item = brands.find((b) => b.id === v);
                      setFormData((prev) => ({ ...prev, brandId: v || '', brand: item?.name ?? '' }));
                      markDirty();
                      clearValidationErrors();
                    }}
                    className={`flex-1 ${getFieldError('brand') ? 'border-red-500' : ''}`}
                  >
                    <option value="">— Välj märke —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt('Nytt märke:');
                      if (!name?.trim()) return;
                      try {
                        const item = await productsApi.createBrand(name.trim());
                        setBrands((prev) => [...prev.filter((p) => p.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name)));
                        setFormData((prev) => ({ ...prev, brandId: item.id, brand: item.name }));
                        clearValidationErrors();
                        markDirty();
                      } catch (_) {
                        window.alert('Kunde inte skapa märke.');
                      }
                    }}
                  >
                    Skapa ny
                  </Button>
                </div>
                {getFieldError('brand') && <p className="mt-1 text-sm text-red-600">{getFieldError('brand')?.message}</p>}
              </div>
              <div>
                <Label htmlFor="supplier" className="mb-1">Leverantör</Label>
                <div className="flex gap-2">
                  <NativeSelect
                    id="supplier"
                    value={formData.supplierId || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const item = suppliers.find((s) => s.id === v);
                      setFormData((prev) => ({ ...prev, supplierId: v || '' }));
                      markDirty();
                    }}
                    className="flex-1"
                  >
                    <option value="">— Välj leverantör —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt('Ny leverantör:');
                      if (!name?.trim()) return;
                      try {
                        const item = await productsApi.createSupplier(name.trim());
                        setSuppliers((prev) => [...prev.filter((p) => p.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name)));
                        setFormData((prev) => ({ ...prev, supplierId: item.id }));
                        markDirty();
                      } catch (_) {
                        window.alert('Kunde inte skapa leverantör.');
                      }
                    }}
                  >
                    Skapa ny
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="manufacturer" className="mb-1">Tillverkare</Label>
                <div className="flex gap-2">
                  <NativeSelect
                    id="manufacturer"
                    value={formData.manufacturerId || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData((prev) => ({ ...prev, manufacturerId: v || '' }));
                      markDirty();
                    }}
                    className="flex-1"
                  >
                    <option value="">— Välj tillverkare —</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt('Ny tillverkare:');
                      if (!name?.trim()) return;
                      try {
                        const item = await productsApi.createManufacturer(name.trim());
                        setManufacturers((prev) => [...prev.filter((p) => p.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name)));
                        setFormData((prev) => ({ ...prev, manufacturerId: item.id }));
                        markDirty();
                      } catch (_) {
                        window.alert('Kunde inte skapa tillverkare.');
                      }
                    }}
                  >
                    Skapa ny
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="mpn" className="mb-1">Tillverkarens artikelnummer (MPN)</Label>
                <Input id="mpn" type="text" value={formData.mpn} onChange={(e) => updateField('mpn', e.target.value)} placeholder="Fylls i automatiskt från SKU om tomt" />
              </div>
              <div>
                <Label htmlFor="color" className="mb-1">Färg</Label>
                <Input id="color" type="text" value={formData.color} onChange={(e) => updateField('color', e.target.value)} placeholder="T.ex. Svart" />
              </div>
              <div>
                <Label htmlFor="colorText" className="mb-1">Färgtext</Label>
                <Input id="colorText" type="text" value={formData.colorText} onChange={(e) => updateField('colorText', e.target.value)} placeholder="Fri text för färg" />
              </div>
              <div>
                <Label htmlFor="size" className="mb-1">Storlek</Label>
                <NativeSelect
                  id="size"
                  value={formData.size || ''}
                  onChange={(e) => updateField('size', e.target.value)}
                >
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="sizeText" className="mb-1">Storlekstext</Label>
                <Input id="sizeText" type="text" value={formData.sizeText} onChange={(e) => updateField('sizeText', e.target.value)} placeholder="Fri text för storlek" />
              </div>
              <div>
                <Label htmlFor="pattern" className="mb-1">Fyndiq-mönster</Label>
                <NativeSelect
                  id="pattern"
                  value={formData.pattern || ''}
                  onChange={(e) => updateField('pattern', e.target.value)}
                >
                  {PATTERN_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="weight" className="mb-1">Vikt (kg)</Label>
                <Input id="weight" type="number" step="any" min="0" value={formData.weight === '' ? '' : formData.weight} onChange={(e) => updateField('weight', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="lengthCm" className="mb-1">Längd (cm)</Label>
                <Input id="lengthCm" type="number" step="any" min="0" value={formData.lengthCm === '' ? '' : formData.lengthCm} onChange={(e) => updateField('lengthCm', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="widthCm" className="mb-1">Bredd (cm)</Label>
                <Input id="widthCm" type="number" step="any" min="0" value={formData.widthCm === '' ? '' : formData.widthCm} onChange={(e) => updateField('widthCm', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="heightCm" className="mb-1">Höjd (cm)</Label>
                <Input id="heightCm" type="number" step="any" min="0" value={formData.heightCm === '' ? '' : formData.heightCm} onChange={(e) => updateField('heightCm', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="depthCm" className="mb-1">Djup (cm)</Label>
                <Input id="depthCm" type="number" step="any" min="0" value={formData.depthCm === '' ? '' : formData.depthCm} onChange={(e) => updateField('depthCm', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Statistik */}
        {!isBatchMode && activeTab === 'statistik' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">Statistik</Heading>
            {!currentProduct?.id ? (
              <p className="text-sm text-gray-500">Spara produkten först för att se statistik.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-600">Period:</span>
                  <NativeSelect value={statsRange} onChange={(e) => setStatsRange((e.target.value || '30d') as '7d' | '30d' | '3m' | 'all')}>
                    <option value="7d">7 dagar</option>
                    <option value="30d">30 dagar</option>
                    <option value="3m">3 månader</option>
                    <option value="all">Sen start</option>
                  </NativeSelect>
                </div>
                {statsLoading ? (
                  <p className="text-sm text-gray-500">Laddar…</p>
                ) : stats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-gray-50">
                        <div className="text-xs text-gray-500">Antal sålda</div>
                        <div className="text-lg font-semibold">{stats.soldCount}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50">
                        <div className="text-xs text-gray-500">Bästa kanal</div>
                        <div className="text-lg font-semibold">{stats.bestChannel || '—'}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50">
                        <div className="text-xs text-gray-500">Aktiva kanaler</div>
                        <div className="text-lg font-semibold">{stats.activeTargetsCount}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Aktivitetstidslinje</div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {stats.timeline?.length ? (
                          stats.timeline.map((ev, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                              <span>
                                <strong>{ev.quantity} st såld</strong> på {ev.channel}, order {String(ev.orderId).slice(0, 8)}…
                              </span>
                              <span className="text-gray-500 text-xs">
                                {ev.placedAt ? new Date(ev.placedAt).toLocaleString('sv-SE') : '—'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">Ingen aktivitet i vald period.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Kunde inte ladda statistik.</p>
                )}
              </>
            )}
          </Card>
        )}
      </form>
    </div>
  );
};
