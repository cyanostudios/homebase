/* eslint-disable eqeqeq, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react/no-array-index-key */
import { ChevronDown, ChevronRight, Plus, Star, Trash2, Upload } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getFxLatest } from '@/core/api/fxApi';
import { RichTextEditor } from '@/core/ui/RichTextEditor';
import { Heading } from '@/core/ui/Typography';
import { decodeHtmlEntities } from '@/core/utils/decodeHtmlEntities';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import type { ChannelInstance } from '@/plugins/channels/types/channels';

import { productsApi } from '../api/productsApi';
import { useProducts } from '../hooks/useProducts';
import {
  getProductImageOriginalFilename,
  getProductImageOriginalUrl,
  getProductImagePreviewUrl,
  normalizeProductImageAsset,
  normalizeProductImages,
  normalizeProductStatus,
  type ProductImageAsset,
  type ProductSaveChangeSet,
  type ProductStatus,
  type ProductSyncChannel,
} from '../types/products';

const MARKETS = [
  { key: 'se' as const, label: 'Sverige', currency: 'SEK', lang: 'sv-SE' },
  { key: 'dk' as const, label: 'Danmark', currency: 'DKK', lang: 'da-DK' },
  { key: 'fi' as const, label: 'Finland', currency: 'EUR', lang: 'fi-FI' },
  { key: 'no' as const, label: 'Norge', currency: 'NOK', lang: 'nb-NO' },
];

type MarketKeyFromConst = (typeof MARKETS)[number]['key'];

/** Nested cdon.markets / fyndiq.markets: Sello import uses active + optional shipping; never price (pricing = products.price_amount + channel_product_overrides). */
const LEGACY_NESTED_MARKET_FIELD_KEYS = new Set(['price', 'currency', 'vatRate', 'deliveryType']);

function buildPersistedMarketsForChannel(
  formMarkets: Record<MarketKeyFromConst, { shippingMin: number | ''; shippingMax: number | '' }>,
  existingMarkets: Record<string, unknown> | undefined,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const { key } of MARKETS) {
    const rawPrev = existingMarkets?.[key];
    const prev: Record<string, unknown> =
      rawPrev && typeof rawPrev === 'object' && !Array.isArray(rawPrev)
        ? { ...(rawPrev as Record<string, unknown>) }
        : {};
    for (const k of LEGACY_NESTED_MARKET_FIELD_KEYS) {
      delete prev[k];
    }
    const smin = formMarkets[key].shippingMin;
    const smax = formMarkets[key].shippingMax;
    if (smin === '' || !Number.isFinite(Number(smin))) {
      delete prev.shippingMin;
    } else {
      prev.shippingMin = Number(smin);
    }
    if (smax === '' || !Number.isFinite(Number(smax))) {
      delete prev.shippingMax;
    } else {
      prev.shippingMax = Number(smax);
    }
    out[key] = prev;
  }
  return out;
}

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

/** Skick: CDON Condition (New / Used / Refurbed) */
const CONDITION_OPTIONS = [
  { value: 'new', label: 'Ny' },
  { value: 'used', label: 'Used' },
  { value: 'refurb', label: 'Refurbed' },
];

/** CDON shipped_from: varifrån produkten skickas */
const SHIPPED_FROM_OPTIONS = [
  { value: 'EU', label: 'EU' },
  { value: 'NON_EU', label: 'Ej EU' },
];

function buildExternalImageAsset(url: string, position: number): ProductImageAsset {
  return (
    normalizeProductImageAsset(url, position) ?? {
      assetId: null,
      position,
      originalFilename: null,
      sourceUrl: null,
      hash: null,
      mimeType: null,
      size: null,
      width: null,
      height: null,
      variants: {
        original: { key: null, url, mimeType: null, size: null, width: null, height: null },
        preview: { key: null, url, mimeType: null, size: null, width: null, height: null },
        thumbnail: { key: null, url, mimeType: null, size: null, width: null, height: null },
      },
      legacy: true,
    }
  );
}

function orderAssetsByMainImage(
  assets: ProductImageAsset[],
  mainImage: string,
): ProductImageAsset[] {
  const normalized = normalizeProductImages(assets);
  if (!mainImage) {
    return normalized.map((asset, position) => ({ ...asset, position }));
  }
  const idx = normalized.findIndex((asset) => getProductImageOriginalUrl(asset) === mainImage);
  if (idx <= 0) {
    return normalized.map((asset, position) => ({ ...asset, position }));
  }
  const picked = normalized[idx];
  const rest = normalized.slice();
  rest.splice(idx, 1);
  return [picked, ...rest].map((asset, position) => ({ ...asset, position }));
}

/** Volymenhet: Sello volume_unit (m3, dm3, cm3, l, ml) */
const VOLUME_UNIT_OPTIONS = [
  { value: '', label: '— Välj enhet —' },
  { value: 'm3', label: 'm³' },
  { value: 'dm3', label: 'dm³' },
  { value: 'cm3', label: 'cm³' },
  { value: 'l', label: 'l' },
  { value: 'ml', label: 'ml' },
];

/** Viktenhet: g (gram) eller kg. WooCommerce får alltid kg. */
const WEIGHT_UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
];

