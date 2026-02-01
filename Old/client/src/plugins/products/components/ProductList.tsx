import { Plus, Edit, Eye, ChevronUp, ChevronDown, Search, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';

import { Badge } from '@/core/ui/Badge';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useProducts } from '../hooks/useProducts';
import { useWooCommerce } from '@/plugins/woocommerce-products/context/WooCommerceContext';
import { channelsApi } from '@/plugins/channels/api/channelsApi';

type SortField = 'productNumber' | 'title' | 'status' | 'quantity' | 'price' | 'sku';
type SortOrder = 'asc' | 'desc';

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
    openProductPanel,
    openProductForEdit,
    openProductForView,
    // selection API
    selectedProductIds,
    toggleProductSelected,
    selectAllProducts,
    clearProductSelection,
    // NEW bulk delete från context
    deleteProducts, // <— added in ProductContext
  } = useProducts();

  const {
    settings: wooSettings,
    exportProducts: exportToWoo,
    exporting: wooExporting,
    lastExportResult: wooLastResult,
  } = useWooCommerce();

  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('productNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isMobileView, setIsMobileView] = useState(false);

  // Publish-modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishWooChecked, setPublishWooChecked] = useState(true);

  // Delete-modal state (NY)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFromWooChecked, setDeleteFromWooChecked] = useState(false);
  const [alsoDeleteFromPlatform, setAlsoDeleteFromPlatform] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [lastDeleteResult, setLastDeleteResult] = useState<{
    woo?: { ok: boolean; deleted: number; endpoint?: string; errors?: string[] };
    platform?: { ok: boolean; deleted: number };
  } | null>(null);

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

  // Robust row ID: fall back genom vanliga fält
  const normalize = (p: any) => {
    const rowId =
      p?.id ??
      p?._id ??
      p?.uuid ??
      p?.productId ??
      p?.contactId ??
      p?.contactNumber ??
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
        String(p.sku).toLowerCase().includes(needle)
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
        case 'price':
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

  // Valda produkter (faktiska objekt)
  const selectedProducts = useMemo(() => {
    const set = new Set(selectedProductIds.map(String));
    return products.filter((p: any) => set.has(String(p?.id)));
  }, [products, selectedProductIds]);

  // ---------- Selection helpers ----------
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
  // ---------------------------------------

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
  const isWooConfigured = !!(
    wooSettings?.storeUrl &&
    wooSettings?.consumerKey &&
    wooSettings?.consumerSecret
  );

  // Delete action (modal confirm)
  const runDeleteFlow = async () => {
    if (selectedProductIds.length === 0) return;
    setDeleting(true);

    const attemptedPlatformIds = Array.from(new Set(selectedProductIds.map(String))).filter(Boolean);

    try {
      const nextResult: {
        woo?: { ok: boolean; deleted: number; endpoint?: string; errors?: string[] };
        platform?: { ok: boolean; deleted: number };
      } = {};

      // 1) Kanaler/butiker
      if (deleteFromWooChecked && isWooConfigured) {
        const { woocommerceApi } = await import('@/plugins/woocommerce-products/api/woocommerceApi');

        // Payload-strategi: använd externalIds när möjligt (channel_product_map.external_id),
        // annars fallback till SKU.
        const externalIds: number[] = [];
        const skus: string[] = [];

        await Promise.all(
          selectedProducts.map(async (p: any) => {
            const productId = String(p?.id);
            const sku = String(p?.sku || '').trim();

            try {
              const resp = await channelsApi.getProductMap({
                productId,
                channel: 'woocommerce',
              });

              const ext = resp?.row?.external_id;
              const asNum = ext != null ? Number(ext) : NaN;
              if (Number.isFinite(asNum)) {
                externalIds.push(asNum);
                return;
              }
            } catch (_err) {
              void _err;
            }

            if (sku) skus.push(sku);
          }),
        );

        const wooResp = await woocommerceApi.deleteProducts({
          externalIds: externalIds.length ? externalIds : undefined,
          skus: skus.length ? skus : undefined,
        });

        // wooResp förväntas vara { ok, endpoint, deleted, items: [...] }
        const errors = Array.isArray(wooResp?.items)
          ? wooResp.items
              .filter((x: any) => x?.status === 'error')
              .map((x: any) => String(x?.message || 'Delete failed'))
          : [];

        nextResult.woo = {
          ok: errors.length === 0,
          deleted: Number(wooResp?.deleted || 0),
          endpoint: wooResp?.endpoint,
          errors: errors.length ? errors.slice(0, 5) : undefined, // undvik jättelånga listor
        };
      }

      // 2) Plattform (vår DB/app)
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
      console.error('Bulk delete failed:', err);

      // Spara ett “failed”-resultat så du får banner även vid exception
      setLastDeleteResult({
        woo: deleteFromWooChecked ? { ok: false, deleted: 0, errors: [String(err?.message || err)] } : undefined,
        platform: alsoDeleteFromPlatform ? { ok: false, deleted: 0 } : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>
            Products ({filtered}
            {filtered !== total ? ` of ${total}` : ''})
          </Heading>
          <Text variant="caption">Manage your product catalog</Text>
          {selectedProductIds.length > 0 && (
            <div className="mt-2 text-sm flex items-center flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {selectedProductIds.length} selected
              </span>
              <button
                className="underline text-blue-700"
                onClick={() => clearProductSelection()}
              >
                Clear selection
              </button>

              {/* Publish… */}
              <button
                className="ml-1 inline-flex items-center px-3 py-1.5 rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm"
                onClick={() => {
                  setPublishWooChecked(isWooConfigured);
                  setShowPublishModal(true);
                }}
              >
                Publish…
              </button>

              {/* Delete… (NY) */}
              <button
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-red-600 text-red-700 hover:bg-red-50 text-sm"
                onClick={() => {
                  setDeleteFromWooChecked(isWooConfigured);
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by title, SKU or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* Export-feedback efter körning */}
      {wooLastResult && (
        <div className="mb-4">
          <div
            className={`rounded-md border p-3 text-sm ${
              wooLastResult.ok
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">
              {wooLastResult.ok ? 'Publish completed' : 'Publish failed'}
            </div>
            <div className="mt-1 text-xs break-all">Endpoint: {wooLastResult.endpoint}</div>
            <div className="mt-2 text-sm">
              Created:{' '}
              {Array.isArray(wooLastResult.result?.create)
                ? wooLastResult.result!.create.length
                : 0}{' '}
              · Updated:{' '}
              {Array.isArray(wooLastResult.result?.update)
                ? wooLastResult.result!.update.length
                : 0}
            </div>
          </div>
        </div>
      )}

      {/* Delete-feedback efter körning */}
      {lastDeleteResult && (
        <div className="mb-4">
          <div
            className={`rounded-md border p-3 text-sm ${
              (lastDeleteResult.woo?.ok ?? true) && (lastDeleteResult.platform?.ok ?? true)
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">
              {(lastDeleteResult.woo?.ok ?? true) && (lastDeleteResult.platform?.ok ?? true)
                ? 'Delete completed'
                : 'Delete failed'}
            </div>

            {lastDeleteResult.woo && (
              <div className="mt-2">
                <div className="text-sm">
                  WooCommerce deleted: {lastDeleteResult.woo.deleted}
                </div>
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

            {lastDeleteResult.platform && (
              <div className="mt-2 text-sm">
                Platform deleted: {lastDeleteResult.platform.deleted}
              </div>
            )}
          </div>
        </div>
      )}

      <Card>
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {/* selection header */}
                <th className="w-10 px-4 py-3">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('productNumber')}
                >
                  <div className="flex items-center gap-1">
                    #<SortIcon field="productNumber" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    Title<SortIcon field="title" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('sku')}
                >
                  <div className="flex items-center gap-1">
                    SKU<SortIcon field="sku" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status<SortIcon field="status" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center gap-1">
                    Qty<SortIcon field="quantity" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center gap-1">
                    Price<SortIcon field="price" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm
                      ? 'No products found matching your search.'
                      : 'No products yet. Click "Add Product" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((p: any, idx: number) => {
                  const raw = p.raw;
                  const isSelected = selectedProductIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
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
                      {/* row checkbox */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleProductSelected(p.id)}
                          aria-label={isSelected ? 'Unselect product' : 'Select product'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-medium text-gray-900">
                          #{p.productNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{p.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-700">{p.sku || '—'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={statusClass(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{p.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {p.priceAmount?.toFixed
                            ? p.priceAmount.toFixed(2)
                            : Number(p.priceAmount || 0).toFixed(2)}{' '}
                          {p.currency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
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
                            icon={Edit}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenForEdit(raw);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAndSorted.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
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
                          className="h-4 w-4"
                          checked={isSelected}
                          onChange={() => toggleProductSelected(p.id)}
                          aria-label={isSelected ? 'Unselect product' : 'Select product'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900">{p.title}</h3>
                        <div className="mt-1 space-y-1">
                          <div className="text-xs text-gray-600">
                            #{p.productNumber} · {p.sku || '—'}
                          </div>
                          <div className="text-xs text-gray-600">
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
                          icon={Eye}
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
                <Heading level={3} className="mb-0">
                  Publish selected products
                </Heading>
                <div className="text-xs text-gray-500">
                  {selectedProducts.length} products selected
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Choose channels / stores</div>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-2 ${!isWooConfigured ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        disabled={!isWooConfigured}
                        checked={publishWooChecked && isWooConfigured}
                        onChange={(e) => setPublishWooChecked(e.target.checked)}
                      />
                      <span>WooCommerce {isWooConfigured ? '' : '(not connected)'}</span>
                    </label>
                    {/* Här kan vi senare lägga till Fyndiq, CDON SE/DK etc. */}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-md border text-sm"
                  onClick={() => setShowPublishModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
                  disabled={wooExporting || selectedProducts.length === 0 || !publishWooChecked}
                  onClick={async () => {
                    const payload = selectedProducts.map((p: any) => ({
                      id: p.id,
                      productNumber: p.productNumber,
                      sku: p.sku,
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
                      createdAt: p.createdAt as any,
                      updatedAt: p.updatedAt as any,
                    }));
                    try {
                      if (publishWooChecked) {
                        await exportToWoo(payload as any[]);
                      }
                      setShowPublishModal(false);
                    } catch {
                      /* feedback visas via wooLastResult/validering */
                    }
                  }}
                >
                  {wooExporting ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete-modal (NY) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl">
            <div className="bg-white rounded-xl shadow-xl border">
              <div className="p-4 border-b">
                <Heading level={3} className="mb-0">
                  Delete selected products
                </Heading>
                <div className="text-xs text-gray-500">
                  {selectedProducts.length} products selected
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Choose channels / stores to delete from</div>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-2 ${!isWooConfigured ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        disabled={!isWooConfigured}
                        checked={deleteFromWooChecked && isWooConfigured}
                        onChange={(e) => setDeleteFromWooChecked(e.target.checked)}
                      />
                      <span>WooCommerce {isWooConfigured ? '' : '(not connected)'}</span>
                    </label>
                    {/* Lägg till fler kanaler här (Fyndiq, CDON SE/DK etc) */}
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
                    Om markerad raderas produkterna permanent från plattformens databas (inte ångringsbart).
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
                    (!deleteFromWooChecked && !alsoDeleteFromPlatform)
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