/** CDON/Fyndiq preset-färg (färg dropdown) */
const COLOR_OPTIONS = [
  { value: '', label: '— Välj färg —' },
  { value: 'red', label: 'Röd' },
  { value: 'blue', label: 'Blå' },
  { value: 'green', label: 'Grön' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Gul' },
  { value: 'purple', label: 'Lila' },
  { value: 'pink', label: 'Rosa' },
  { value: 'gold', label: 'Guld' },
  { value: 'silver', label: 'Silver' },
  { value: 'multicolor', label: 'Multifärgad' },
  { value: 'white', label: 'Vit' },
  { value: 'gray', label: 'Grå' },
  { value: 'black', label: 'Svart' },
  { value: 'turquoise', label: 'Turkos' },
  { value: 'brown', label: 'Brun' },
  { value: 'beige', label: 'Beige' },
  { value: 'transparent', label: 'Transparent' },
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
  if (!flat.length) {
    return [];
  }
  const byParent = new Map<number, Array<{ id: string; name: string; parent?: number }>>();
  for (const x of flat) {
    const p = x.parent ?? 0;
    if (!byParent.has(p)) {
      byParent.set(p, []);
    }
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
  if (!q) {
    return items;
  }
  return items.filter(
    (item) => item.pathLabel.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
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
                onCheckedChange={(checked) =>
                  checked ? addWooCategory(item.id) : removeWooCategory(item.id)
                }
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
  if (!list.length) {
    return [];
  }
  const byId = new Map<string, ChannelCategoryNode>();

  function parentId(id: string): string {
    return id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : '';
  }
  function lastSegment(id: string): string {
    return id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id;
  }
  function isWeakName(name: string, forId: string): boolean {
    if (!name || /^\d+$/.test(name)) {
      return true;
    }
    return name.trim() === lastSegment(forId);
  }
  function ensureParent(pid: string): void {
    if (!pid) {
      return;
    }
    if (byId.has(pid)) {
      return;
    }
    ensureParent(parentId(pid));
    const node: ChannelCategoryNode = { id: pid, name: lastSegment(pid), children: [] };
    byId.set(pid, node);
  }

  // Step 1: create all nodes (placeholders for missing parents, real from list); better name wins
  for (const item of list) {
    ensureParent(parentId(item.id));
    const existing = byId.get(item.id);
    if (existing) {
      if (isWeakName(existing.name, item.id) && !isWeakName(item.name, item.id)) {
        existing.name = item.name;
      }
    } else {
      byId.set(item.id, { id: item.id, name: item.name, children: [] });
    }
  }

  // Step 2: attach children to parents, build roots
  const roots: ChannelCategoryNode[] = [];
  for (const node of byId.values()) {
    const pid = parentId(node.id);
    if (pid) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
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
  if (!list.length) {
    return [];
  }
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

  if (
    process.env.NODE_ENV === 'development' &&
    (skippedMissingPath.length > 0 || skippedLeafMismatch.length > 0)
  ) {
    const totalSkipped = skippedMissingPath.length + skippedLeafMismatch.length;
    console.warn(
      '[buildFyndiqCategoryTree] Skipped items:',
      totalSkipped,
      'missing path:',
      skippedMissingPath.length,
      'leafId mismatch:',
      skippedLeafMismatch.length,
    );
    const pathExamples = skippedLeafMismatch.slice(0, 5);
    if (pathExamples.length) {
      console.warn(
        '[buildFyndiqCategoryTree] Example paths skipped (leafId !== item.id):',
        pathExamples,
      );
    }
    const missingPathExamples = skippedMissingPath.slice(0, 5);
    if (missingPathExamples.length) {
      console.warn(
        '[buildFyndiqCategoryTree] Example items skipped (missing path):',
        missingPathExamples,
      );
    }
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
        console.warn('[buildFyndiqCategoryTree] Parent not in list, node at root', {
          nodeId: node.id,
          parentId: pid,
        });
      }
    }
  }

  if (process.env.NODE_ENV === 'development' && missingParentIds.size > 0) {
    const examples = Array.from(missingParentIds).slice(0, 5);
    console.warn(
      '[buildFyndiqCategoryTree] Missing parent ids (count):',
      missingParentIds.size,
      'examples:',
      examples,
    );
  }

  function maxDepth(nodes: ChannelCategoryNode[], d: number): number {
    if (nodes.length === 0) {
      return d;
    }
    return Math.max(d, ...nodes.map((n) => maxDepth(n.children, d + 1)));
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn('[buildFyndiqCategoryTree] roots:', roots.length, 'maxDepth:', maxDepth(roots, 0));
  }

  function sortByNameThenId(nodes: ChannelCategoryNode[]): void {
    nodes.sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (byName !== 0) {
        return byName;
      }
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
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
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

/** Kanaler: leveranstid + leveranstyp per land. Pris/valuta/moms = Baspris + Priser (overrides), aldrig här. */
type MarketData = {
  shippingMin: number | '';
  shippingMax: number | '';
  deliveryType: DeliveryTypeValue;
};

type TextData = {
  title: string;
  description: string;
  /** SEO title, meta description, meta keywords, bulletpoints (one per line in UI) */
  titleSeo?: string;
  metaDesc?: string;
  metaKeywords?: string;
  bulletpoints?: string;
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
      changeSet?: ProductSaveChangeSet;
      ignorePriceWarning?: boolean;
      channelTargets?: Array<{ channel: string; channelInstanceId: number | null }>;
      channelTargetsWithMarket?: Array<{
        channel: string;
        channelInstanceId: number | null;
        market: string;
      }>;
      channelOverridesToSave?: Array<{
        channelInstanceId: number | string;
        active?: boolean;
        category?: string | null;
        priceAmount?: number | null;
      }>;
    },
  ) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

type FormData = {
  title: string;
  status: ProductStatus;
  quantity: number | '';
  priceAmount: number | '';
  purchasePrice: number | '';
  currency: string;
  vatRate: number | '';
  sku: string;
  privateName: string;
  mpn: string;
  description: string;
  mainImage: string;
  images: ProductImageAsset[];
  categories: string[];
  brand: string;
  brandId: string;
  ean: string;
  gtin: string;
  knNumber: string;
  supplierId: string;
  manufacturerId: string;
  /** Produkt-fliken: lagerplats (frivillig) */
  lagerplats: string;
  /** Produkt-fliken: restnotering för WooCommerce (no | yes | notify) */
  wooBackorders: 'no' | 'yes' | 'notify';
  /** Detaljer: färg, storlek, mönster, vikt, mått, skick, volym, anteckningar */
  color: string;
  colorText: string;
  size: string;
  sizeText: string;
  pattern: string;
  material: string;
  patternText: string;
  model: string;
  weight: number | '';
  weightUnit: 'g' | 'kg';
  shoeSizeEu: string;
  condition: 'new' | 'used' | 'refurb';
  /** CDON shipped_from (default EU) */
  shippedFrom: 'EU' | 'NON_EU';
  /** CDON availability_dates per market (YYYY-MM-DD) */
  availabilityDates: Record<MarketKey, string>;
  groupId: string;
  volume: number | '';
  volumeUnit: string;
  notes: string;
  lengthCm: number | '';
  widthCm: number | '';
  heightCm: number | '';
  depthCm: number | '';
  /** Produkt-fliken: lista ('' = Huvudlista, annars list id) */
  listId: string;
  /** Per SE/DK/FI/NO: leveranstid + leveranstyp (kanalpayload använder shipping_time + delivery_type). */
  markets: Record<MarketKey, MarketData>;
  /** Per-market language: title, description (SE/DK/FI/NO) */
  texts: Record<MarketKey, TextData>;
  /** Which market's text to use as fallback when a market has no own text (for CDON/Fyndiq) */
  standardTextMarket: MarketKey;
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
    validateProductForm,
    batchProductIds,
    batchUpdateProducts,
    closeProductPanel,
    productSettings,
    getChannelDataCache,
    setChannelDataCache,
    getChannelCategories,
    setProductFormSaving,
  } = useProducts();
  const { isDirty, markDirty, markClean } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;
  const currentProduct = currentItem;
  const isBatchMode = batchProductIds.length > 0;

  const getDefaultDelivery = (market: MarketKey) =>
    productSettings?.defaultDeliveryCdon?.[market.toUpperCase() as 'SE' | 'DK' | 'NO' | 'FI'] ??
    productSettings?.defaultDeliveryFyndiq?.[market as 'se' | 'dk' | 'fi' | 'no'] ??
    productSettings?.defaultDelivery?.[market];
  const createEmptyMarket = (market: MarketKey, opts?: { forBatch?: boolean }): MarketData => {
    const dd = getDefaultDelivery(market);
    const forBatch = Boolean(opts?.forBatch);
    return {
      shippingMin: forBatch ? '' : (dd?.shippingMin ?? 1),
      shippingMax: forBatch ? '' : (dd?.shippingMax ?? 3),
      deliveryType: '',
    };
  };

  const createEmptyText = (): TextData => ({
    title: '',
    description: '',
    titleSeo: '',
    metaDesc: '',
    metaKeywords: '',
    bulletpoints: '',
  });

  const initialState: FormData = {
    title: '',
    status: 'for sale',
    quantity: 0,
    priceAmount: 0,
    purchasePrice: '',
    privateName: '',
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
    knNumber: '',
    supplierId: '',
    manufacturerId: '',
    lagerplats: '',
    wooBackorders: 'no',
    condition: 'new',
    shippedFrom: 'EU',
    availabilityDates: { se: '', dk: '', fi: '', no: '' },
    groupId: '',
    volume: '',
    volumeUnit: '',
    notes: '',
    color: '',
    colorText: '',
    size: '',
    sizeText: '',
    pattern: '',
    material: '',
    patternText: '',
    model: '',
    weight: '',
    weightUnit: 'g',
    shoeSizeEu: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    depthCm: '',
    listId: '',
    markets: {
      se: createEmptyMarket('se'),
      dk: createEmptyMarket('dk'),
      fi: createEmptyMarket('fi'),
      no: createEmptyMarket('no'),
    },
    texts: {
      se: createEmptyText(),
      dk: createEmptyText(),
      fi: createEmptyText(),
      no: createEmptyText(),
    },
    standardTextMarket: 'se',
    channelCategories: {},
  };

  const batchInitialState: FormData = {
    ...initialState,
    quantity: '',
    markets: {
      se: createEmptyMarket('se', { forBatch: true }),
      dk: createEmptyMarket('dk', { forBatch: true }),
      fi: createEmptyMarket('fi', { forBatch: true }),
      no: createEmptyMarket('no', { forBatch: true }),
    },
  };

  const PRODUCT_INTERNAL_ONLY_KEYS: Array<keyof FormData> = [
    'purchasePrice',
    'privateName',
    'supplierId',
    'manufacturerId',
    'lagerplats',
    'notes',
    'brandId',
  ];
  const PRODUCT_STRICT_KEYS: Array<keyof FormData> = [
    'quantity',
    'priceAmount',
    'currency',
    'vatRate',
  ];
  const PRODUCT_FULL_ALL_KEYS: Array<keyof FormData> = [
    'status',
    'sku',
    'mpn',
    'title',
    'description',
    'mainImage',
    'images',
    'categories',
    'brand',
    'ean',
    'gtin',
    'knNumber',
    'color',
    'colorText',
    'size',
    'sizeText',
    'pattern',
    'material',
    'patternText',
    'model',
    'weight',
    'weightUnit',
    'shoeSizeEu',
    'condition',
    'groupId',
    'volume',
    'volumeUnit',
    'lengthCm',
    'widthCm',
    'heightCm',
    'depthCm',
  ];

  const stableStringify = (value: unknown): string => {
    const normalize = (input: unknown): unknown => {
      if (Array.isArray(input)) {
        return input.map((item) => normalize(item));
      }
      if (input && typeof input === 'object') {
        return Object.keys(input as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = normalize((input as Record<string, unknown>)[key]);
            return acc;
          }, {});
      }
      return input ?? null;
    };

    return JSON.stringify(normalize(value));
  };

  /** Dirty-only keys accepted by server `buildBatchPatchColumns` (batch job). Empty string = no column update. */
  const collectBatchPatchChanges = (init: FormData, fd: FormData): Record<string, unknown> => {
    const changes: Record<string, unknown> = {};
    const optNum = (v: number | '') => (v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

    if (fd.status !== init.status) {
      changes.status = fd.status;
    }

    const titleI = (init.title || '').trim();
    const titleF = (fd.title || '').trim();
    if (titleF !== titleI && titleF) {
      changes.title = titleF;
    }

    const descI = (init.description || '').trim();
    const descF = (fd.description || '').trim();
    if (descF !== descI && descF) {
      changes.description = descF;
    }

    const p0 = optNum(init.priceAmount);
    const p1 = optNum(fd.priceAmount);
    if (p1 !== null && p1 !== p0) {
      changes.priceAmount = p1;
    }
    const q0 = optNum(init.quantity);
    const q1 = optNum(fd.quantity);
    if (q1 !== null && q1 !== q0) {
      changes.quantity = Math.max(0, Math.trunc(q1));
    }
    const v0 = optNum(init.vatRate);
    const v1 = optNum(fd.vatRate);
    if (v1 !== null && v1 !== v0) {
      changes.vatRate = v1;
    }

    const c0 = (init.currency || '').trim().toUpperCase();
    const c1 = (fd.currency || '').trim().toUpperCase();
    if (c1 && c1 !== c0) {
      changes.currency = c1;
    }

    const miI = (init.mainImage || '').trim();
    const miF = (fd.mainImage || '').trim();
    if (miF !== miI && miF) {
      changes.mainImage = miF;
    }

    if (stableStringify(fd.images) !== stableStringify(init.images)) {
      changes.images = [...fd.images];
    }
    if (stableStringify(fd.categories) !== stableStringify(init.categories)) {
      changes.categories = [...fd.categories];
    }

    const bumpOptTrim = (patchKey: string, i: string, f: string, maxLen?: number) => {
      if (f === i) {
        return;
      }
      if (!f) {
        return;
      }
      changes[patchKey] = maxLen != null ? f.slice(0, maxLen) : f;
    };

    bumpOptTrim('brand', (init.brand || '').trim(), (fd.brand || '').trim());
    bumpOptTrim('mpn', (init.mpn || '').trim(), (fd.mpn || '').trim());
    bumpOptTrim('ean', (init.ean || '').trim(), (fd.ean || '').trim());
    bumpOptTrim('gtin', (init.gtin || '').trim(), (fd.gtin || '').trim());
    bumpOptTrim('knNumber', (init.knNumber || '').trim(), (fd.knNumber || '').trim());
    bumpOptTrim('lagerplats', (init.lagerplats || '').trim(), (fd.lagerplats || '').trim(), 100);
    bumpOptTrim('groupId', (init.groupId || '').trim(), (fd.groupId || '').trim(), 100);
    bumpOptTrim('volumeUnit', (init.volumeUnit || '').trim(), (fd.volumeUnit || '').trim(), 20);
    bumpOptTrim('notes', (init.notes || '').trim(), (fd.notes || '').trim());
    bumpOptTrim('privateName', (init.privateName || '').trim(), (fd.privateName || '').trim());
    bumpOptTrim('color', (init.color || '').trim(), (fd.color || '').trim(), 100);
    bumpOptTrim('colorText', (init.colorText || '').trim(), (fd.colorText || '').trim(), 255);
    bumpOptTrim('size', (init.size || '').trim(), (fd.size || '').trim(), 50);
    bumpOptTrim('sizeText', (init.sizeText || '').trim(), (fd.sizeText || '').trim(), 255);
    bumpOptTrim('pattern', (init.pattern || '').trim(), (fd.pattern || '').trim(), 100);
    bumpOptTrim('material', (init.material || '').trim(), (fd.material || '').trim(), 255);
    bumpOptTrim('patternText', (init.patternText || '').trim(), (fd.patternText || '').trim(), 255);
    bumpOptTrim('model', (init.model || '').trim(), (fd.model || '').trim(), 255);

    const idStrField = (key: keyof FormData, outKey: string) => {
      const i = String(init[key] ?? '').trim();
      const f = String(fd[key] ?? '').trim();
      if (f === i) {
        return;
      }
      if (!f) {
        return;
      }
      const n = Number(f);
      if (Number.isFinite(n)) {
        changes[outKey] = n;
      }
    };
    idStrField('brandId', 'brandId');
    idStrField('supplierId', 'supplierId');
    idStrField('manufacturerId', 'manufacturerId');

    const pp0 = optNum(init.purchasePrice);
    const pp1 = optNum(fd.purchasePrice);
    if (pp1 !== null && pp1 !== pp0) {
      changes.purchasePrice = pp1;
    }

    if (fd.condition !== init.condition) {
      changes.condition = fd.condition;
    }

    const vol0 = optNum(init.volume);
    const vol1 = optNum(fd.volume);
    if (vol1 !== null && vol1 !== vol0) {
      changes.volume = vol1;
    }

    const w0 = optNum(init.weight);
    const w1 = optNum(fd.weight);
    if (w1 !== null && w1 !== w0) {
      changes.weight = w1;
    }
    for (const dim of ['lengthCm', 'widthCm', 'heightCm', 'depthCm'] as const) {
      const a = optNum(init[dim]);
      const b = optNum(fd[dim]);
      if (b !== null && b !== a) {
        changes[dim] = b;
      }
    }

    // Batch-edit supports shipping/delivery updates via Kanaler-tabben.
    // Those fields are edited in `fd.markets` but persisted in DB `channel_specific`,
    // so we must include ONLY the actually-changed subfields in `channelSpecific`.
    //
    // IMPORTANT: In batch we must not send "unrelated but filled" fields. If the user changes
    // delivery type only, we must not include shipping times (and vice versa).
    const toShipNumOrNull = (v: number | '' | null | undefined): number | null =>
      v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);

    const initShippingTime = MARKETS.map((m) => ({
      market: m.key.toUpperCase(),
      min: toShipNumOrNull(init.markets[m.key].shippingMin),
      max: toShipNumOrNull(init.markets[m.key].shippingMax),
    }));
    const fdShippingTime = MARKETS.map((m) => ({
      market: m.key.toUpperCase(),
      min: toShipNumOrNull(fd.markets[m.key].shippingMin),
      max: toShipNumOrNull(fd.markets[m.key].shippingMax),
    }));

    const initCdonDeliveryType = MARKETS.filter((m) => init.markets[m.key].deliveryType).map(
      (m) => ({
        market: m.key.toUpperCase(),
        value: init.markets[m.key].deliveryType,
      }),
    );
    const fdCdonDeliveryType = MARKETS.filter((m) => fd.markets[m.key].deliveryType).map((m) => ({
      market: m.key.toUpperCase(),
      value: fd.markets[m.key].deliveryType,
    }));

    const initFyndiqDeliveryType = MARKETS.filter((m) => {
      const dt = init.markets[m.key].deliveryType;
      return dt && dt !== 'home_delivery'; // Fyndiq: only mailbox, service_point
    }).map((m) => ({ market: m.key.toUpperCase(), value: init.markets[m.key].deliveryType }));
    const fdFyndiqDeliveryType = MARKETS.filter((m) => {
      const dt = fd.markets[m.key].deliveryType;
      return dt && dt !== 'home_delivery'; // Fyndiq: only mailbox, service_point
    }).map((m) => ({ market: m.key.toUpperCase(), value: fd.markets[m.key].deliveryType }));

    const csPatch: Record<string, any> = {};
    const cdonPatch: Record<string, unknown> = {};
    const fyndiqPatch: Record<string, unknown> = {};

    const shippingChanged = stableStringify(fdShippingTime) !== stableStringify(initShippingTime);
    const shippingComplete = fdShippingTime.every((x) => x.min != null && x.max != null);
    if (shippingChanged && shippingComplete) {
      cdonPatch.shipping_time = fdShippingTime as Array<{
        market: string;
        min: number;
        max: number;
      }>;
      fyndiqPatch.shipping_time = fdShippingTime as Array<{
        market: string;
        min: number;
        max: number;
      }>;
    }

    const cdonDeliveryChanged =
      stableStringify(fdCdonDeliveryType) !== stableStringify(initCdonDeliveryType);
    if (cdonDeliveryChanged) {
      cdonPatch.delivery_type = fdCdonDeliveryType;
    }

    const fyndiqDeliveryChanged =
      stableStringify(fdFyndiqDeliveryType) !== stableStringify(initFyndiqDeliveryType);
    if (fyndiqDeliveryChanged) {
      fyndiqPatch.delivery_type = fdFyndiqDeliveryType;
    }

    if (Object.keys(cdonPatch).length > 0) {
      csPatch.cdon = cdonPatch;
    }
    if (Object.keys(fyndiqPatch).length > 0) {
      csPatch.fyndiq = fyndiqPatch;
    }

    if (Object.keys(csPatch).length > 0) {
      changes.channelSpecific = csPatch;
    }

    return changes;
  };

  const pickSnapshot = (source: FormData, keys: Array<keyof FormData>) =>
    keys.reduce<Record<string, unknown>>((acc, key) => {
      acc[String(key)] = source[key] ?? null;
      return acc;
    }, {});

  const buildMarketArticleSnapshot = (source: FormData) => {
    const nOrNull = (v: number | '') =>
      v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
    return MARKETS.reduce<
      Record<
        string,
        { shippingMin: number | null; shippingMax: number | null; deliveryType: string }
      >
    >((acc, market) => {
      acc[market.key] = {
        shippingMin: nOrNull(source.markets[market.key].shippingMin),
        shippingMax: nOrNull(source.markets[market.key].shippingMax),
        deliveryType: String(source.markets[market.key].deliveryType ?? ''),
      };
      return acc;
    }, {});
  };

  const toComparableOverrideValue = (value: string | number | null | undefined): string | null => {
    if (value == null) {
      return null;
    }
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) {
      return null;
    }
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && numeric >= 0 ? String(numeric) : null;
  };

  const initialFormStateRef = useRef<FormData>(
    JSON.parse(JSON.stringify(initialState)) as FormData,
  );
  const initialSelectedTargetKeysRef = useRef<Set<string>>(new Set());
  const initialChannelPriceOverridesRef = useRef<
    Record<string, { priceAmount: string; salePrice: string }>
  >({});

  const [formData, setFormData] = useState<FormData>(initialState);
  const [activeTab, setActiveTab] = useState<
    'kanaler' | 'produkt' | 'texter' | 'media' | 'priser' | 'kategori' | 'detaljer' | 'statistik'
  >('kanaler');
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false);
  const [batchPreviewLines, setBatchPreviewLines] = useState<string[]>([]);
  const [batchPendingChanges, setBatchPendingChanges] = useState<Record<string, unknown> | null>(
    null,
  );
  const [saveNotice, setSaveNotice] = useState('');
  // If true: MPN mirrors SKU automatically (until user overrides MPN)
  const [isMpnAuto, setIsMpnAuto] = useState(true);
  const [isGtinAuto, setIsGtinAuto] = useState(true);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [manufacturers, setManufacturers] = useState<Array<{ id: string; name: string }>>([]);
  const [newImage, setNewImage] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [statsRange, setStatsRange] = useState<'7d' | '30d' | '3m' | 'all'>('30d');
  const [selectedTextMarket, setSelectedTextMarket] = useState<MarketKey>('se');
  const [stats, setStats] = useState<{
    soldCount: number;
    bestChannel: string | null;
    activeTargetsCount: number;
    timeline: any[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  // Kanaler tab: instances + targets + overrides (enabled only, for display)
  const [channelInstances, setChannelInstances] = useState<ChannelInstance[]>([]);
  /** All instances including disabled – used only for validation lookups (targets can reference disabled instances). */
  const [channelInstancesAll, setChannelInstancesAll] = useState<ChannelInstance[]>([]);
  const [channelOverrides, setChannelOverrides] = useState<any[]>([]);
  const [channelOverridesLoaded, setChannelOverridesLoaded] = useState(false);
  /** Per-butik (per instance) price overrides for Priser tab. Key = instance id. */
  const [channelPriceOverrides, setChannelPriceOverrides] = useState<
    Record<string, { priceAmount: string; salePrice: string }>
  >({});
  const [lastFxObservedAt, setLastFxObservedAt] = useState<string | null>(null);
  const [fxUpdating, setFxUpdating] = useState(false);
  const [channelTargetsLoading, setChannelTargetsLoading] = useState(false);
  const [currentTargetKeys, setCurrentTargetKeys] = useState<Set<string>>(new Set());
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(new Set());
  /** Fetched category lists per channel instance (key = instance id). WooCommerce items could have parent for hierarchy. */
  const [channelCategoriesList, setChannelCategoriesList] = useState<
    Record<string, Array<{ id: string; name: string; path?: string; parent?: number }>>
  >({});
  const [channelCategoriesLoading, setChannelCategoriesLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [channelCategoriesError, setChannelCategoriesError] = useState<Record<string, string>>({});
  const [cdonDiagnoseResult, setCdonDiagnoseResult] = useState<any>(null);
  const [cdonDiagnoseLoading, setCdonDiagnoseLoading] = useState(false);
  const categoryFetchStartedRef = useRef<Set<string>>(new Set());
  /** WooCommerce: which category nodes are expanded (key = instance id). Default all collapsed. */
  const [wooExpandedIds, setWooExpandedIds] = useState<Record<string, Set<string>>>({});
  /** WooCommerce: which instance's category panel is open. Default closed to save vertical space. */
  const [wooPanelOpen, setWooPanelOpen] = useState<Record<string, boolean>>({});
  /** CDON/Fyndiq: which category nodes are expanded (key = instance id). */
  const [channelCategoryExpandedIds, setChannelCategoryExpandedIds] = useState<
    Record<string, Set<string>>
  >({});
  /** CDON/Fyndiq: which instance's category panel is open. */
  const [channelCategoryPanelOpen, setChannelCategoryPanelOpen] = useState<Record<string, boolean>>(
    {},
  );
  /** Category search filter per row (key = inst.id). */
  const [categorySearch, setCategorySearch] = useState<Record<string, string>>({});

  // Target key: "channel" or "channel:instanceId" for matching
  const targetKey = (channel: string, channelInstanceId: string | null) =>
    channelInstanceId ? `${channel}:${channelInstanceId}` : channel;

  /** CDON/Fyndiq kräver marknad (SE, DK, FI, NO). WooCommerce behöver inte. Används för att visa aktiva/inaktiva i Kanaler och filtrera Priser/Kategorier. */
  const hasValidMarket = (inst: ChannelInstance) => {
    const ch = String(inst.channel).toLowerCase();
    if (ch === 'woocommerce') {
      return true;
    }
    const m = inst.market?.trim()?.toLowerCase().slice(0, 2);
    return !!m && ['se', 'dk', 'fi', 'no'].includes(m);
  };

  // Load channel instances (for both new and existing products) and, when product exists, current targets + overrides.
  // Batch: only instances (available stores); never getProductTargets/getOverrides for any selected id — Kanaler starts empty.
  // Use context cache so we don’t refetch when switching tabs (cache survives form remount).
  useEffect(() => {
    if (isBatchMode && batchProductIds.length === 0) {
      return;
    }
    const productKey = isBatchMode
      ? `batch:${batchProductIds.join(',')}`
      : (currentProduct?.id ?? 'new');
    const cached = getChannelDataCache(productKey);
    if (cached && !isBatchMode) {
      const cachedAllInstances = cached.instances as ChannelInstance[];
      const cachedEnabledInstances = cachedAllInstances.filter((i) => i.enabled !== false);
      setChannelOverrides(cached.overrides);
      setChannelOverridesLoaded(true);
      const priceInit: Record<string, { priceAmount: string; salePrice: string }> = {};
      for (const inst of cachedEnabledInstances) {
        const ov = (cached.overrides as any[]).find(
          (o: any) => String(o.instanceId) === String(inst.id),
        );
        const ch = String(inst.channel || '').toLowerCase();
        const reaprisOrOriginal =
          ch === 'woocommerce' ? ov?.salePrice : ch === 'fyndiq' ? ov?.originalPrice : null;
        priceInit[String(inst.id)] = {
          priceAmount: ov?.priceAmount != null ? String(ov.priceAmount) : '',
          salePrice: reaprisOrOriginal != null ? String(reaprisOrOriginal) : '',
        };
      }
      initialChannelPriceOverridesRef.current = JSON.parse(JSON.stringify(priceInit)) as Record<
        string,
        { priceAmount: string; salePrice: string }
      >;
      setChannelPriceOverrides(priceInit);
      const cachedEnabledKeySet = new Set(
        cachedEnabledInstances.map((i: any) =>
          targetKey(String(i.channel).toLowerCase(), String(i.id)),
        ),
      );
      const filteredTargetKeys = (cached.targetKeys as string[]).filter((k) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx).toLowerCase() : k.toLowerCase();
        const id = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        return cachedEnabledKeySet.has(targetKey(ch, id || null));
      });
      const cachedKeys = new Set(filteredTargetKeys);
      initialSelectedTargetKeysRef.current = new Set(filteredTargetKeys);
      setCurrentTargetKeys(cachedKeys);
      setSelectedTargetKeys(new Set(filteredTargetKeys));
      setChannelInstances(cachedEnabledInstances);
      setChannelInstancesAll(cachedAllInstances);

      // Stale-while-revalidate: fetch fresh instances in background so labels stay up-to-date (e.g. after editing in Channels)
      let revalidateCancelled = false;
      channelsApi
        .getInstances({ includeDisabled: true })
        .then((respAll) => {
          if (revalidateCancelled) {
            return;
          }
          const instsAll = respAll?.items ?? [];
          const insts = instsAll.filter((i) => i.enabled !== false);
          setChannelInstances(insts);
          setChannelInstancesAll(instsAll);
          setChannelDataCache(productKey, { ...cached, instances: instsAll });
        })
        .catch(() => {
          // Keep cached data on error
        });
      return () => {
        revalidateCancelled = true;
      };
    }

    let cancelled = false;
    setChannelTargetsLoading(true);
    setChannelOverridesLoaded(false);
    (async () => {
      try {
        const instAllResp = await channelsApi.getInstances({ includeDisabled: true });
        if (cancelled) {
          return;
        }
        const instsAll = instAllResp?.items ?? [];
        const insts = instsAll.filter((i) => i.enabled !== false);
        setChannelInstances(insts);
        setChannelInstancesAll(instsAll);

        if (isBatchMode) {
          setChannelOverrides([]);
          setChannelOverridesLoaded(true);
          initialSelectedTargetKeysRef.current = new Set();
          const priceInitBatch: Record<string, { priceAmount: string; salePrice: string }> = {};
          for (const inst of insts) {
            priceInitBatch[String(inst.id)] = { priceAmount: '', salePrice: '' };
          }
          initialChannelPriceOverridesRef.current = JSON.parse(
            JSON.stringify(priceInitBatch),
          ) as Record<string, { priceAmount: string; salePrice: string }>;
          setChannelPriceOverrides(priceInitBatch);
          setCurrentTargetKeys(new Set());
          setSelectedTargetKeys(new Set());
          setChannelDataCache(productKey, { instances: instsAll, overrides: [], targetKeys: [] });
          setChannelTargetsLoading(false);
          return;
        }

        if (!currentProduct?.id) {
          setChannelOverrides([]);
          setChannelOverridesLoaded(true);
          initialSelectedTargetKeysRef.current = new Set();
          initialChannelPriceOverridesRef.current = {};
          setCurrentTargetKeys(new Set());
          setSelectedTargetKeys(new Set());
          setChannelDataCache('new', { instances: instsAll, overrides: [], targetKeys: [] });
          setChannelTargetsLoading(false);
          return;
        }

        const [targetsResp, ovResp] = await Promise.all([
          channelsApi.getProductTargets(String(currentProduct.id)),
          channelsApi.getOverrides({ productId: String(currentProduct.id) }),
        ]);
        if (cancelled) {
          return;
        }
        const targets = targetsResp?.targets ?? [];
        const ovs = ovResp?.items ?? [];
        setChannelOverrides(ovs);
        setChannelOverridesLoaded(true);
        const enabledKeySet = new Set(
          insts.map((i) => targetKey(String(i.channel).toLowerCase(), String(i.id))),
        );
        const keys = new Set<string>();
        for (const t of targets) {
          const k = targetKey(
            String(t.channel).toLowerCase(),
            t.channelInstanceId != null ? String(t.channelInstanceId) : null,
          );
          if (enabledKeySet.has(k)) {
            keys.add(k);
          }
        }
        const keyList = Array.from(keys);
        initialSelectedTargetKeysRef.current = new Set(keyList);
        setCurrentTargetKeys(keys);
        setSelectedTargetKeys(keys);
        setChannelDataCache(String(productKey), {
          instances: instsAll,
          overrides: ovs,
          targetKeys: keyList,
        });
      } catch (err) {
        if (!cancelled) {
          setChannelInstances([]);
          setChannelInstancesAll([]);
          setChannelOverrides([]);
          setChannelOverridesLoaded(false);
          initialSelectedTargetKeysRef.current = new Set();
          initialChannelPriceOverridesRef.current = {};
          setCurrentTargetKeys(new Set());
          setSelectedTargetKeys(new Set());
        }
        console.error('Failed to load channel targets', err);
      } finally {
        if (!cancelled) {
          setChannelTargetsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit getChannelDataCache/setChannelDataCache: when they change (e.g. new ref on context re-render),
    // we must not re-run and overwrite selectedTargetKeys with stale cached targetKeys, or the user's Kanaler
    // checkbox changes (e.g. Fyndiq DK) are lost before Save.
  }, [currentProduct?.id, isBatchMode, batchProductIds]);

  // Run validation for footer (price warning etc.) when form state changes.
  // Skip during submit so the footer doesn't flicker between Ignore and Save.
  useEffect(() => {
    if (isCurrentlySubmitting || isBatchMode || channelInstances.length === 0) {
      if (!isCurrentlySubmitting && (isBatchMode || channelInstances.length === 0)) {
        clearValidationErrors();
      }
      return;
    }
    const channelTargets = Array.from(selectedTargetKeys).map((k) => {
      const colonIdx = k.indexOf(':');
      const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
      const instId = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
      return {
        channel: ch,
        channelInstanceId: instId && Number.isFinite(Number(instId)) ? Number(instId) : null,
      };
    });
    const instsForMarketLookup =
      channelInstancesAll.length > 0 ? channelInstancesAll : channelInstances;
    const channelTargetsWithMarket = Array.from(selectedTargetKeys)
      .map((k) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
        const instIdStr = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        const inst = instsForMarketLookup.find(
          (i) => String(i.channel).toLowerCase() === ch.toLowerCase() && String(i.id) === instIdStr,
        );
        const marketRaw = inst?.market?.trim();
        if (!marketRaw) {
          return null;
        }
        const market = marketRaw.toLowerCase().slice(0, 2);
        if (!['se', 'dk', 'fi', 'no'].includes(market)) {
          return null;
        }
        return {
          channel: ch,
          channelInstanceId:
            instIdStr && Number.isFinite(Number(instIdStr)) ? Number(instIdStr) : null,
          market,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    const channelOverridesToSave = channelInstances
      .filter((i) => ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()))
      .map((inst) => {
        const ch = String(inst.channel).toLowerCase();
        const key = `${ch}:${inst.id}`;
        const active = selectedTargetKeys.has(key);
        const po = channelPriceOverrides[String(inst.id)];
        const priceStr = (po?.priceAmount ?? '').trim().replace(',', '.');
        const priceAmount =
          priceStr !== '' && Number.isFinite(Number(priceStr)) && Number(priceStr) >= 0
            ? Number(priceStr)
            : null;
        return {
          channelInstanceId: inst.id,
          active,
          priceAmount,
        };
      })
      .filter((o) => o.channelInstanceId);
    validateProductForm(formData, {
      channelTargets,
      channelTargetsWithMarket,
      channelOverridesToSave,
    });
  }, [
    isBatchMode,
    isCurrentlySubmitting,
    formData,
    selectedTargetKeys,
    channelInstances,
    channelInstancesAll,
    channelPriceOverrides,
    validateProductForm,
    clearValidationErrors,
  ]);

  // Parse WooCommerce category from override (single id or JSON array)
  const parseWooCategory = (cat: string | null): string[] => {
    if (!cat?.trim()) {
      return [];
    }
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

  // Sync overrides into channelCategories and channelPriceOverrides when overrides load. One source: channel_product_overrides.
  const hasSyncedOverridesRef = React.useRef(false);
  useEffect(() => {
    if (
      !currentProduct?.id ||
      channelInstances.length === 0 ||
      !channelOverridesLoaded ||
      hasSyncedOverridesRef.current
    ) {
      return;
    }
    hasSyncedOverridesRef.current = true;
    setFormData((prev) => {
      const nextWoo = { ...(prev.channelCategories?.woocommerce ?? {}) };
      let nextCdon = prev.channelCategories?.cdon ?? '';
      let nextFyndiq = prev.channelCategories?.fyndiq ?? '';
      for (const ov of channelOverrides) {
        if (!ov.instanceId) {
          continue;
        }
        const inst = channelInstances.find((i) => i.id === ov.instanceId);
        if (!inst) {
          continue;
        }
        const ch = String(inst.channel).toLowerCase();
        if (ch === 'woocommerce') {
          const key = inst.instanceKey;
          nextWoo[key] = ov.category != null ? parseWooCategory(ov.category) : [];
        } else if (ch === 'cdon' && ov.category != null && String(ov.category).trim()) {
          if (!nextCdon) {
            nextCdon = String(ov.category).trim();
          }
        } else if (ch === 'fyndiq' && ov.category != null && String(ov.category).trim()) {
          if (!nextFyndiq) {
            nextFyndiq = String(ov.category).trim();
          }
        }
      }
      const nextFormData: FormData = {
        ...prev,
        channelCategories: {
          ...prev.channelCategories,
          woocommerce: nextWoo,
          cdon: nextCdon,
          fyndiq: nextFyndiq,
        },
      };
      initialFormStateRef.current = JSON.parse(JSON.stringify(nextFormData)) as FormData;
      return nextFormData;
    });
    const priceInit: Record<string, { priceAmount: string; salePrice: string }> = {};
    for (const inst of channelInstances) {
      const ov = channelOverrides.find((o: any) => String(o.instanceId) === String(inst.id));
      const ch = String(inst.channel || '').toLowerCase();
      const reaprisOrOriginal =
        ch === 'woocommerce' ? ov?.salePrice : ch === 'fyndiq' ? ov?.originalPrice : null;
      priceInit[String(inst.id)] = {
        priceAmount: ov?.priceAmount != null ? String(ov.priceAmount) : '',
        salePrice: reaprisOrOriginal != null ? String(reaprisOrOriginal) : '',
      };
    }
    initialChannelPriceOverridesRef.current = JSON.parse(JSON.stringify(priceInit)) as Record<
      string,
      { priceAmount: string; salePrice: string }
    >;
    setChannelPriceOverrides(priceInit);
  }, [channelOverrides, channelInstances, channelOverridesLoaded, currentProduct?.id]);
  useEffect(() => {
    hasSyncedOverridesRef.current = false;
  }, [currentProduct?.id, channelOverridesLoaded]);

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = isBatchMode
      ? `product-form-batch-${batchProductIds.join(',')}`
      : `product-form-${currentProduct?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [
    isDirty,
    currentProduct,
    isBatchMode,
    batchProductIds,
    registerUnsavedChangesChecker,
    unregisterUnsavedChangesChecker,
  ]);

  // Load current product (or leave empty for batch mode)
  useEffect(() => {
    if (isBatchMode) {
      initialFormStateRef.current = JSON.parse(JSON.stringify(batchInitialState)) as FormData;
      initialSelectedTargetKeysRef.current = new Set();
      initialChannelPriceOverridesRef.current = {};
      setFormData(batchInitialState);
      setIsMpnAuto(true);
      markClean();
      return;
    }
    if (currentProduct) {
      const sku = currentProduct.sku ?? '';
      const mpn = currentProduct.mpn ?? '';
      const baseTitle = decodeHtmlEntities(currentProduct.title ?? '');
      const baseDesc = decodeHtmlEntities(currentProduct.description ?? '');
      const cs =
        currentProduct.channelSpecific && typeof currentProduct.channelSpecific === 'object'
          ? currentProduct.channelSpecific
          : {};
      const markets: FormData['markets'] = { ...initialState.markets };
      const texts: FormData['texts'] = { ...initialState.texts };
      for (const m of MARKETS) {
        const cdonMarketData = (cs.cdon as any)?.markets?.[m.key];
        const fyndiqMarketData = (cs.fyndiq as any)?.markets?.[m.key];
        const mData = cdonMarketData ?? fyndiqMarketData;
        const defShip = getDefaultDelivery(m.key);
        const shippingTimeFromApi = (
          arr: Array<{ market?: string; min?: number; max?: number }> | undefined,
          marketKey: string,
        ) => {
          const upper = marketKey.toUpperCase();
          const entry = arr?.find((e) => String(e?.market || '').toUpperCase() === upper);
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          return {
            min: Number.isFinite(Number(entry.min)) ? Number(entry.min) : null,
            max: Number.isFinite(Number(entry.max)) ? Number(entry.max) : null,
          };
        };
        const deliveryTypeFromApi = (
          arr: Array<{ market?: string; value?: string }> | undefined,
          marketKey: string,
        ) => {
          const upper = marketKey.toUpperCase();
          const entry = arr?.find((e) => String(e.market).toUpperCase() === upper);
          const v = entry?.value as DeliveryTypeValue | undefined;
          return v === 'mailbox' || v === 'service_point' || v === 'home_delivery' ? v : '';
        };
        const cdonShipping = (cs.cdon as any)?.shipping_time;
        const fyndiqShipping = (cs.fyndiq as any)?.shipping_time;
        const shippingTime =
          shippingTimeFromApi(Array.isArray(cdonShipping) ? cdonShipping : undefined, m.key) ??
          shippingTimeFromApi(Array.isArray(fyndiqShipping) ? fyndiqShipping : undefined, m.key);
        const cdonDelivery = (cs.cdon as any)?.delivery_type;
        const fyndiqDelivery = (cs.fyndiq as any)?.delivery_type;
        const deliveryType =
          deliveryTypeFromApi(Array.isArray(cdonDelivery) ? cdonDelivery : undefined, m.key) ||
          deliveryTypeFromApi(Array.isArray(fyndiqDelivery) ? fyndiqDelivery : undefined, m.key);
        markets[m.key] = {
          shippingMin: Number.isFinite(shippingTime?.min)
            ? Number(shippingTime!.min)
            : Number.isFinite((mData as { shippingMin?: unknown })?.shippingMin)
              ? Number((mData as { shippingMin?: unknown }).shippingMin)
              : (defShip?.shippingMin ?? 1),
          shippingMax: Number.isFinite(shippingTime?.max)
            ? Number(shippingTime!.max)
            : Number.isFinite((mData as { shippingMax?: unknown })?.shippingMax)
              ? Number((mData as { shippingMax?: unknown }).shippingMax)
              : (defShip?.shippingMax ?? 3),
          deliveryType,
        };
        const tData = (cs.cdon as any)?.texts?.[m.key] ?? (cs.fyndiq as any)?.texts?.[m.key];
        const validFor = tData?.validFor ?? { cdon: true, fyndiq: true };
        const extended = (cs as any)?.textsExtended?.[m.key];
        const bulletpointsStr = Array.isArray(extended?.bulletpoints)
          ? (extended.bulletpoints as string[]).filter(Boolean).join('\n')
          : typeof extended?.bulletpoints === 'string'
            ? extended.bulletpoints
            : '';
        const titleFromExtended = decodeHtmlEntities((extended as any)?.name ?? '');
        const descFromExtended = decodeHtmlEntities((extended as any)?.description ?? '');
        const isStandardMarket =
          m.key === (((cs as any)?.textsStandard as MarketKey | undefined) ?? 'se');
        texts[m.key] =
          titleFromExtended || descFromExtended || isStandardMarket
            ? {
                // Source of truth for explicit per-market text is textsExtended.
                // Export payloads in cdon/fyndiq.texts may already be fallback-expanded
                // and must not rehydrate DK/FI/NO as explicit texts in the form.
                title: titleFromExtended || (isStandardMarket ? baseTitle : ''),
                description: descFromExtended || (isStandardMarket ? baseDesc : ''),
                titleSeo: extended?.titleSeo ?? '',
                metaDesc: extended?.metaDesc ?? '',
                metaKeywords: extended?.metaKeywords ?? '',
                bulletpoints: bulletpointsStr,
                validFor,
              }
            : {
                title: '',
                description: '',
                titleSeo: '',
                metaDesc: '',
                metaKeywords: '',
                bulletpoints: '',
                validFor: { cdon: true, fyndiq: true },
              };
      }
      if (!texts.se.title) {
        texts.se = { title: baseTitle, description: baseDesc };
      }
      const pickCdonCategoryFromChannelSpecific = (): string => {
        const cat = (cs.cdon as any)?.category;
        if (cat != null && String(cat).trim() && String(cat).trim() !== '0') {
          return String(cat).trim();
        }
        return '';
      };
      const pickFyndiqCategoryFromChannelSpecific = (): string => {
        const arr = Array.isArray((cs.fyndiq as any)?.categories)
          ? (cs.fyndiq as any).categories
          : [];
        const first = arr.find(
          (x: any) => x != null && String(x).trim() !== '' && String(x).trim() !== '0',
        );
        return first != null ? String(first).trim() : '';
      };
      const cdonCategoryForForm = pickCdonCategoryFromChannelSpecific();
      const fyndiqCategoryForForm = pickFyndiqCategoryFromChannelSpecific();
      const baseAmount = Number.isFinite(currentProduct.priceAmount)
        ? Number(currentProduct.priceAmount)
        : 0;
      const baseCur = currentProduct.currency ?? 'SEK';
      const fxAt = (cs as any)?.lastFxObservedAt;
      setLastFxObservedAt(typeof fxAt === 'string' ? fxAt : null);
      const nextFormData: FormData = {
        title: baseTitle,
        status: normalizeProductStatus(currentProduct.status),
        quantity: Number.isFinite(currentProduct.quantity) ? Number(currentProduct.quantity) : 0,
        priceAmount: baseAmount,
        purchasePrice:
          (currentProduct as any).purchasePrice != null &&
          Number.isFinite((currentProduct as any).purchasePrice)
            ? (currentProduct as any).purchasePrice
            : '',
        currency: baseCur,
        vatRate: Number.isFinite(currentProduct.vatRate) ? Number(currentProduct.vatRate) : 25,
        sku,
        privateName: (currentProduct as any).privateName ?? '',
        mpn,
        description: baseDesc,
        mainImage: currentProduct.mainImage ?? '',
        images: orderAssetsByMainImage(
          normalizeProductImages(currentProduct.images),
          currentProduct.mainImage ?? '',
        ),
        categories: Array.isArray(currentProduct.categories) ? currentProduct.categories : [],
        brand: currentProduct.brand ?? '',
        brandId: (currentProduct as any).brandId ?? '',
        ean: (currentProduct as any).ean ?? '',
        gtin: currentProduct.gtin ?? '',
        knNumber: (currentProduct as any).knNumber ?? '',
        supplierId: (currentProduct as any).supplierId ?? '',
        manufacturerId: (currentProduct as any).manufacturerId ?? '',
        lagerplats: currentProduct.lagerplats ?? '',
        color: (currentProduct as any).color ?? '',
        colorText: (currentProduct as any).colorText ?? '',
        size: (currentProduct as any).size ?? '',
        sizeText: (currentProduct as any).sizeText ?? '',
        pattern: (currentProduct as any).pattern ?? '',
        material: (currentProduct as any).material ?? '',
        patternText: (currentProduct as any).patternText ?? '',
        model: (currentProduct as any).model ?? '',
        weight:
          (currentProduct as any).weight != null && (currentProduct as any).weight !== ''
            ? (currentProduct as any).weight
            : '',
        weightUnit: (cs as any)?.weightUnit === 'kg' ? 'kg' : 'g',
        shoeSizeEu: ((cs as any)?.shoeSizeEu ?? '') as string,
        condition:
          (currentProduct as any).condition === 'used'
            ? 'used'
            : (currentProduct as any).condition === 'refurb'
              ? 'refurb'
              : 'new',
        shippedFrom: (cs.cdon as any)?.shipped_from === 'NON_EU' ? 'NON_EU' : 'EU',
        availabilityDates: (() => {
          const arr = Array.isArray((cs.cdon as any)?.availability_dates)
            ? (cs.cdon as any).availability_dates
            : [];
          const map: Record<string, string> = { se: '', dk: '', fi: '', no: '' };
          for (const e of arr) {
            const m = String(e?.market || '').toLowerCase();
            const v = e?.value != null ? String(e.value).trim() : '';
            if (m && ['se', 'dk', 'fi', 'no'].includes(m)) {
              map[m] = v;
            }
          }
          return map;
        })(),
        groupId: (currentProduct as any).groupId ?? '',
        volume:
          (currentProduct as any).volume != null && (currentProduct as any).volume !== ''
            ? (currentProduct as any).volume
            : '',
        volumeUnit: (currentProduct as any).volumeUnit ?? '',
        notes: (currentProduct as any).notes ?? '',
        lengthCm:
          (currentProduct as any).lengthCm != null && (currentProduct as any).lengthCm !== ''
            ? (currentProduct as any).lengthCm
            : '',
        widthCm:
          (currentProduct as any).widthCm != null && (currentProduct as any).widthCm !== ''
            ? (currentProduct as any).widthCm
            : '',
        heightCm:
          (currentProduct as any).heightCm != null && (currentProduct as any).heightCm !== ''
            ? (currentProduct as any).heightCm
            : '',
        depthCm:
          (currentProduct as any).depthCm != null && (currentProduct as any).depthCm !== ''
            ? (currentProduct as any).depthCm
            : '',
        listId: (currentProduct as any).listId ?? '',
        markets,
        texts,
        standardTextMarket: (['se', 'dk', 'fi', 'no'] as const).includes((cs as any)?.textsStandard)
          ? (cs as any).textsStandard
          : 'se',
        channelCategories: {
          cdon: cdonCategoryForForm,
          fyndiq: fyndiqCategoryForForm,
          woocommerce:
            (cs.woocommerce as any)?.categories &&
            typeof (cs.woocommerce as any).categories === 'object'
              ? (cs.woocommerce as any).categories
              : {},
        },
        wooBackorders:
          (cs.woocommerce as any)?.backorders === 'yes' ||
          (cs.woocommerce as any)?.backorders === 'notify'
            ? (cs.woocommerce as any).backorders
            : 'no',
        channelSpecific: cs,
      };
      initialFormStateRef.current = JSON.parse(JSON.stringify(nextFormData)) as FormData;
      setFormData(nextFormData);
      setIsMpnAuto(!(mpn && mpn !== sku));
      const ean = (currentProduct as any).ean ?? '';
      const gtin = currentProduct.gtin ?? '';
      setIsGtinAuto(!(gtin && gtin !== ean));
      markClean();
    } else {
      initialFormStateRef.current = JSON.parse(JSON.stringify(initialState)) as FormData;
      initialSelectedTargetKeysRef.current = new Set();
      initialChannelPriceOverridesRef.current = {};
      setFormData(initialState);
      setLastFxObservedAt(null);
      setIsMpnAuto(true);
      markClean();
    }
  }, [currentProduct, isBatchMode, batchProductIds, markClean, productSettings]);

  // Load lists when Produkt tab is active (for List dropdown)
  useEffect(() => {
    if (activeTab !== 'produkt') {
      return;
    }
    productsApi
      .getLists()
      .then((data) => setLists(data || []))
      .catch(() => setLists([]));
  }, [activeTab]);

  // Load brands, suppliers, manufacturers when Detaljer tab is active
  useEffect(() => {
    if (activeTab !== 'detaljer') {
      return;
    }
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
  }, [activeTab]);

  // Aggregated list for Kategorier tab: one row CDON, one row Fyndiq, then one per Woo store.
  const categoryTabInstances = React.useMemo(() => {
    const base = channelInstances.filter(
      (i) =>
        ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()) &&
        hasValidMarket(i),
    );
    const hasCdon = base.some((i) => String(i.channel).toLowerCase() === 'cdon');
    const hasFyndiq = base.some((i) => String(i.channel).toLowerCase() === 'fyndiq');
    const result: Array<{
      channel: string;
      id: string;
      label: string;
      instanceKey: string;
      isVirtual?: boolean;
    }> = [];
    if (hasCdon) {
      result.push({
        channel: 'cdon',
        id: 'cdon',
        label: 'CDON',
        instanceKey: 'cdon',
        isVirtual: true,
      });
    }
    if (hasFyndiq) {
      result.push({
        channel: 'fyndiq',
        id: 'fyndiq',
        label: 'Fyndiq',
        instanceKey: 'fyndiq',
        isVirtual: true,
      });
    }
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
    if (activeTab !== 'kategori' || !categoryTabInstances.length) {
      return;
    }
    for (const inst of categoryTabInstances) {
      const key = inst.id;
      if (categoryFetchStartedRef.current.has(key)) {
        continue;
      }
      categoryFetchStartedRef.current.add(key);
      setChannelCategoriesLoading((prev) => ({ ...prev, [key]: true }));
      setChannelCategoriesError((prev) => ({ ...prev, [key]: '' }));
      const fetchInst = inst.isVirtual
        ? { channel: inst.channel, id: inst.id }
        : { channel: inst.channel, id: Number(inst.id), instanceKey: inst.instanceKey };
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
          const msg =
            typeof detail === 'string' && detail && detail !== main ? `${main}. ${detail}` : main;
          setChannelCategoriesError((prev) => ({
            ...prev,
            [key]: typeof msg === 'string' ? msg : JSON.stringify(msg),
          }));
          setChannelCategoriesList((prev) => ({ ...prev, [key]: [] }));
        } finally {
          setChannelCategoriesLoading((prev) => ({ ...prev, [key]: false }));
        }
      })();
    }
  }, [activeTab, categoryTabInstances, getChannelCategories]);

  const updateField = (
    field: keyof FormData,
    value: string | number | string[] | ProductImageAsset[] | Record<MarketKey, string>,
  ) => {
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
      if (field === 'title') {
        return {
          ...prev,
          title: String(value),
          texts: { ...prev.texts, se: { ...prev.texts.se, title: String(value) } },
        } as FormData;
      }
      if (field === 'description') {
        return {
          ...prev,
          description: String(value),
          texts: { ...prev.texts, se: { ...prev.texts.se, description: String(value) } },
        } as FormData;
      }

      return { ...prev, [field]: value } as FormData;
    });
    markDirty();
    clearValidationErrors();
  };

  const updateNumber = (field: 'quantity' | 'priceAmount' | 'vatRate', raw: string) => {
    const n = raw === '' ? NaN : Number(raw.replace(',', '.'));
    updateField(field, Number.isFinite(n) ? n : field === 'vatRate' ? 25 : 0);
  };

  const updateMarket = (
    market: MarketKey,
    field: keyof MarketData,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      markets: {
        ...prev.markets,
        [market]: { ...prev.markets[market], [field]: value },
      },
    }));
    markDirty();
  };

  const updateText = (
    market: MarketKey,
    field: keyof TextData,
    value: string | { cdon?: boolean; fyndiq?: boolean },
  ) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        texts: { ...prev.texts, [market]: { ...prev.texts[market], [field]: value } },
      };
      if (market === 'se' && field === 'title' && typeof value === 'string') {
        next.title = value;
      }
      if (market === 'se' && field === 'description' && typeof value === 'string') {
        next.description = value;
      }
      return next;
    });
    markDirty();
    if (market === 'se' && (field === 'title' || field === 'description')) {
      clearValidationErrors();
    }
  };

  const buildOverrideRows = useCallback(
    (
      instances: ChannelInstance[],
      activeKeys: string[],
      categoriesSource: ChannelCategory | undefined,
      priceSource: Record<string, { priceAmount: string; salePrice: string }>,
    ) =>
      instances
        .filter((inst) =>
          ['cdon', 'fyndiq', 'woocommerce'].includes(String(inst.channel).toLowerCase()),
        )
        .map((inst) => {
          const channel = String(inst.channel).toLowerCase() as ProductSyncChannel;
          const key = targetKey(channel, String(inst.id));
          const rawCategory =
            channel === 'woocommerce'
              ? categoriesSource?.woocommerce?.[inst.instanceKey]
              : channel === 'cdon'
                ? categoriesSource?.cdon
                : categoriesSource?.fyndiq;
          const category =
            channel === 'woocommerce'
              ? Array.isArray(rawCategory)
                ? rawCategory.length
                  ? JSON.stringify(rawCategory)
                  : null
                : typeof rawCategory === 'string' && rawCategory.trim()
                  ? rawCategory.trim()
                  : null
              : typeof rawCategory === 'string' && rawCategory.trim()
                ? rawCategory.trim()
                : null;
          const priceOverride = priceSource[String(inst.id)] ?? { priceAmount: '', salePrice: '' };
          return {
            channelInstanceId: String(inst.id),
            channel,
            active: activeKeys.includes(key),
            category,
            priceAmount: toComparableOverrideValue(priceOverride.priceAmount),
            salePrice:
              channel === 'woocommerce' ? toComparableOverrideValue(priceOverride.salePrice) : null,
            originalPrice:
              channel === 'fyndiq' ? toComparableOverrideValue(priceOverride.salePrice) : null,
          };
        }),
    [],
  );

  const classifySaveChangeSet = useCallback(
    (effectiveSelectedKeys: string[], saveInstances: ChannelInstance[]): ProductSaveChangeSet => {
      const selectedChannels = new Set<ProductSyncChannel>();
      for (const key of effectiveSelectedKeys) {
        const colonIdx = key.indexOf(':');
        const channel = (colonIdx >= 0 ? key.slice(0, colonIdx) : key).toLowerCase();
        if (channel === 'woocommerce' || channel === 'cdon' || channel === 'fyndiq') {
          selectedChannels.add(channel);
        }
      }

      if (!currentProduct) {
        return {
          local: {
            noChanges: false,
            hasChanges: true,
            productChanged: true,
            listChanged: !!String(formData.listId ?? '').trim(),
            targetsChanged: effectiveSelectedKeys.length > 0,
            overridesChanged: buildOverrideRows(
              saveInstances,
              effectiveSelectedKeys,
              formData.channelCategories,
              channelPriceOverrides,
            ).some(
              (row) =>
                row.active ||
                row.category != null ||
                row.priceAmount != null ||
                row.salePrice != null ||
                row.originalPrice != null,
            ),
          },
          sync: {
            strictChannels: [],
            fullChannels: Array.from(selectedChannels),
            articleOnlyChannels: Array.from(selectedChannels),
          },
        };
      }

      const initialFormState = initialFormStateRef.current;
      const currentOverrideRows = buildOverrideRows(
        saveInstances,
        effectiveSelectedKeys,
        formData.channelCategories,
        channelPriceOverrides,
      );
      const initialOverrideRows = buildOverrideRows(
        saveInstances,
        Array.from(initialSelectedTargetKeysRef.current),
        initialFormState.channelCategories,
        initialChannelPriceOverridesRef.current,
      );
      const initialOverrideMap = new Map(
        initialOverrideRows.map((row) => [String(row.channelInstanceId), row]),
      );

      const listChanged =
        String(formData.listId ?? '').trim() !== String(initialFormState.listId ?? '').trim();
      const targetsChanged =
        stableStringify(Array.from(new Set(effectiveSelectedKeys)).sort()) !==
        stableStringify(Array.from(initialSelectedTargetKeysRef.current).sort());

      const internalOnlyChanged =
        stableStringify(pickSnapshot(formData, PRODUCT_INTERNAL_ONLY_KEYS)) !==
        stableStringify(pickSnapshot(initialFormState, PRODUCT_INTERNAL_ONLY_KEYS));
      const strictBaseChanged =
        stableStringify(pickSnapshot(formData, PRODUCT_STRICT_KEYS)) !==
        stableStringify(pickSnapshot(initialFormState, PRODUCT_STRICT_KEYS));
      const fullAllChanged =
        stableStringify(pickSnapshot(formData, PRODUCT_FULL_ALL_KEYS)) !==
        stableStringify(pickSnapshot(initialFormState, PRODUCT_FULL_ALL_KEYS));
      const cdonFyndiqArticleChanged =
        stableStringify({
          texts: formData.texts,
          standardTextMarket: formData.standardTextMarket,
          shippedFrom: formData.shippedFrom,
          availabilityDates: formData.availabilityDates,
          markets: buildMarketArticleSnapshot(formData),
        }) !==
        stableStringify({
          texts: initialFormState.texts,
          standardTextMarket: initialFormState.standardTextMarket,
          shippedFrom: initialFormState.shippedFrom,
          availabilityDates: initialFormState.availabilityDates,
          markets: buildMarketArticleSnapshot(initialFormState),
        });
      const wooArticleChanged =
        stableStringify({ wooBackorders: formData.wooBackorders }) !==
        stableStringify({ wooBackorders: initialFormState.wooBackorders });

      const strictChannels = new Set<ProductSyncChannel>();
      const fullChannels = new Set<ProductSyncChannel>();
      const strictCompanionChannels = new Set<ProductSyncChannel>();

      if (strictBaseChanged || fullAllChanged) {
        for (const channel of selectedChannels) {
          if (strictBaseChanged) {
            strictChannels.add(channel);
            strictCompanionChannels.add(channel);
          }
          if (fullAllChanged) {
            fullChannels.add(channel);
          }
        }
      }
      if (cdonFyndiqArticleChanged) {
        if (selectedChannels.has('cdon')) {
          fullChannels.add('cdon');
        }
        if (selectedChannels.has('fyndiq')) {
          fullChannels.add('fyndiq');
        }
      }
      if (wooArticleChanged && selectedChannels.has('woocommerce')) {
        fullChannels.add('woocommerce');
      }
      if (targetsChanged) {
        for (const key of effectiveSelectedKeys) {
          const channel = key.split(':')[0]?.toLowerCase();
          if (channel === 'woocommerce' || channel === 'cdon' || channel === 'fyndiq') {
            strictChannels.add(channel);
            strictCompanionChannels.add(channel);
          }
        }
      }

      // New Kanaler targets (e.g. first time selecting Fyndiq DK) need full article export — not
      // update_only_strict, which only syncs price/quantity and does not add markets on Fyndiq/CDON.
      const initialTargetKeys = new Set(initialSelectedTargetKeysRef.current);
      for (const key of effectiveSelectedKeys) {
        if (initialTargetKeys.has(key)) {
          continue;
        }
        const channel = key.split(':')[0]?.toLowerCase();
        if (channel === 'cdon' || channel === 'fyndiq') {
          fullChannels.add(channel);
        }
      }

      let overridesChanged = false;
      for (const row of currentOverrideRows) {
        const before = initialOverrideMap.get(String(row.channelInstanceId));
        const categoryChanged = (before?.category ?? null) !== row.category;
        const strictChanged =
          (before?.active ?? false) !== row.active ||
          (before?.priceAmount ?? null) !== row.priceAmount ||
          (before?.salePrice ?? null) !== row.salePrice ||
          (before?.originalPrice ?? null) !== row.originalPrice;
        const activeTurnedOn =
          row.active === true &&
          (before?.active ?? false) === false &&
          (row.channel === 'cdon' || row.channel === 'fyndiq');
        if (categoryChanged || strictChanged) {
          overridesChanged = true;
        }
        if (categoryChanged || activeTurnedOn) {
          fullChannels.add(row.channel);
        }
        if (strictChanged) {
          strictChannels.add(row.channel);
          strictCompanionChannels.add(row.channel);
        }
      }

      for (const channel of Array.from(fullChannels)) {
        strictChannels.delete(channel);
      }

      const articleOnlyChannels = Array.from(fullChannels).filter(
        (channel) => !strictCompanionChannels.has(channel),
      );

      const productChanged =
        internalOnlyChanged ||
        strictBaseChanged ||
        fullAllChanged ||
        cdonFyndiqArticleChanged ||
        wooArticleChanged;
      const hasChanges = productChanged || listChanged || targetsChanged || overridesChanged;

      return {
        local: {
          noChanges: !hasChanges,
          hasChanges,
          productChanged,
          listChanged,
          targetsChanged,
          overridesChanged,
        },
        sync: {
          strictChannels: Array.from(strictChannels),
          fullChannels: Array.from(fullChannels),
          articleOnlyChannels,
        },
      };
    },
    [buildOverrideRows, channelPriceOverrides, currentProduct, formData],
  );

  const submittingGuardRef = useRef(false);
  const handleSubmit = useCallback(async () => {
    if (submittingGuardRef.current) {
      return;
    }
    clearValidationErrors();
    setSaveNotice('');

    if (isBatchMode) {
      const saveInstances = channelInstancesAll.length > 0 ? channelInstancesAll : channelInstances;
      const enabledInstances = saveInstances.filter((i) => i.enabled !== false);
      const enabledKeys = new Set(
        enabledInstances.map((i) => targetKey(String(i.channel).toLowerCase(), String(i.id))),
      );
      const normalizeKey = (k: string) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx).toLowerCase() : k.toLowerCase();
        const id = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        return id ? targetKey(ch, id) : ch;
      };
      const selectedKeysArray = Array.from(selectedTargetKeys)
        .map(normalizeKey)
        .filter((k) => enabledKeys.has(k));
      const overrideRowsBuilt = buildOverrideRows(
        saveInstances,
        selectedKeysArray,
        formData.channelCategories,
        channelPriceOverrides,
      );
      const overrideRowsActive = overrideRowsBuilt.map((row) => {
        const hasOv =
          (row.category != null && String(row.category).trim() !== '') ||
          row.priceAmount != null ||
          row.salePrice != null ||
          row.originalPrice != null;
        return { ...row, active: row.active || hasOv };
      });
      const effectiveSelectedKeys = [
        ...new Set(
          overrideRowsActive
            .filter((r) => r.active)
            .map((r) => normalizeKey(targetKey(r.channel, String(r.channelInstanceId)))),
        ),
      ].filter((k) => enabledKeys.has(k));
      const channelTargets = effectiveSelectedKeys.map((k) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
        const instId = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        return {
          channel: ch,
          channelInstanceId: instId && Number.isFinite(Number(instId)) ? Number(instId) : null,
        };
      });
      const channelTargetsWithMarket = effectiveSelectedKeys
        .map((k) => {
          const colonIdx = k.indexOf(':');
          const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
          const instIdStr = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
          const inst = saveInstances.find(
            (i) =>
              String(i.channel).toLowerCase() === ch.toLowerCase() && String(i.id) === instIdStr,
          );
          const marketRaw = inst?.market?.trim();
          if (!marketRaw) {
            return null;
          }
          const market = marketRaw.toLowerCase().slice(0, 2);
          if (!['se', 'dk', 'fi', 'no'].includes(market)) {
            return null;
          }
          return {
            channel: ch,
            channelInstanceId:
              instIdStr && Number.isFinite(Number(instIdStr)) ? Number(instIdStr) : null,
            market,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      const channelOverridesToSave = overrideRowsActive
        .filter((row) => row.active)
        .map((row) => {
          const item: Record<string, string | number | boolean> = {
            channelInstanceId: row.channelInstanceId,
            active: row.active,
          };
          if (row.category != null && String(row.category).trim() !== '') {
            item.category = row.category;
          }
          if (row.priceAmount != null) {
            item.priceAmount = Number(row.priceAmount);
          }
          if (row.salePrice != null) {
            item.salePrice = Number(row.salePrice);
          }
          if (row.originalPrice != null) {
            item.originalPrice = Number(row.originalPrice);
          }
          return item;
        });

      const patchOnly = collectBatchPatchChanges(initialFormStateRef.current, formData);
      const changes: Record<string, unknown> = { ...patchOnly };
      const hasChannelPayload =
        channelTargets.length > 0 ||
        channelOverridesToSave.some(
          (o) =>
            o.category != null ||
            o.priceAmount != null ||
            o.salePrice != null ||
            o.originalPrice != null,
        );
      if (hasChannelPayload) {
        changes.__batchChannel = {
          channelTargets,
          channelTargetsWithMarket,
          channelOverridesToSave,
        };
      }
      if (Object.keys(patchOnly).length === 0 && !hasChannelPayload) {
        setSaveNotice('Inget nytt att spara.');
        return;
      }

      const lines: string[] = [];
      for (const [k, v] of Object.entries(patchOnly)) {
        const shown = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
        lines.push(`${k} → ${shown}`);
      }
      if (changes.__batchChannel) {
        const bc = changes.__batchChannel as {
          channelTargets?: unknown[];
          channelOverridesToSave?: Array<{
            category?: unknown;
            priceAmount?: number | null;
            salePrice?: number;
            originalPrice?: number;
          }>;
        };
        lines.push(`kanaler → ${bc.channelTargets?.length ?? 0} aktiverade mål`);
        const ovs = bc.channelOverridesToSave ?? [];
        if (ovs.length > 0) {
          const rowHasPrice = (o: (typeof ovs)[number]) =>
            o.priceAmount != null || o.salePrice != null || o.originalPrice != null;
          const rowHasCategory = (o: (typeof ovs)[number]) =>
            o.category != null && String(o.category).trim() !== '';
          const nPrice = ovs.filter(rowHasPrice).length;
          const nCat = ovs.filter(rowHasCategory).length;
          const nActivationOnly = ovs.filter((o) => !rowHasPrice(o) && !rowHasCategory(o)).length;
          if (nPrice > 0) {
            lines.push(`Kanalpris: ${nPrice} butik(er)`);
          }
          if (nCat > 0) {
            lines.push(`Kanalkategori: ${nCat} butik(er)`);
          }
          if (nActivationOnly > 0) {
            lines.push(`Aktiverad butiksrad utan pris/kategori här: ${nActivationOnly}`);
          }
        }
      }
      setBatchPendingChanges(changes);
      setBatchPreviewLines(lines);
      setBatchPreviewOpen(true);
      return;
    }

    submittingGuardRef.current = true;
    const ignorePriceWarning = ignorePriceWarningRef.current;
    ignorePriceWarningRef.current = false;

    setIsSubmitting(true);
    setProductFormSaving?.(true);
    try {
      // Build API-shaped channelSpecific: shipping_time, delivery_type, title[], description[]
      const shippingTime = MARKETS.map((m) => {
        const dd = getDefaultDelivery(m.key);
        const smin = formData.markets[m.key].shippingMin;
        const smax = formData.markets[m.key].shippingMax;
        const min =
          smin === '' || !Number.isFinite(Number(smin)) ? (dd?.shippingMin ?? 1) : Number(smin);
        const max =
          smax === '' || !Number.isFinite(Number(smax)) ? (dd?.shippingMax ?? 3) : Number(smax);
        return { market: m.key.toUpperCase(), min, max };
      });
      const cdonDeliveryType = MARKETS.filter((m) => formData.markets[m.key].deliveryType).map(
        (m) => ({ market: m.key.toUpperCase(), value: formData.markets[m.key].deliveryType }),
      );
      const fyndiqDeliveryType = MARKETS.filter((m) => {
        const dt = formData.markets[m.key].deliveryType;
        return dt && dt !== 'home_delivery'; // Fyndiq: only mailbox, service_point
      }).map((m) => ({ market: m.key.toUpperCase(), value: formData.markets[m.key].deliveryType }));

      // Build title/description arrays per channel from texts + validFor (API format: { language, value }[])
      // Uses standardTextMarket as fallback when a market has no own text.
      const standardKey = formData.standardTextMarket ?? 'se';
      const standardText = formData.texts[standardKey];
      const buildTextArrays = (channel: 'cdon' | 'fyndiq') => {
        const arr: Array<{ language: string; value: string }> = [];
        for (const m of MARKETS) {
          const t = formData.texts[m.key];
          const vf = t?.validFor;
          const useForChannel = vf?.[channel] !== false;
          if (!useForChannel) {
            continue;
          }
          const val = (t?.title?.trim() || standardText?.title?.trim() || '').slice(0, 150);
          if (val.length >= 5) {
            arr.push({ language: m.lang, value: val });
          }
        }
        return arr;
      };
      const buildDescArrays = (channel: 'cdon' | 'fyndiq') => {
        const arr: Array<{ language: string; value: string }> = [];
        for (const m of MARKETS) {
          const t = formData.texts[m.key];
          const vf = t?.validFor;
          const useForChannel = vf?.[channel] !== false;
          if (!useForChannel) {
            continue;
          }
          const val = (t?.description?.trim() || standardText?.description?.trim() || '').slice(
            0,
            4096,
          );
          if (val.length >= 10) {
            arr.push({ language: m.lang, value: val });
          }
        }
        return arr;
      };
      const cdonTitle = buildTextArrays('cdon');
      const cdonDesc = buildDescArrays('cdon');
      const fyndiqTitle = buildTextArrays('fyndiq');
      const fyndiqDesc = buildDescArrays('fyndiq');

      const existingCs =
        currentProduct?.channelSpecific &&
        typeof currentProduct.channelSpecific === 'object' &&
        !Array.isArray(currentProduct.channelSpecific)
          ? (currentProduct.channelSpecific as Record<string, unknown>)
          : {};
      const cdonCat = (formData.channelCategories?.cdon ?? '').trim() || null;
      const fyndiqCat = (formData.channelCategories?.fyndiq ?? '').trim()
        ? [String(formData.channelCategories!.fyndiq).trim()]
        : [];
      const existingCdonBlock =
        existingCs.cdon && typeof existingCs.cdon === 'object' && !Array.isArray(existingCs.cdon)
          ? (existingCs.cdon as Record<string, unknown>)
          : {};
      const existingFyndiqBlock =
        existingCs.fyndiq &&
        typeof existingCs.fyndiq === 'object' &&
        !Array.isArray(existingCs.fyndiq)
          ? (existingCs.fyndiq as Record<string, unknown>)
          : {};
      const cdonMarketsPersisted = buildPersistedMarketsForChannel(
        formData.markets,
        existingCdonBlock.markets as Record<string, unknown> | undefined,
      );
      const fyndiqMarketsPersisted = buildPersistedMarketsForChannel(
        formData.markets,
        existingFyndiqBlock.markets as Record<string, unknown> | undefined,
      );
      const channelSpecific: Record<string, unknown> = {
        ...existingCs,
        weightUnit: formData.weightUnit,
        shoeSizeEu: formData.shoeSizeEu?.trim() || null,
        cdon: {
          ...existingCdonBlock,
          markets: cdonMarketsPersisted,
          texts: formData.texts,
          category: cdonCat,
          shipping_time: shippingTime,
          shipped_from: formData.shippedFrom || 'EU',
          ...(cdonDeliveryType.length > 0 && { delivery_type: cdonDeliveryType }),
          ...(cdonTitle.length > 0 && { title: cdonTitle }),
          ...(cdonDesc.length > 0 && { description: cdonDesc }),
          ...(formData.availabilityDates &&
            (Object.keys(formData.availabilityDates) as MarketKey[]).some((m) =>
              (formData.availabilityDates[m] ?? '').trim(),
            ) && {
              availability_dates: (['se', 'dk', 'fi', 'no'] as const)
                .filter((m) => (formData.availabilityDates[m] ?? '').trim())
                .map((m) => ({
                  market: m.toUpperCase(),
                  value: formData.availabilityDates[m]!.trim(),
                })),
            }),
        },
        fyndiq: {
          ...existingFyndiqBlock,
          markets: fyndiqMarketsPersisted,
          texts: formData.texts,
          categories: fyndiqCat,
          shipping_time: shippingTime,
          ...(fyndiqDeliveryType.length > 0 && { delivery_type: fyndiqDeliveryType }),
          ...(fyndiqTitle.length > 0 && { title: fyndiqTitle }),
          ...(fyndiqDesc.length > 0 && { description: fyndiqDesc }),
        },
      };
      const textsExtended: Record<
        string,
        {
          name?: string;
          description?: string;
          titleSeo?: string;
          metaDesc?: string;
          metaKeywords?: string;
          bulletpoints?: string[];
        }
      > = {};
      for (const m of MARKETS) {
        const t = formData.texts[m.key];
        const bpRaw = (t?.bulletpoints ?? '').trim();
        const bulletpointsArr = bpRaw
          ? bpRaw
              .split(/\n/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
        const hasContent =
          (t?.title ?? '').trim() ||
          (t?.description ?? '').trim() ||
          (t?.titleSeo ?? '').trim() ||
          (t?.metaDesc ?? '').trim() ||
          (t?.metaKeywords ?? '').trim() ||
          (bulletpointsArr?.length ?? 0) > 0;
        if (hasContent) {
          textsExtended[m.key] = {
            ...((t?.title ?? '').trim() && { name: (t.title ?? '').trim() }),
            ...((t?.description ?? '').trim() && { description: (t.description ?? '').trim() }),
            ...((t?.titleSeo ?? '').trim() && { titleSeo: (t.titleSeo ?? '').trim() }),
            ...((t?.metaDesc ?? '').trim() && { metaDesc: (t.metaDesc ?? '').trim() }),
            ...((t?.metaKeywords ?? '').trim() && { metaKeywords: (t.metaKeywords ?? '').trim() }),
            ...(bulletpointsArr && bulletpointsArr.length > 0 && { bulletpoints: bulletpointsArr }),
          };
        }
      }
      if (Object.keys(textsExtended).length > 0) {
        (channelSpecific as any).textsExtended = textsExtended;
      }
      (channelSpecific as any).textsStandard = standardKey;
      (channelSpecific as any).woocommerce = {
        ...((channelSpecific as any).woocommerce || {}),
        backorders: formData.wooBackorders,
      };
      (channelSpecific as any).lastFxObservedAt =
        lastFxObservedAt && typeof lastFxObservedAt === 'string' ? lastFxObservedAt : undefined;
      const payload = { ...formData, channelSpecific };
      const saveInstances = channelInstancesAll;
      const enabledInstances = saveInstances.filter((i) => i.enabled !== false);
      const enabledKeys = new Set(
        enabledInstances.map((i) => targetKey(String(i.channel).toLowerCase(), String(i.id))),
      );
      const normalizeKey = (k: string) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx).toLowerCase() : k.toLowerCase();
        const id = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        return id ? targetKey(ch, id) : ch;
      };
      // Only include targets for ENABLED instances – don’t save/export to disabled channels (e.g. NO)
      const effectiveSelectedKeys = Array.from(selectedTargetKeys)
        .map(normalizeKey)
        .filter((k) => enabledKeys.has(k));
      const channelTargets = effectiveSelectedKeys.map((k) => {
        const colonIdx = k.indexOf(':');
        const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
        const instId = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
        return {
          channel: ch,
          channelInstanceId: instId && Number.isFinite(Number(instId)) ? Number(instId) : null,
        };
      });
      // Endast kanaler med angiven marknad (ingen fallback – CDON/Fyndiq kräver rätt marknad)
      const channelTargetsWithMarket = effectiveSelectedKeys
        .map((k) => {
          const colonIdx = k.indexOf(':');
          const ch = colonIdx >= 0 ? k.slice(0, colonIdx) : k;
          const instIdStr = colonIdx >= 0 ? k.slice(colonIdx + 1) : '';
          const inst = saveInstances.find(
            (i) =>
              String(i.channel).toLowerCase() === ch.toLowerCase() && String(i.id) === instIdStr,
          );
          const marketRaw = inst?.market?.trim();
          if (!marketRaw) {
            return null;
          }
          const market = marketRaw.toLowerCase().slice(0, 2);
          if (!['se', 'dk', 'fi', 'no'].includes(market)) {
            return null;
          }
          return {
            channel: ch,
            channelInstanceId:
              instIdStr && Number.isFinite(Number(instIdStr)) ? Number(instIdStr) : null,
            market,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      const channelOverridesToSave = buildOverrideRows(
        saveInstances,
        effectiveSelectedKeys,
        formData.channelCategories,
        channelPriceOverrides,
      ).map((row) => ({
        channelInstanceId: row.channelInstanceId,
        active: row.active,
        category: row.category,
        priceAmount: row.priceAmount != null ? Number(row.priceAmount) : null,
        salePrice: row.salePrice != null ? Number(row.salePrice) : undefined,
        originalPrice: row.originalPrice != null ? Number(row.originalPrice) : undefined,
      }));
      const changeSet = classifySaveChangeSet(effectiveSelectedKeys, saveInstances);
      if (currentProduct && changeSet.local.noChanges) {
        markClean();
        closeProductPanel();
        return;
      }
      const success = await onSave(payload, {
        changeSet,
        ignorePriceWarning,
        channelTargets,
        channelTargetsWithMarket,
        channelOverridesToSave,
      });
      if (success) {
        markClean();
        if (!currentProduct) {
          setFormData(initialState);
        }
      } else {
        setSaveNotice('Kunde inte spara produkten. Kontrollera felen nedan.');
      }
    } finally {
      submittingGuardRef.current = false;
      setIsSubmitting(false);
      setProductFormSaving?.(false);
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
    setProductFormSaving,
    selectedTargetKeys,
    buildOverrideRows,
    classifySaveChangeSet,
    channelPriceOverrides,
    lastFxObservedAt,
    selectedTargetKeys,
    channelInstances,
    channelInstancesAll,
    buildOverrideRows,
  ]);

  const commitBatchSave = useCallback(async () => {
    const changes = batchPendingChanges;
    if (!changes || batchProductIds.length === 0) {
      setBatchPreviewOpen(false);
      setBatchPendingChanges(null);
      return;
    }
    submittingGuardRef.current = true;
    setIsSubmitting(true);
    setProductFormSaving?.(true);
    try {
      const result = await batchUpdateProducts(batchProductIds, changes);
      const errs = Array.isArray(result?.errors) ? result.errors : [];
      if (errs.length > 0) {
        const first = String((errs[0] as { message?: unknown } | undefined)?.message ?? '').trim();
        setSaveNotice(
          first ||
            `Batch sparades delvis, men ${errs.length} produkt${errs.length === 1 ? '' : 'er'} fick fel.`,
        );
        setBatchPreviewOpen(false);
        setBatchPendingChanges(null);
        return;
      }
      markClean();
      setBatchPreviewOpen(false);
      setBatchPendingChanges(null);
      closeProductPanel();
    } catch (err) {
      console.error('Batch update failed', err);
      setSaveNotice(getReadableErrorMessage(err, 'Kunde inte spara batchandringar.'));
    } finally {
      submittingGuardRef.current = false;
      setIsSubmitting(false);
      setProductFormSaving?.(false);
    }
  }, [
    batchPendingChanges,
    batchProductIds,
    batchUpdateProducts,
    markClean,
    closeProductPanel,
    setProductFormSaving,
  ]);

  // Listen for submit/cancel events from panel footer (cancelProductForm fires after user already confirmed in global nav guard, so close directly)
  const ignorePriceWarningRef = React.useRef(false);
  useEffect(() => {
    const onSubmit = (e: Event) => {
      ignorePriceWarningRef.current =
        (e instanceof CustomEvent && e.detail?.ignorePriceWarning) === true;
      handleSubmit();
    };
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
    /^varning\b/i.test(String(message || '').trim()) ||
    /^warning\b/i.test(String(message || '').trim());
  const hasBlockingErrors = validationErrors.some((e) => !isWarningMessage(e.message));
  const orderedAssets = orderAssetsByMainImage(formData.images, formData.mainImage);
  const mainImageAsset =
    orderedAssets.find((asset) => getProductImageOriginalUrl(asset) === formData.mainImage) ?? null;
  const galleryImages = orderedAssets.filter(
    (asset) => getProductImageOriginalUrl(asset) !== formData.mainImage,
  );
  const openOriginalImage = (asset: ProductImageAsset | null | undefined, fallbackUrl?: string) => {
    const url = getProductImageOriginalUrl(asset) || fallbackUrl || '';
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const getReadableErrorMessage = (error: unknown, fallback: string) => {
    const err = error as
      | { error?: unknown; message?: unknown; errors?: Array<{ message?: unknown }> }
      | undefined;
    if (Array.isArray(err?.errors) && err.errors.length) {
      const first = String(err.errors[0]?.message ?? '').trim();
      if (first) {
        return first;
      }
    }
    const direct = String(err?.error ?? err?.message ?? '').trim();
    return direct || fallback;
  };

  const addImage = () => {
    const v = newImage.trim();
    if (!v) {
      return;
    }
    const asset = buildExternalImageAsset(v, formData.images.length);
    setFormData((prev) => {
      const nextImages = normalizeProductImages([...prev.images, asset]).slice(0, 11);
      const nextMain = prev.mainImage || getProductImageOriginalUrl(nextImages[0]) || '';
      return {
        ...prev,
        mainImage: nextMain,
        images: orderAssetsByMainImage(nextImages, nextMain),
      };
    });
    markDirty();
    setNewImage('');
  };

  const removeImage = (idx: number) => {
    const asset = galleryImages[idx];
    if (!asset) {
      return;
    }
    const removeUrl = getProductImageOriginalUrl(asset);
    const next = orderedAssets.filter((item) => getProductImageOriginalUrl(item) !== removeUrl);
    setFormData((prev) => ({
      ...prev,
      images: orderAssetsByMainImage(next, prev.mainImage),
    }));
    markDirty();
  };

  const removeMainImage = () => {
    const next = orderedAssets.filter(
      (item) => getProductImageOriginalUrl(item) !== formData.mainImage,
    );
    const nextMain = getProductImageOriginalUrl(next[0]) || '';
    setFormData((prev) => ({
      ...prev,
      mainImage: nextMain,
      images: orderAssetsByMainImage(next, nextMain),
    }));
    markDirty();
  };

  const promoteToMain = (idx: number) => {
    const asset = galleryImages[idx];
    const url = getProductImageOriginalUrl(asset);
    if (!url) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      mainImage: url,
      images: orderAssetsByMainImage(prev.images, url),
    }));
    markDirty();
  };

  const addImageFromUpload = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setMediaUploading(true);
    try {
      const items = await productsApi.uploadMediaFiles(Array.from(files));
      const toAdd = normalizeProductImages(items);
      setFormData((prev) => {
        let main = prev.mainImage;
        const imgs = [...prev.images];
        for (const asset of toAdd) {
          const url = getProductImageOriginalUrl(asset);
          if (!url) {
            continue;
          }
          if (!main) {
            main = url;
          }
          imgs.push(asset);
          if (imgs.length >= 11) {
            break;
          }
        }
        return { ...prev, mainImage: main, images: orderAssetsByMainImage(imgs, main) };
      });
      markDirty();
    } catch (err) {
      console.error('Upload failed', err);
      setSaveNotice(getReadableErrorMessage(err, 'Kunde inte ladda upp bilderna.'));
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
        {saveNotice ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            {saveNotice}
          </div>
        ) : null}

        <div className="flex gap-1 border-b border-gray-200 pb-0">
          {(
            [
              { id: 'kanaler' as const, label: 'Kanaler' },
              { id: 'produkt' as const, label: 'Produkt' },
              { id: 'texter' as const, label: 'Texter' },
              { id: 'media' as const, label: 'Media' },
              { id: 'priser' as const, label: 'Priser' },
              { id: 'kategori' as const, label: 'Kategori' },
              { id: 'detaljer' as const, label: 'Detaljer' },
              { id: 'statistik' as const, label: 'Statistik' },
            ] as const
          )
            .filter((t) => !isBatchMode || t.id !== 'statistik')
            .map((t) => (
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

        {/* Validation Summary */}
        {hasBlockingErrors && !isBatchMode && (
          <Card
            padding="sm"
            className="shadow-none px-0 sticky top-0 z-[5] bg-background/95 backdrop-blur-sm pb-2"
          >
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

        {/* Tab: Produkt */}
        {activeTab === 'produkt' && (
          <>
            <Card padding="sm" className="shadow-none px-0">
              <Heading level={3} className="mb-3">
                Produkt
              </Heading>
              <div className="max-w-2xl space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="product-status" className="mb-1">
                      Status
                    </Label>
                    <NativeSelect
                      id="product-status"
                      className="w-full"
                      value={formData.status}
                      onChange={(e) => {
                        const v = e.target.value as ProductStatus;
                        updateField('status', v);
                      }}
                    >
                      <option value="for sale">Till salu</option>
                      <option value="paused">Pausad</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="sku" className="mb-1">
                      Egen referens (SKU)
                    </Label>
                    <Input
                      id="sku"
                      type="text"
                      value={formData.sku}
                      onChange={(e) => updateField('sku', e.target.value)}
                      placeholder="Intern referens"
                      className={getFieldError('sku') ? 'border-red-500' : ''}
                    />
                    {getFieldError('sku') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('sku')?.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="privateName" className="mb-1">
                      Eget namn
                    </Label>
                    <Input
                      id="privateName"
                      type="text"
                      value={formData.privateName}
                      onChange={(e) => updateField('privateName', e.target.value)}
                      placeholder="Intern produktnamn"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vatRate" className="mb-1">
                      Moms
                    </Label>
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
                    <Label htmlFor="purchasePrice" className="mb-1">
                      Inköpspris
                    </Label>
                    <Input
                      id="purchasePrice"
                      inputMode="decimal"
                      type="text"
                      className="w-full text-right"
                      value={formData.purchasePrice === '' ? '' : String(formData.purchasePrice)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          purchasePrice: v === '' ? '' : Number(v.replace(',', '.')) || 0,
                        }));
                        markDirty();
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Heading level={4} className="mb-3 text-sm font-medium text-gray-700">
                    Lager
                  </Heading>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="quantity" className="mb-1">
                        Antal i lager *
                      </Label>
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
                        <p className="mt-1 text-sm text-red-600">
                          {getFieldError('quantity')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lagerplats" className="mb-1">
                        Lagerplats
                      </Label>
                      <Input
                        id="lagerplats"
                        type="text"
                        value={formData.lagerplats}
                        onChange={(e) => updateField('lagerplats', e.target.value)}
                        placeholder="Plats i lagret"
                      />
                    </div>
                    <div>
                      <Label htmlFor="wooBackorders" className="mb-1">
                        Restnotering (WooCommerce)
                      </Label>
                      <NativeSelect
                        id="wooBackorders"
                        value={formData.wooBackorders}
                        onChange={(e) => {
                          const v = e.target.value as 'no' | 'yes' | 'notify';
                          setFormData((prev) => ({ ...prev, wooBackorders: v }));
                          markDirty();
                        }}
                      >
                        <option value="no">Nej</option>
                        <option value="yes">Ja</option>
                        <option value="notify">Meddela kund</option>
                      </NativeSelect>
                    </div>
                    <div>
                      <Label htmlFor="lista" className="mb-1">
                        Lista
                      </Label>
                      <NativeSelect
                        id="lista"
                        value={formData.listId}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, listId: e.target.value }));
                          markDirty();
                        }}
                      >
                        <option value="">Huvudlista</option>
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="sm" className="shadow-none px-0">
              <Heading level={3} className="mb-3">
                Leveranstid per marknad
              </Heading>
              <p className="text-sm text-gray-600 mb-4">
                Frakt min/max (dagar) per marknad. Frivilligt – default från inställningar om tomt.
              </p>
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
                                const raw = e.target.value;
                                if (raw.trim() === '') {
                                  updateMarket(m.key, 'shippingMin', '');
                                  return;
                                }
                                const n = parseInt(raw, 10);
                                updateMarket(m.key, 'shippingMin', Number.isFinite(n) ? n : '');
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
                                const raw = e.target.value;
                                if (raw.trim() === '') {
                                  updateMarket(m.key, 'shippingMax', '');
                                  return;
                                }
                                const n = parseInt(raw, 10);
                                updateMarket(m.key, 'shippingMax', Number.isFinite(n) ? n : '');
                              }}
                              placeholder="3"
                              className="h-8 w-20"
                            />
                          </td>
                          <td className="py-1.5">
                            <NativeSelect
                              value={data.deliveryType || ''}
                              onChange={(e) =>
                                updateMarket(
                                  m.key,
                                  'deliveryType',
                                  (e.target.value || '') as DeliveryTypeValue,
                                )
                              }
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

        {/* Tab: Texter (per-market title/description + SEO/bulletpoints) */}
        {activeTab === 'texter' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Texter per marknad
            </Heading>
            <p className="text-sm text-gray-600 mb-4">
              Titel och beskrivning per språk. Välj land till vänster – innehållet visas till höger.
              Markera vilken text som ska användas som standard (fallback) när ett land saknar egen
              text.
            </p>
            <div className="flex gap-0 min-h-[320px]" style={{ minHeight: 'min(320px, 50vh)' }}>
              {/* Left: country list ~20% */}
              <div className="w-[20%] min-w-[120px] flex flex-col border-r border-gray-200 pr-2">
                {MARKETS.map((m) => {
                  const isStandard = formData.standardTextMarket === m.key;
                  const isSelected = selectedTextMarket === m.key;
                  return (
                    <div
                      key={m.key}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedTextMarket(m.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTextMarket(m.key);
                        }
                      }}
                    >
                      <span className="flex-1 text-left truncate">{m.label}</span>
                      <input
                        type="radio"
                        name="standardTextMarket"
                        checked={isStandard}
                        onChange={() => {
                          setFormData((prev) => ({ ...prev, standardTextMarket: m.key }));
                          markDirty();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 cursor-pointer"
                        aria-label={`Använd ${m.label} som standard`}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Right: content for selected country ~80% */}
              <div className="flex-1 min-w-0 pl-4 space-y-4">
                {(() => {
                  const m = MARKETS.find((x) => x.key === selectedTextMarket) ?? MARKETS[0];
                  const t = formData.texts[m.key];
                  const isStandard = formData.standardTextMarket === m.key;
                  const vf = t?.validFor ?? { cdon: true, fyndiq: true };
                  return (
                    <>
                      <div>
                        <Label className="mb-1">Titel {isStandard && '*'}</Label>
                        <Input
                          value={t?.title ?? ''}
                          onChange={(e) => updateText(m.key, 'title', e.target.value)}
                          placeholder={
                            isStandard ? 'Produkttitel' : 'Översättning eller tomt för standard'
                          }
                        />
                      </div>
                      <div>
                        <Label className="mb-1">Beskrivning</Label>
                        <RichTextEditor
                          value={t?.description ?? ''}
                          onChange={(html) => updateText(m.key, 'description', html)}
                          placeholder={
                            isStandard ? 'Produktbeskrivning' : 'Översättning eller tomt'
                          }
                          minHeight={180}
                          showSourceToggle
                        />
                      </div>
                      <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger className="group flex items-center gap-2 w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1 border-b border-transparent hover:border-gray-200 transition-colors">
                          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                          <span>Avancerat</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3 space-y-3">
                          <div>
                            <Label className="mb-1 text-gray-600">Bulletpoints</Label>
                            <Textarea
                              rows={4}
                              value={t?.bulletpoints ?? ''}
                              onChange={(e) => updateText(m.key, 'bulletpoints', e.target.value)}
                              placeholder="En punkt per rad"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 text-gray-600">Titel (SEO)</Label>
                            <Input
                              value={t?.titleSeo ?? ''}
                              onChange={(e) => updateText(m.key, 'titleSeo', e.target.value)}
                              placeholder="SEO-titel (t.ex. för sökresultat)"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 text-gray-600">Meta-beskrivning</Label>
                            <Textarea
                              rows={2}
                              value={t?.metaDesc ?? ''}
                              onChange={(e) => updateText(m.key, 'metaDesc', e.target.value)}
                              placeholder="Kort beskrivning för sökmotorer"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 text-gray-600">Meta-nyckelord</Label>
                            <Input
                              value={t?.metaKeywords ?? ''}
                              onChange={(e) => updateText(m.key, 'metaKeywords', e.target.value)}
                              placeholder="Nyckelord, kommaseparerade"
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      {!isStandard && (
                        <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-500 self-center">Skicka till:</span>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!vf.cdon}
                              onChange={(e) =>
                                updateText(m.key, 'validFor', { ...vf, cdon: e.target.checked })
                              }
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">CDON</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!vf.fyndiq}
                              onChange={(e) =>
                                updateText(m.key, 'validFor', { ...vf, fyndiq: e.target.checked })
                              }
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">Fyndiq</span>
                          </label>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Media — 11 slots: 1 main + 10 extra */}
        {activeTab === 'media' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Bilder
            </Heading>
            <p className="text-sm text-gray-600 mb-4">
              Huvudbild (1 stor) + upp till 10 extra. Ladda upp eller ange URL. Stjärna = flytta
              till huvudbild.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Main image — large slot */}
              <div className="col-span-2 row-span-2 md:col-span-2 md:row-span-2">
                <div className="relative aspect-square rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 group">
                  {formData.mainImage ? (
                    <>
                      <img
                        src={getProductImagePreviewUrl(mainImageAsset) || formData.mainImage}
                        alt="Huvudbild"
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => openOriginalImage(mainImageAsset, formData.mainImage)}
                        title="Öppna original"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={removeMainImage}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-white font-medium px-2 py-1 bg-blue-600 rounded">
                          Huvudbild
                        </span>
                      </div>
                      {getProductImageOriginalFilename(mainImageAsset) ? (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] px-2 py-1 truncate">
                          {getProductImageOriginalFilename(mainImageAsset)}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-full cursor-pointer p-4">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500 text-center">Huvudbild</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => addImageFromUpload(e.target.files)}
                      />
                    </label>
                  )}
                </div>
              </div>
              {/* 10 smaller slots */}
              {Array.from({ length: 10 }).map((_, idx) => {
                const asset = galleryImages[idx];
                const img = getProductImagePreviewUrl(asset);
                return (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50 group"
                  >
                    {img ? (
                      <>
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => openOriginalImage(asset, img)}
                          title="Öppna original"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="p-1 h-8 w-8"
                            onClick={() => promoteToMain(idx)}
                            title="Flytta till huvudbild"
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="p-1 h-8 w-8"
                            onClick={() => removeImage(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {getProductImageOriginalFilename(asset) ? (
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] px-2 py-1 truncate">
                            {getProductImageOriginalFilename(asset)}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      idx === galleryImages.length && (
                        <label className="flex flex-col items-center justify-center h-full cursor-pointer p-2">
                          <Upload className="w-6 h-6 text-gray-400" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => addImageFromUpload(e.target.files)}
                          />
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
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={mediaUploading}
                  onChange={(e) => addImageFromUpload(e.target.files)}
                />
              </label>
              <span className="text-xs text-gray-500">eller</span>
              <div className="flex gap-2 flex-1 min-w-0 max-w-md">
                <Input
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  placeholder="Bild-URL"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addImage();
                    }
                  }}
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
        {activeTab === 'kanaler' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Kanaler
            </Heading>
            <p className="text-sm text-gray-600 mb-4">
              Välj vilka kanaler/instanser produkten ska pushas till. Vid Spara publiceras ändringar
              direkt (Publish/Delete).
            </p>
            {channelTargetsLoading ? (
              <p className="text-sm text-gray-500">Laddar…</p>
            ) : channelInstances.length === 0 ? (
              <p className="text-sm text-gray-500">
                Inga kanaler konfigurerade. Gå till pluginet <strong>Channels</strong> och lägg till
                WooCommerce, CDON eller Fyndiq.
              </p>
            ) : (
              <div className="space-y-3">
                {['woocommerce', 'cdon', 'fyndiq'].map((ch) => {
                  const insts = channelInstances.filter(
                    (i) => String(i.channel).toLowerCase() === ch,
                  );
                  if (insts.length === 0) {
                    return null;
                  }
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
                            ? inst.market
                              ? `${inst.instanceKey} · ${inst.market}`
                              : inst.instanceKey
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
                                  if (!selectable) {
                                    return;
                                  }
                                  setSelectedTargetKeys((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(key)) {
                                      next.delete(key);
                                    } else {
                                      next.add(key);
                                    }
                                    return next;
                                  });
                                  markDirty();
                                }}
                                className="rounded border-gray-300"
                              />
                              <div>
                                <span className="text-sm font-medium">{label}</span>
                                <span
                                  className={`text-xs ml-2 ${selectable ? 'text-gray-500' : 'text-amber-600'}`}
                                >
                                  {sub}
                                </span>
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
            {!isBatchMode &&
              currentProduct?.id &&
              channelInstances.some((i) => String(i.channel).toLowerCase() === 'cdon') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cdonDiagnoseLoading}
                    onClick={async () => {
                      setCdonDiagnoseLoading(true);
                      setCdonDiagnoseResult(null);
                      try {
                        const r = await cdonApi.exportProducts([currentProduct], {
                          markets: ['se', 'dk', 'fi'],
                          diagnose: true,
                        });
                        setCdonDiagnoseResult((r as any)?.diagnose ?? r);
                      } catch (e) {
                        setCdonDiagnoseResult(
                          (e as any)?.diagnose ?? { error: String((e as any)?.message ?? e) },
                        );
                      } finally {
                        setCdonDiagnoseLoading(false);
                      }
                    }}
                  >
                    {cdonDiagnoseLoading ? 'Kör…' : 'Kör CDON-diagnostik'}
                  </Button>
                </div>
              )}
          </Card>
        )}

        {/* Tab: Priser — Baspris + en rad per butik/marknad med Pris per butik, Reapris/Originalpris */}
        {activeTab === 'priser' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Priser
            </Heading>
            {/* Baspris + Valuta + Uppdatera med dagens kurser på samma rad */}
            <div className="flex flex-wrap items-end gap-3 max-w-2xl mb-4">
              <div>
                <Label htmlFor="priceAmount" className="mb-1">
                  Baspris
                </Label>
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
                  <p className="mt-1 text-sm text-red-600">
                    {getFieldError('priceAmount')?.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="currency" className="mb-1">
                  Valuta
                </Label>
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
                      const baseAmount =
                        typeof formData.priceAmount === 'number' &&
                        Number.isFinite(formData.priceAmount)
                          ? formData.priceAmount
                          : 0;
                      const baseCur = (formData.currency || 'SEK').trim().toUpperCase();
                      if (!rates.EUR || !rates.DKK || !rates.NOK) {
                        return;
                      }
                      const dkk = rates.DKK;
                      const eur = rates.EUR;
                      const nok = rates.NOK;
                      let baseSEK = baseAmount;
                      if (baseCur === 'EUR') {
                        baseSEK = baseAmount * eur;
                      } else if (baseCur === 'DKK') {
                        baseSEK = baseAmount * dkk;
                      } else if (baseCur === 'NOK') {
                        baseSEK = baseAmount * nok;
                      } else if (baseCur !== 'SEK') {
                        return;
                      }
                      const round = (n: number, decimals: number) => {
                        if (decimals === 0) {
                          return Math.round(n);
                        }
                        const f = 10 ** decimals;
                        return Math.round(n * f) / f;
                      };
                      const amountsByMarket: Record<string, string> = {
                        se: String(round(baseSEK, 0)),
                        dk: String(round(baseSEK / dkk, 0)),
                        fi: String(round(baseSEK / eur, 2)),
                        no: String(round(baseSEK / nok, 0)),
                      };
                      const pricerInstances = channelInstances.filter(
                        (i) =>
                          ['cdon', 'fyndiq', 'woocommerce'].includes(
                            String(i.channel).toLowerCase(),
                          ) && hasValidMarket(i),
                      );
                      setChannelPriceOverrides((prev) => {
                        const next = { ...prev };
                        for (const inst of pricerInstances) {
                          const id = String(inst.id);
                          const ch = String(inst.channel).toLowerCase();
                          let amount = '';
                          if (ch === 'woocommerce') {
                            amount = String(round(baseSEK, 0));
                          } else {
                            const rawMk = (inst.market ?? '').toLowerCase().slice(0, 2);
                            const mk = rawMk === 'sv' ? 'se' : rawMk;
                            amount = amountsByMarket[mk] ?? amountsByMarket.se ?? '';
                          }
                          if (amount) {
                            next[id] = {
                              ...(prev[id] ?? { priceAmount: '', salePrice: '' }),
                              priceAmount: amount,
                            };
                          }
                        }
                        return next;
                      });
                      if (rates.observedAt) {
                        setLastFxObservedAt(rates.observedAt);
                      }
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
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pris per butik / marknad
                </div>
                <p className="text-xs text-gray-500 mb-1.5">
                  Tomt pris = använder Baspris. Fyll i för att sätta ett eget pris för denna butik.
                </p>
                {channelInstances
                  .filter(
                    (i) =>
                      ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()) &&
                      hasValidMarket(i),
                  )
                  .sort((a, b) => {
                    const chA = String(a.channel).toLowerCase();
                    const chB = String(b.channel).toLowerCase();
                    const channelOrder = (c: string) =>
                      c === 'woocommerce' ? 0 : c === 'cdon' ? 1 : 2;
                    if (channelOrder(chA) !== channelOrder(chB)) {
                      return channelOrder(chA) - channelOrder(chB);
                    }
                    const toMk = (m: string) => {
                      const s = (m || 'se').toLowerCase().slice(0, 2);
                      return s === 'sv' ? 'se' : s;
                    };
                    const marketOrder: Record<string, number> = { se: 0, dk: 1, fi: 2, no: 3 };
                    return (
                      (marketOrder[toMk(a.market || '')] ?? 4) -
                      (marketOrder[toMk(b.market || '')] ?? 4)
                    );
                  })
                  .map((inst) => {
                    const id = String(inst.id);
                    const po = channelPriceOverrides[id] ?? { priceAmount: '', salePrice: '' };
                    const ch = String(inst.channel).toLowerCase();
                    const channelName =
                      ch === 'woocommerce'
                        ? 'Webbshop'
                        : ch === 'cdon'
                          ? 'CDON'
                          : ch === 'fyndiq'
                            ? 'Fyndiq'
                            : inst.channel;
                    const part = inst.label || inst.instanceKey || inst.market || '';
                    const label = part ? `${channelName} · ${part}` : channelName;
                    const rawMk = (inst.market ?? '').toLowerCase().slice(0, 2);
                    const mk: MarketKey =
                      rawMk === 'sv'
                        ? 'se'
                        : ((['se', 'dk', 'fi', 'no'].includes(rawMk) ? rawMk : 'se') as MarketKey);
                    const m = MARKETS.find((x) => x.key === mk) ?? MARKETS[0];
                    const isFyndiq = String(inst.channel).toLowerCase() === 'fyndiq';
                    const isWoo = String(inst.channel).toLowerCase() === 'woocommerce';
                    return (
                      <div
                        key={inst.id}
                        className="flex flex-wrap items-center gap-2 gap-y-1.5 py-1 border-b border-gray-100 last:border-0"
                      >
                        <div className="w-[200px] min-w-[200px] shrink-0">
                          <span className="text-sm font-medium block truncate" title={label}>
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-500">Pris</Label>
                          <Input
                            inputMode="decimal"
                            type="text"
                            className="w-[8ch] text-right"
                            value={po.priceAmount}
                            placeholder=""
                            onChange={(e) => {
                              const v = e.target.value;
                              setChannelPriceOverrides((prev) => ({
                                ...prev,
                                [id]: {
                                  ...(prev[id] ?? { priceAmount: '', salePrice: '' }),
                                  priceAmount: v,
                                },
                              }));
                              markDirty();
                            }}
                          />
                          <span className="text-xs text-gray-500 w-10">{m.currency}</span>
                        </div>
                        {(isFyndiq || isWoo) && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-500">
                              {isFyndiq ? 'Originalpris' : 'Reapris'}
                            </Label>
                            <Input
                              inputMode="decimal"
                              type="text"
                              className="w-[8ch] text-right"
                              value={po.salePrice}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChannelPriceOverrides((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...(prev[id] ?? { priceAmount: '', salePrice: '' }),
                                    salePrice: v,
                                  },
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
        {activeTab === 'kategori' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Kategorier
            </Heading>
            <p className="text-sm text-gray-600 mb-4">
              Välj kategori per kanal. Listorna hämtas från CDON, Fyndiq respektive WooCommerce.
            </p>
            {categoryTabInstances.length > 0 && (
              <div className="space-y-3">
                {categoryTabInstances.map((inst) => {
                  const isWoo = String(inst.channel).toLowerCase() === 'woocommerce';
                  const rawCatVal = isWoo
                    ? formData.channelCategories?.woocommerce?.[inst.instanceKey]
                    : inst.channel === 'cdon'
                      ? formData.channelCategories?.cdon
                      : formData.channelCategories?.fyndiq;
                  const label = inst.label;
                  const list = channelCategoriesList[inst.id] ?? [];
                  const loading = channelCategoriesLoading[inst.id];
                  const error = channelCategoriesError[inst.id];
                  const wooCats: string[] = isWoo
                    ? Array.isArray(rawCatVal)
                      ? rawCatVal
                      : rawCatVal
                        ? [rawCatVal]
                        : []
                    : [];
                  const cat = !isWoo ? (typeof rawCatVal === 'string' ? rawCatVal : '') : '';
                  const wooTree = isWoo
                    ? buildWooCategoryTree(
                        list as Array<{ id: string; name: string; parent?: number }>,
                      )
                    : [];
                  const expandedSet = wooExpandedIds[inst.id] ?? new Set<string>();
                  const setExpanded = (id: string, open: boolean) => {
                    setWooExpandedIds((prev) => {
                      const next = new Set(prev[inst.id] ?? []);
                      if (open) {
                        next.add(id);
                      } else {
                        next.delete(id);
                      }
                      return { ...prev, [inst.id]: next };
                    });
                  };
                  const channelTree = isWoo
                    ? []
                    : String(inst.channel).toLowerCase() === 'fyndiq'
                      ? buildFyndiqCategoryTree(list)
                      : buildChannelCategoryTree(list);
                  const channelRealIds = !isWoo
                    ? new Set(list.map((x) => x.id))
                    : new Set<string>();
                  const channelExpandedSet =
                    channelCategoryExpandedIds[inst.id] ?? new Set<string>();
                  const setChannelExpanded = (id: string, open: boolean) => {
                    setChannelCategoryExpandedIds((prev) => {
                      const next = new Set(prev[inst.id] ?? []);
                      if (open) {
                        next.add(id);
                      } else {
                        next.delete(id);
                      }
                      return { ...prev, [inst.id]: next };
                    });
                  };
                  const setChannelCategory = (categoryId: string) => {
                    if (inst.channel === 'cdon') {
                      setFormData((prev) => ({
                        ...prev,
                        channelCategories: { ...prev.channelCategories, cdon: categoryId },
                      }));
                    } else if (inst.channel === 'fyndiq') {
                      setFormData((prev) => ({
                        ...prev,
                        channelCategories: { ...prev.channelCategories, fyndiq: categoryId },
                      }));
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
                    if (wooCats.includes(id)) {
                      return;
                    }
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
                    <div
                      key={inst.id}
                      className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3"
                    >
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
                            onOpenChange={(open) =>
                              setWooPanelOpen((prev) => ({ ...prev, [inst.id]: open }))
                            }
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeWooCategory(id);
                                        }}
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
                                          setCategorySearch((prev) => ({
                                            ...prev,
                                            [inst.id]: e.target.value,
                                          }))
                                        }
                                      />
                                    </div>
                                    {(categorySearch[inst.id] ?? '').trim() !== '' ? (
                                      <WooCategorySearchList
                                        list={
                                          list as Array<{
                                            id: string;
                                            name: string;
                                            parent?: number;
                                          }>
                                        }
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
                                            onToggle={(id, checked) =>
                                              checked ? addWooCategory(id) : removeWooCategory(id)
                                            }
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
                            onOpenChange={(open) =>
                              setChannelCategoryPanelOpen((prev) => ({ ...prev, [inst.id]: open }))
                            }
                          >
                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm border border-gray-200 rounded-md px-3 py-2 bg-gray-50/50 hover:bg-gray-100 min-h-0">
                              {(channelCategoryPanelOpen[inst.id] ?? false) ? (
                                <ChevronDown className="w-4 h-4 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 shrink-0" />
                              )}
                              <span
                                className={`flex-1 min-w-0 truncate ${!cat ? 'text-gray-500' : ''}`}
                              >
                                {cat
                                  ? (() => {
                                      const item = list.find((x) => x.id === cat);
                                      const name = item?.name ?? cat;
                                      const isFyndiq =
                                        String(inst.channel).toLowerCase() === 'fyndiq';
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
                                      setCategorySearch((prev) => ({
                                        ...prev,
                                        [inst.id]: e.target.value,
                                      }))
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
                                          if (id && channelRealIds.has(id)) {
                                            setChannelCategory(id);
                                          }
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
                          <p className="text-sm text-gray-500 py-1">
                            Inga kategorier tillgängliga.
                          </p>
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
        {activeTab === 'detaljer' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Detaljer
            </Heading>
            <p className="text-sm text-gray-600 mb-4">
              EAN, Märke, Tillverkarens artikelnummer m.m. Märke är obligatorisk.
            </p>
            {(() => {
              const p = currentProduct as {
                groupId?: string | null;
                parentProductId?: string | null;
                groupVariationType?: string | null;
              } | null;
              const groupId = p?.groupId ?? null;
              const parentId = p?.parentProductId ?? null;
              const type = p?.groupVariationType ?? null;
              const isGrouped =
                (groupId != null && String(groupId).trim() !== '') ||
                (parentId != null && String(parentId).trim() !== '') ||
                (type != null && ['color', 'size', 'model'].includes(String(type).toLowerCase()));
              const typeLabel =
                type === 'color'
                  ? 'Färg'
                  : type === 'size'
                    ? 'Storlek'
                    : type === 'model'
                      ? 'Modell'
                      : (type ?? '—');
              return (
                <div className="mb-4 p-3 rounded-md bg-gray-50 border border-gray-200">
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Gruppering</Label>
                  <div className="text-sm text-gray-800">
                    {isGrouped ? (
                      <>
                        Group: {groupId ?? '—'} · Parent: {parentId ?? 'Huvudprodukt'} · Typ:{' '}
                        {typeLabel}
                      </>
                    ) : (
                      'Not grouped'
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div>
                <Label htmlFor="ean" className="mb-1">
                  EAN
                </Label>
                <Input
                  id="ean"
                  type="text"
                  inputMode="numeric"
                  value={formData.ean}
                  onChange={(e) => updateField('ean', e.target.value)}
                  placeholder="8–14 siffror"
                  className={getFieldError('ean') ? 'border-yellow-500' : ''}
                />
                {getFieldError('ean') && (
                  <p className="mt-1 text-sm text-yellow-600">{getFieldError('ean')?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="gtin" className="mb-1">
                  GTIN
                </Label>
                <Input
                  id="gtin"
                  type="text"
                  inputMode="numeric"
                  value={formData.gtin}
                  onChange={(e) => updateField('gtin', e.target.value)}
                  placeholder="Fylls i automatiskt av EAN om tomt (kan överridas, t.ex. 12 siffror)"
                  className={getFieldError('gtin') ? 'border-yellow-500' : ''}
                />
                {getFieldError('gtin') && (
                  <p className="mt-1 text-sm text-yellow-600">{getFieldError('gtin')?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="knNumber" className="mb-1">
                  KN-nummer
                </Label>
                <Input
                  id="knNumber"
                  type="text"
                  value={formData.knNumber}
                  onChange={(e) => updateField('knNumber', e.target.value)}
                  placeholder="Tullklassificering (t.ex. 6109100000)"
                  maxLength={48}
                />
              </div>
              <div>
                <Label htmlFor="brand" className="mb-1">
                  Märke *
                </Label>
                <div className="flex gap-2">
                  <NativeSelect
                    id="brand"
                    value={formData.brandId || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const item = brands.find((b) => b.id === v);
                      setFormData((prev) => ({
                        ...prev,
                        brandId: v || '',
                        brand: item?.name ?? '',
                      }));
                      markDirty();
                      clearValidationErrors();
                    }}
                    className={`flex-1 ${getFieldError('brand') ? 'border-red-500' : ''}`}
                  >
                    <option value="">— Välj märke —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt('Nytt märke:');
                      if (!name?.trim()) {
                        return;
                      }
                      try {
                        const item = await productsApi.createBrand(name.trim());
                        setBrands((prev) =>
                          [...prev.filter((p) => p.id !== item.id), item].sort((a, b) =>
                            a.name.localeCompare(b.name),
                          ),
                        );
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
                {getFieldError('brand') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('brand')?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="supplier" className="mb-1">
                  Leverantör
                </Label>
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
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt('Ny leverantör:');
                      if (!name?.trim()) {
                        return;
                      }
                      try {
                        const item = await productsApi.createSupplier(name.trim());
                        setSuppliers((prev) =>
                          [...prev.filter((p) => p.id !== item.id), item].sort((a, b) =>
                            a.name.localeCompare(b.name),
                          ),
                        );
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
                <Label htmlFor="manufacturer" className="mb-1">
                  Tillverkare
                </Label>
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
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const name = window.prompt('Ny tillverkare:');
                      if (!name?.trim()) {
                        return;
                      }
                      try {
                        const item = await productsApi.createManufacturer(name.trim());
                        setManufacturers((prev) =>
                          [...prev.filter((p) => p.id !== item.id), item].sort((a, b) =>
                            a.name.localeCompare(b.name),
                          ),
                        );
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
                <Label htmlFor="mpn" className="mb-1">
                  Tillverkarens artikelnummer (MPN)
                </Label>
                <Input
                  id="mpn"
                  type="text"
                  value={formData.mpn}
                  onChange={(e) => updateField('mpn', e.target.value)}
                  placeholder="Fylls i automatiskt från SKU om tomt"
                />
              </div>
              <div>
                <Label htmlFor="color" className="mb-1">
                  Färg
                </Label>
                <NativeSelect
                  id="color"
                  value={formData.color || ''}
                  onChange={(e) => updateField('color', e.target.value)}
                >
                  {COLOR_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="colorText" className="mb-1">
                  Färgtext
                </Label>
                <Input
                  id="colorText"
                  type="text"
                  value={formData.colorText}
                  onChange={(e) => updateField('colorText', e.target.value)}
                  placeholder="Fri text för färg"
                />
              </div>
              <div>
                <Label htmlFor="size" className="mb-1">
                  Storlek
                </Label>
                <NativeSelect
                  id="size"
                  value={formData.size || ''}
                  onChange={(e) => updateField('size', e.target.value)}
                >
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="sizeText" className="mb-1">
                  Storlekstext
                </Label>
                <Input
                  id="sizeText"
                  type="text"
                  value={formData.sizeText}
                  onChange={(e) => updateField('sizeText', e.target.value)}
                  placeholder="Fri text för storlek"
                />
              </div>
              <div>
                <Label htmlFor="material" className="mb-1">
                  Material (fritext)
                </Label>
                <Input
                  id="material"
                  type="text"
                  value={formData.material}
                  onChange={(e) => updateField('material', e.target.value)}
                  placeholder="T.ex. Bomull, polyester"
                />
              </div>
              <div>
                <Label htmlFor="patternText" className="mb-1">
                  Mönster (fritext)
                </Label>
                <Input
                  id="patternText"
                  type="text"
                  value={formData.patternText}
                  onChange={(e) => updateField('patternText', e.target.value)}
                  placeholder="Mönster fritext när preset saknas"
                />
              </div>
              <div>
                <Label htmlFor="model" className="mb-1">
                  Modell
                </Label>
                <Input
                  id="model"
                  type="text"
                  value={formData.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  placeholder="För varianter"
                />
              </div>
              <div>
                <Label htmlFor="pattern" className="mb-1">
                  Fyndiq-mönster (preset)
                </Label>
                <NativeSelect
                  id="pattern"
                  value={formData.pattern || ''}
                  onChange={(e) => updateField('pattern', e.target.value)}
                >
                  {PATTERN_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="condition" className="mb-1">
                  Skick
                </Label>
                <NativeSelect
                  id="condition"
                  value={formData.condition || 'new'}
                  onChange={(e) => {
                    const v = e.target.value as 'new' | 'used' | 'refurb';
                    updateField('condition', v || 'new');
                  }}
                >
                  {CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="shippedFrom" className="mb-1">
                  Skickas från (CDON)
                </Label>
                <NativeSelect
                  id="shippedFrom"
                  value={formData.shippedFrom || 'EU'}
                  onChange={(e) =>
                    updateField('shippedFrom', e.target.value === 'NON_EU' ? 'NON_EU' : 'EU')
                  }
                >
                  {SHIPPED_FROM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="mb-1">Tillgänglighetsdatum (CDON)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MARKETS.map((m) => (
                    <div key={m.key}>
                      <label className="text-xs text-neutral-500">{m.label}</label>
                      <Input
                        type="date"
                        value={formData.availabilityDates?.[m.key] ?? ''}
                        onChange={(e) =>
                          updateField('availabilityDates', {
                            ...formData.availabilityDates,
                            [m.key]: e.target.value,
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="volume" className="mb-1">
                  Volym
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="volume"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.volume === '' ? '' : formData.volume}
                    onChange={(e) =>
                      updateField('volume', e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="0"
                    className="flex-1"
                  />
                  <NativeSelect
                    id="volumeUnit"
                    value={formData.volumeUnit || ''}
                    onChange={(e) => updateField('volumeUnit', e.target.value)}
                    className="w-24"
                  >
                    {VOLUME_UNIT_OPTIONS.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div>
                <Label htmlFor="weight" className="mb-1">
                  Vikt
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="weight"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.weight === '' ? '' : formData.weight}
                    onChange={(e) =>
                      updateField('weight', e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="0"
                    className="flex-1"
                  />
                  <NativeSelect
                    id="weightUnit"
                    value={formData.weightUnit || 'g'}
                    onChange={(e) =>
                      updateField('weightUnit', e.target.value === 'kg' ? 'kg' : 'g')
                    }
                    className="w-20"
                  >
                    {WEIGHT_UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div>
                <Label htmlFor="shoeSizeEu" className="mb-1">
                  Skostorlek EU
                </Label>
                <Input
                  id="shoeSizeEu"
                  type="text"
                  value={formData.shoeSizeEu || ''}
                  onChange={(e) => updateField('shoeSizeEu', e.target.value)}
                  placeholder="t.ex. 42"
                />
              </div>
              <div>
                <Label htmlFor="lengthCm" className="mb-1">
                  Längd (cm)
                </Label>
                <Input
                  id="lengthCm"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.lengthCm === '' ? '' : formData.lengthCm}
                  onChange={(e) =>
                    updateField('lengthCm', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="widthCm" className="mb-1">
                  Bredd (cm)
                </Label>
                <Input
                  id="widthCm"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.widthCm === '' ? '' : formData.widthCm}
                  onChange={(e) =>
                    updateField('widthCm', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="heightCm" className="mb-1">
                  Höjd (cm)
                </Label>
                <Input
                  id="heightCm"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.heightCm === '' ? '' : formData.heightCm}
                  onChange={(e) =>
                    updateField('heightCm', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="depthCm" className="mb-1">
                  Djup (cm)
                </Label>
                <Input
                  id="depthCm"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.depthCm === '' ? '' : formData.depthCm}
                  onChange={(e) =>
                    updateField('depthCm', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes" className="mb-1">
                  Anteckningar
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Interna anteckningar"
                  rows={3}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Tab: Statistik */}
        {!isBatchMode && activeTab === 'statistik' && (
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3">
              Statistik
            </Heading>
            {!currentProduct?.id ? (
              <p className="text-sm text-gray-500">Spara produkten först för att se statistik.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Antal sålda</div>
                    <div className="text-lg font-semibold">
                      {currentProduct?.quantitySold != null ? currentProduct.quantitySold : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Skapad datum</div>
                    <div className="text-lg font-semibold">
                      {currentProduct?.sourceCreatedAt
                        ? new Date(currentProduct.sourceCreatedAt).toLocaleDateString('sv-SE')
                        : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xs text-gray-500">Senast såld</div>
                    <div className="text-lg font-semibold">
                      {currentProduct?.lastSoldAt
                        ? new Date(currentProduct.lastSoldAt).toLocaleDateString('sv-SE')
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-600">Period:</span>
                  <NativeSelect
                    value={statsRange}
                    onChange={(e) =>
                      setStatsRange((e.target.value || '30d') as '7d' | '30d' | '3m' | 'all')
                    }
                  >
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
                        <div className="text-xs text-gray-500">Antal sålda (period)</div>
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
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Aktivitetstidslinje
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {stats.timeline?.length ? (
                          stats.timeline.map((ev, i) => (
                            <div
                              key={i}
                              className="flex justify-between items-center py-2 border-b border-gray-100 text-sm"
                            >
                              <span>
                                <strong>{ev.quantity} st såld</strong> på {ev.channel}, order{' '}
                                {String(ev.orderId).slice(0, 8)}…
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

      <Dialog
        open={batchPreviewOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBatchPreviewOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Förhandsgranskning – batch</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Nedan visas bara det du ändrat (oförändrade fält skickas inte). Samma ändringar
            tillämpas på samtliga {batchProductIds.length} markerade produkter. På Kanaler gäller
            endast de butiker du kryssat för — övriga butiker i listan påverkas inte.
          </p>
          <ul className="mt-2 max-h-64 overflow-y-auto rounded border bg-muted/40 p-3 text-sm font-mono space-y-1">
            {batchPreviewLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBatchPreviewOpen(false);
                setBatchPendingChanges(null);
              }}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              onClick={() => void commitBatchSave()}
              disabled={isCurrentlySubmitting}
            >
              Bekräfta och spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cdonDiagnoseResult != null}
        onOpenChange={(o) => !o && setCdonDiagnoseResult(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>CDON-diagnostik</DialogTitle>
          </DialogHeader>
          <pre className="text-xs overflow-auto p-4 bg-gray-50 rounded border flex-1 min-h-0">
            {JSON.stringify(cdonDiagnoseResult, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
};
