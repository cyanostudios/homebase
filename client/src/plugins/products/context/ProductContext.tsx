// client/src/plugins/products/context/ProductContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';

import { productsApi, type ProductImportMode, type ProductImportResult } from '../api/productsApi';
import type { Product, ProductSettings, ValidationError } from '../types/products';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';

interface ProductContextType {
  // Panel state
  isProductPanelOpen: boolean;
  currentProduct: Product | null;
  panelMode: 'create' | 'edit';
  validationErrors: ValidationError[];

  // Data
  products: Product[];

  // Product plugin settings (default delivery etc.)
  productSettings: ProductSettings | null;
  loadProductSettings: () => Promise<void>;

  // selection (IDs as strings)
  selectedProductIds: string[];
  toggleProductSelected: (id: string) => void;
  selectAllProducts: (ids: string[]) => void;
  clearProductSelection: () => void;

  // Panel actions (single product or batch: same panel, always editable)
  openProductPanel: (product: Product | null) => void;
  openProductForEdit: (product: Product) => void;
  /** Opens the product in the editable form (no separate view). Kept for API compatibility. */
  openProductForView: (product: Product) => void;
  openProductPanelForBatch: (productIds: string[]) => void;
  closeProductPanel: () => void;
  /** When non-empty, panel is in batch-edit mode: same form, only filled fields are applied on save. */
  batchProductIds: string[];

  // CRUD actions
  saveProduct: (data: any, options?: {
    hadChanges?: boolean;
    channelTargets?: Array<{ channel: string; channelInstanceId: number | null }>;
    channelTargetsWithMarket?: Array<{ channel: string; channelInstanceId: number | null; market: string }>;
    channelOverridesToSave?: Array<{ channelInstanceId: number | string; category?: string | null; priceAmount?: number | null }>;
  }) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<void>;
  deleteProducts: (ids: string[]) => Promise<void>; // bulk
  batchUpdateProducts: (ids: string[], updates: { priceAmount?: number; quantity?: number; status?: string; vatRate?: number; currency?: string }) => Promise<{ updatedCount: number }>;
  importProducts: (file: File, mode: ProductImportMode) => Promise<ProductImportResult>;

  clearValidationErrors: () => void;

  // Panel Title Functions
  getPanelTitle: (mode: string, item: Product | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Product | null) => any;
  getDeleteMessage: (item: Product | null) => string;

  // Kanaler tab: cache so switching tabs doesn’t refetch (survives form remount)
  getChannelDataCache: (productKey: string) => { instances: any[]; overrides: any[]; targetKeys: string[] } | null;
  setChannelDataCache: (productKey: string, data: { instances: any[]; overrides: any[]; targetKeys: string[] }) => void;
  clearChannelDataCache: () => void;

  getChannelCategories: (inst: { channel: string; id: string | number; market?: string | null; instanceKey?: string }) => Promise<Array<{ id: string; name: string; path?: string; parent?: number }>>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ProductProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ProductProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, getSettings, settingsVersion } = useApp();

  // Panel state (no 'view' mode: always editable form with Avbryt + Spara only)
  const [isProductPanelOpen, setIsProductPanelOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [batchProductIds, setBatchProductIds] = useState<string[]>([]);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [productSettings, setProductSettings] = useState<ProductSettings | null>(null);

  // selection
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Kanaler tab cache (ref so it survives form remount when switching tabs)
  const channelDataCacheRef = useRef<{
    productKey: string;
    instances: any[];
    overrides: any[];
    targetKeys: string[];
  } | null>(null);
  const getChannelDataCache = useCallback((productKey: string) => {
    const c = channelDataCacheRef.current;
    return c && c.productKey === productKey ? { instances: c.instances, overrides: c.overrides, targetKeys: c.targetKeys } : null;
  }, []);
  const setChannelDataCache = useCallback((productKey: string, data: { instances: any[]; overrides: any[]; targetKeys: string[] }) => {
    channelDataCacheRef.current = { productKey, ...data };
  }, []);
  const clearChannelDataCache = useCallback(() => {
    channelDataCacheRef.current = null;
  }, []);

  const TTL_CDON_FYNDIQ_MS = 24 * 60 * 60 * 1000;
  const TTL_WOO_MS = 6 * 60 * 60 * 1000;

  const channelCategoriesCacheRef = useRef<Record<string, { items: Array<{ id: string; name: string; path?: string; parent?: number }>; fetchedAt: number }>>({});

  const getChannelCategories = useCallback(
    async (inst: { channel: string; id: string | number; market?: string | null; instanceKey?: string }): Promise<Array<{ id: string; name: string; path?: string; parent?: number }>> => {
      const ch = String(inst.channel || '').toLowerCase();
      const categoryLanguage = productSettings?.categoryLanguage ?? 'sv-SE';

      let cacheKey: string;
      let ttlMs: number;
      if (ch === 'cdon') {
        cacheKey = `cdon:categories:${categoryLanguage}`;
        ttlMs = TTL_CDON_FYNDIQ_MS;
      } else if (ch === 'fyndiq') {
        cacheKey = `fyndiq:categories:${categoryLanguage}`;
        ttlMs = TTL_CDON_FYNDIQ_MS;
      } else if (ch === 'woocommerce') {
        cacheKey = `woo:${inst.id}`;
        ttlMs = TTL_WOO_MS;
      } else {
        return [];
      }

      const cached = channelCategoriesCacheRef.current[cacheKey];
      if (cached && Date.now() - cached.fetchedAt < ttlMs) {
        return cached.items;
      }

      const res = await fetch(`/api/products/category-cache?key=${encodeURIComponent(cacheKey)}`, { credentials: 'include' });
      if (res.status === 404) {
        channelCategoriesCacheRef.current[cacheKey] = { items: [], fetchedAt: Date.now() };
        return [];
      }
      if (!res.ok) {
        let message = res.statusText || 'Failed to load categories';
        try {
          const errBody = await res.json();
          if (errBody?.error && typeof errBody.error === 'string') message = errBody.error;
          if (errBody?.detail && typeof errBody.detail === 'string' && errBody.detail !== message) message = `${message}: ${errBody.detail}`;
        } catch {
          // keep message from statusText
        }
        throw new Error(message);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      channelCategoriesCacheRef.current[cacheKey] = { items, fetchedAt: Date.now() };
      return items;
    },
    [productSettings?.categoryLanguage],
  );

  const loadProductSettings = useCallback(async () => {
    try {
      const raw = await getSettings('products');
      const s = (raw && typeof raw === 'object' ? raw : {}) as ProductSettings;
      setProductSettings(s);
    } catch {
      setProductSettings(null);
    }
  }, [getSettings]);

  const loadProducts = useCallback(async () => {
    try {
      const data = await productsApi.getProducts();
      const arr = Array.isArray(data) ? data : [];
      const transformed = arr.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      }));
      setProducts(transformed);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  const wasAuthenticatedRef = useRef(false);

  // Load product settings when authenticated or when settings change (e.g. saved from ProductSettingsForm)
  useEffect(() => {
    if (isAuthenticated) {
      loadProductSettings();
    }
  }, [isAuthenticated, settingsVersion, loadProductSettings]);

  // Load products when authenticated; only clear on explicit logout (was true -> false)
  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
      wasAuthenticatedRef.current = true;
    } else {
      if (wasAuthenticatedRef.current) {
        setProducts([]);
        setSelectedProductIds([]);
        wasAuthenticatedRef.current = false;
      }
    }
  }, [isAuthenticated, loadProducts]);

  // Keep selection valid when products change
  useEffect(() => {
    if (!products?.length) {
      if (selectedProductIds.length) setSelectedProductIds([]);
      return;
    }
    const existing = new Set(products.map((p) => String(p.id)));
    setSelectedProductIds((prev) => prev.filter((id) => existing.has(id)));
  }, [products]);

  // Register panel-close with AppContext
  useEffect(() => {
    registerPanelCloseFunction('products', closeProductPanel);
    return () => {
      unregisterPanelCloseFunction('products');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global form actions: dispatch events that ProductForm listens for (event-based, robust)
  useEffect(() => {
    (window as any).submitProductsForm = () => {
      window.dispatchEvent(new CustomEvent('submitProductForm'));
    };
    (window as any).cancelProductsForm = () => {
      window.dispatchEvent(new CustomEvent('cancelProductForm'));
    };
    return () => {
      delete (window as any).submitProductsForm;
      delete (window as any).cancelProductsForm;
    };
  }, []);

  const generateNextProductNumber = (): string => {
    const toNum = (val: any) => {
      if (!val) return 0;
      const s = String(val);
      const m = s.match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : parseInt(s, 10) || 0;
    };
    const existingNumbers = products.map((p: any) => toNum(p.productNumber));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return String(maxNumber + 1).padStart(2, '0');
  };

  const validateProduct = (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    const add = (field: string, message: string) => errors.push({ field, message });
    const isFiniteNumber = (n: any) => typeof n === 'number' && Number.isFinite(n);

    if (!data.title?.trim()) add('title', 'Title is required');
    if (!data.status || !['for sale', 'draft', 'archived'].includes(String(data.status))) {
      add('status', 'Status must be one of: for sale, draft, archived');
    }

    if (!isFiniteNumber(data.quantity) || data.quantity < 0 || !Number.isInteger(data.quantity)) {
      add('quantity', 'Quantity must be a non-negative integer');
    }
    if (!isFiniteNumber(data.priceAmount) || data.priceAmount < 0) {
      add('priceAmount', 'Price must be a non-negative number');
    }
    if (!isFiniteNumber(data.vatRate) || data.vatRate < 0 || data.vatRate > 50) {
      add('vatRate', 'VAT rate must be between 0 and 50');
    }

    if (!data.currency?.trim()) {
      add('currency', 'Currency is required');
    } else {
      const c = String(data.currency).toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) add('currency', 'Currency must be a 3-letter code (e.g., SEK)');
    }

    if (data.productNumber?.trim()) {
      const pn = data.productNumber.trim();
      const clash = products.find(
        (p) => p.id !== currentProduct?.id && String(p.productNumber) === pn,
      );
      if (clash) {
        add(
          'productNumber',
          `Product number "${pn}" already exists (used by "${clash.title ?? 'another product'}")`,
        );
      }
    }
    if (data.sku?.trim()) {
      const sku = data.sku.trim();
      const clash = products.find(
        (p) => p.id !== currentProduct?.id && String(p.sku || '') === sku,
      );
      if (clash) {
        add('sku', `SKU "${sku}" already exists (used by "${clash.title ?? 'another product'}")`);
      }
    }

    if (data.ean?.trim() && !/^\d{8,14}$/.test(String(data.ean).trim())) {
      errors.push({ field: 'ean', message: 'Warning: EAN should be 8–14 digits' });
    }
    if (data.gtin?.trim() && !/^\d{8,14}$/.test(String(data.gtin).trim())) {
      errors.push({ field: 'gtin', message: 'Warning: GTIN should be 8–14 digits (12 för UPC-A)' });
    }

    if (!data.brand?.trim()) add('brand', 'Märke är obligatoriskt');

    return errors;
  };

  // Panel actions
  const openProductPanel = (product: Product | null) => {
    setCurrentProduct(product);
    setPanelMode(product ? 'edit' : 'create');
    setIsProductPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openProductForEdit = (product: Product) => {
    setCurrentProduct(product);
    setPanelMode('edit');
    setBatchProductIds([]);
    setIsProductPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openProductForView = (product: Product) => {
    setCurrentProduct(product);
    setPanelMode('edit');
    setBatchProductIds([]);
    setIsProductPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openProductPanelForBatch = (productIds: string[]) => {
    setCurrentProduct(null);
    setPanelMode('edit');
    setBatchProductIds(Array.from(new Set(productIds.map(String).filter(Boolean))));
    setIsProductPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeProductPanel = () => {
    setIsProductPanelOpen(false);
    setCurrentProduct(null);
    setPanelMode('create');
    setBatchProductIds([]);
    setValidationErrors([]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const saveProduct = async (raw: any, options?: {
    hadChanges?: boolean;
    channelTargets?: Array<{ channel: string; channelInstanceId: number | null }>;
    /** Targets with market (se/dk/fi/no) for effective-price validation. */
    channelTargetsWithMarket?: Array<{ channel: string; channelInstanceId: number | null; market: string }>;
    categoryOverrides?: Array<{ channelInstanceId: string; category: string | null }>;
    /** Per-channel category + price overrides (overrides categoryOverrides when present). */
    channelOverridesToSave?: Array<{ channelInstanceId: number | string; category?: string | null; priceAmount?: number | null }>;
  }): Promise<boolean> => {
    const data: Record<string, unknown> = {
      productNumber: (raw.productNumber ?? '').trim(),
      title: (raw.title ?? '').trim(),
      status: raw.status,
      quantity: Number(raw.quantity ?? 0),
      priceAmount: Number(raw.priceAmount ?? 0),
      purchasePrice: raw.purchasePrice != null && raw.purchasePrice !== '' && Number.isFinite(Number(raw.purchasePrice)) ? Number(raw.purchasePrice) : undefined,
      salePrice: raw.salePrice != null && raw.salePrice !== '' && Number.isFinite(Number(raw.salePrice)) ? Number(raw.salePrice) : undefined,
      currency: (raw.currency ?? 'SEK').toUpperCase(),
      vatRate: Number(raw.vatRate ?? 25),
      sku: (raw.sku ?? '').trim(),
      // MPN is only used by marketplace connectors (CDON/Fyndiq).
      // If user leaves it blank, auto-copy SKU so exports won't miss required identifiers.
      mpn: ((raw.mpn ?? '').trim() || (raw.sku ?? '').trim()),
      description: raw.description ?? '',
      mainImage: raw.mainImage ?? '',
      images: Array.isArray(raw.images) ? raw.images : [],
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      brand: (raw.brand ?? '').trim(),
      brandId: raw.brandId ? String(raw.brandId).trim() : undefined,
      ean: (raw.ean ?? '').trim() || undefined,
      gtin: (raw.gtin ?? '').trim() || undefined,
      supplierId: raw.supplierId ? String(raw.supplierId).trim() : undefined,
      manufacturerId: raw.manufacturerId ? String(raw.manufacturerId).trim() : undefined,
      lagerplats: (raw.lagerplats ?? '').trim() || undefined,
      color: (raw.color ?? '').trim() || undefined,
      colorText: (raw.colorText ?? '').trim() || undefined,
      size: (raw.size ?? '').trim() || undefined,
      sizeText: (raw.sizeText ?? '').trim() || undefined,
      pattern: (raw.pattern ?? '').trim() || undefined,
      weight: raw.weight != null && raw.weight !== '' && Number.isFinite(Number(raw.weight)) ? Number(raw.weight) : undefined,
      lengthCm: raw.lengthCm != null && raw.lengthCm !== '' && Number.isFinite(Number(raw.lengthCm)) ? Number(raw.lengthCm) : undefined,
      widthCm: raw.widthCm != null && raw.widthCm !== '' && Number.isFinite(Number(raw.widthCm)) ? Number(raw.widthCm) : undefined,
      heightCm: raw.heightCm != null && raw.heightCm !== '' && Number.isFinite(Number(raw.heightCm)) ? Number(raw.heightCm) : undefined,
      depthCm: raw.depthCm != null && raw.depthCm !== '' && Number.isFinite(Number(raw.depthCm)) ? Number(raw.depthCm) : undefined,
    };
    if (raw.channelSpecific !== undefined && raw.channelSpecific !== null && typeof raw.channelSpecific === 'object' && !Array.isArray(raw.channelSpecific)) {
      data.channelSpecific = raw.channelSpecific;
    }

    if (!currentProduct && !data.productNumber) {
      data.productNumber = generateNextProductNumber();
    }

    const errors = validateProduct(data);
    const channelTargets = options?.channelTargets ?? [];
    const channelTargetsWithMarket = options?.channelTargetsWithMarket ?? [];
    const channelOverridesToSave = options?.channelOverridesToSave ?? [];

    // CDON/Fyndiq: varje vald butik måste ha marknad – annars kan vi inte veta vilket pris som gäller
    const cdonFyndiqTargets = channelTargets.filter(
      (t) => t.channelInstanceId != null && ['cdon', 'fyndiq'].includes(String(t.channel).toLowerCase()),
    );
    for (const t of cdonFyndiqTargets) {
      const withMarket = channelTargetsWithMarket.find((m) => m.channelInstanceId === t.channelInstanceId);
      if (!withMarket?.market) {
        errors.push({
          field: 'kanaler',
          message:
            'En eller flera valda butiker saknar marknad. Gå till fliken Kanaler och ange vilken marknad (SE, DK, NO eller FI) varje CDON- och Fyndiq-butik gäller.',
        });
        break;
      }
    }

    // Warn if product is active on a channel but has no effective price (per-butikspris överstyring eller baspris/marknadspris)
    const pricing = (data.channelSpecific as any)?.pricing;
    const markets = pricing?.markets && typeof pricing.markets === 'object' ? pricing.markets : null;
    if (channelTargets.length > 0) {
      const globalPrice = Number(data.priceAmount ?? 0);
      const hasGlobalPrice = Number.isFinite(globalPrice) && globalPrice > 0;
      for (const t of channelTargets) {
        if (t.channelInstanceId == null) continue;
        const ov = channelOverridesToSave.find((o) => String(o.channelInstanceId) === String(t.channelInstanceId));
        const instancePriceOverride = ov?.priceAmount;
        const hasInstancePriceOverride = instancePriceOverride != null && Number.isFinite(Number(instancePriceOverride)) && Number(instancePriceOverride) > 0;
        let hasEffectivePrice = hasGlobalPrice || hasInstancePriceOverride;
        if (!hasEffectivePrice && markets && channelTargetsWithMarket.length > 0) {
          const withMarket = channelTargetsWithMarket.find((m) => String(m.channelInstanceId) === String(t.channelInstanceId));
          if (withMarket?.market) {
            const marketAmount = markets[withMarket.market]?.amount;
            hasEffectivePrice = marketAmount != null && Number.isFinite(Number(marketAmount)) && Number(marketAmount) > 0;
          }
        }
        if (!hasEffectivePrice) {
          errors.push({
            field: 'priceAmount',
            message: 'Varning: Minst en aktiv kanal saknar effektivt pris. Ange baspris eller fyll i pris per butik under Priser.',
          });
          break;
        }
      }
    }
    setValidationErrors(errors);
    const blocking = errors.filter((e) => !e.message.includes('Warning'));
    if (blocking.length > 0) return false;

    try {
      if (currentProduct) {
        const saved = await productsApi.updateProduct(currentProduct.id, data);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
        };
        setProducts((prev) =>
          prev.map((p) => (p.id === currentProduct.id ? normalized : p)),
        );
        setCurrentProduct(normalized);
        setValidationErrors([]);

        // Channel diff: apply Kanaler tab selections, then export to final enabled targets
        const desiredTargets = options?.channelTargets ?? null;
        if (desiredTargets && desiredTargets.length >= 0) {
          try {
            const { targets: currentTargets } = await channelsApi.getProductTargets(String(saved.id));
            const currentSet = new Set(
              (currentTargets ?? []).map((t) =>
                t.channelInstanceId != null
                  ? `${t.channel}:${t.channelInstanceId}`
                  : t.channel,
              ),
            );
            const desiredSet = new Set(
              desiredTargets.map((t) =>
                t.channelInstanceId != null
                  ? `${t.channel}:${t.channelInstanceId}`
                  : t.channel,
              ),
            );
            const toEnable = desiredTargets.filter((t) => {
              const k = t.channelInstanceId != null ? `${t.channel}:${t.channelInstanceId}` : t.channel;
              return !currentSet.has(k);
            });
            const toDisable = (currentTargets ?? []).filter((t) => {
              const k = t.channelInstanceId != null ? `${t.channel}:${t.channelInstanceId}` : t.channel;
              return !desiredSet.has(k);
            });
            const mapUpdates = [
              ...toEnable.map((t) => ({
                channel: t.channel,
                channelInstanceId: t.channelInstanceId ?? undefined,
                enabled: true as const,
              })),
              ...toDisable.map((t) => ({
                channel: t.channel,
                channelInstanceId: t.channelInstanceId != null ? Number(t.channelInstanceId) : undefined,
                enabled: false as const,
              })),
            ];
            if (mapUpdates.length > 0) {
              await channelsApi.setProductMapBulk({
                productId: String(saved.id),
                updates: mapUpdates,
              });
            }
          } catch (diffErr) {
            console.warn('Channel diff failed', diffErr);
          }
        }
        // Save per-instance overrides (category + price) in one bulk request
        const overridesToSave = options?.channelOverridesToSave;
        if (overridesToSave?.length && saved.id) {
          try {
            await channelsApi.upsertOverridesBulk({
              productId: String(saved.id),
              items: overridesToSave.map((o) => ({
                channelInstanceId: o.channelInstanceId,
                active: true,
                category: o.category ?? undefined,
                priceAmount: o.priceAmount ?? undefined,
              })),
            });
          } catch (overrideErr) {
            console.warn('Channel overrides save failed', overrideErr);
          }
        } else {
          const catOverrides = options?.categoryOverrides;
          if (catOverrides?.length && saved.id) {
            try {
              await Promise.all(
                catOverrides.map((o) =>
                  channelsApi.upsertOverride({
                    productId: String(saved.id),
                    channelInstanceId: o.channelInstanceId,
                    category: o.category,
                  }),
                ),
              );
            } catch (catErr) {
              console.warn('Category overrides save failed', catErr);
            }
          }
        }

        if (options?.hadChanges || (desiredTargets && desiredTargets.length > 0)) {
          const productForSync = saved;
          (async () => {
            try {
              const { targets } = await channelsApi.getProductTargets(String(productForSync.id));
              if (!targets?.length) return;
              const payload = {
                id: productForSync.id,
                productNumber: productForSync.productNumber,
                sku: productForSync.sku,
                mpn: productForSync.mpn,
                title: productForSync.title,
                status: productForSync.status,
                quantity: productForSync.quantity,
                priceAmount: productForSync.priceAmount,
                currency: productForSync.currency,
                vatRate: productForSync.vatRate,
                description: productForSync.description,
                mainImage: productForSync.mainImage,
                images: productForSync.images,
                categories: productForSync.categories,
                brand: productForSync.brand,
                gtin: productForSync.gtin,
                createdAt: productForSync.createdAt,
                updatedAt: productForSync.updatedAt,
              };
              const wooTargets = targets.filter((t) => t.channel === 'woocommerce');
              const wooInstanceIds = wooTargets.map((t) => t.channelInstanceId).filter((id): id is string => id != null);
              const wooLegacy = wooTargets.some((t) => t.channelInstanceId == null);
              if (wooInstanceIds.length > 0 || wooLegacy) {
                await woocommerceApi.exportProducts(
                  [payload],
                  wooInstanceIds.length > 0 ? { instanceIds: wooInstanceIds } : undefined,
                );
              }
              if (targets.some((t) => t.channel === 'cdon')) {
                await cdonApi.exportProducts([payload], { markets: ['se', 'dk', 'fi'] });
              }
              if (targets.some((t) => t.channel === 'fyndiq')) {
                await fyndiqApi.exportProducts([payload], { markets: ['se', 'dk', 'fi'] });
              }
            } catch (syncErr) {
              console.warn('Sync to channels after save failed', syncErr);
            }
          })();
        }
        clearChannelDataCache();
        closeProductPanel();
      } else {
        const saved = await productsApi.createProduct(data);
        const listId = data.listId != null && String(data.listId).trim() !== '' ? String(data.listId).trim() : null;
        if (listId !== null) {
          try {
            await productsApi.setProductList(String(saved.id), listId);
          } catch (listErr) {
            console.warn('Set product list after create failed', listErr);
          }
        }
        const normalized = {
          ...saved,
          listId: listId ?? saved.listId ?? null,
          listName: saved.listName ?? null,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
        };
        setProducts((prev) => [...prev, normalized]);

        // Apply Kanaler tab selections for new product: enable selected channels
        const desiredTargets = options?.channelTargets ?? [];
        if (desiredTargets.length > 0) {
          try {
            await channelsApi.setProductMapBulk({
              productId: String(saved.id),
              updates: desiredTargets.map((t) => ({
                channel: t.channel,
                channelInstanceId: t.channelInstanceId ?? undefined,
                enabled: true,
              })),
            });
          } catch (channelErr) {
            console.warn('Channel enable after create failed', channelErr);
          }
          // Per-instance overrides for new product (category + price) in one bulk request
          const overridesToSaveNew = options?.channelOverridesToSave;
          if (overridesToSaveNew?.length) {
            try {
              await channelsApi.upsertOverridesBulk({
                productId: String(saved.id),
                items: overridesToSaveNew.map((o) => ({
                  channelInstanceId: o.channelInstanceId,
                  active: true,
                  category: o.category ?? undefined,
                  priceAmount: o.priceAmount ?? undefined,
                })),
              });
            } catch (overrideErr) {
              console.warn('Channel overrides after create failed', overrideErr);
            }
          } else {
            const catOverrides = options?.categoryOverrides;
            if (catOverrides?.length) {
              try {
                await Promise.all(
                  catOverrides.map((o) =>
                    channelsApi.upsertOverride({
                      productId: String(saved.id),
                      channelInstanceId: o.channelInstanceId,
                      category: o.category,
                    }),
                  ),
                );
              } catch (catErr) {
                console.warn('Category overrides after create failed', catErr);
              }
            }
          }
          // Export to enabled channels in background (do not block UI)
          const productForSync = saved;
          (async () => {
            try {
              const { targets } = await channelsApi.getProductTargets(String(productForSync.id));
              if (!targets?.length) return;
              const payload = {
                id: productForSync.id,
                productNumber: productForSync.productNumber,
                sku: productForSync.sku,
                mpn: productForSync.mpn,
                title: productForSync.title,
                status: productForSync.status,
                quantity: productForSync.quantity,
                priceAmount: productForSync.priceAmount,
                currency: productForSync.currency,
                vatRate: productForSync.vatRate,
                description: productForSync.description,
                mainImage: productForSync.mainImage,
                images: productForSync.images,
                categories: productForSync.categories,
                brand: productForSync.brand,
                gtin: productForSync.gtin,
                createdAt: productForSync.createdAt,
                updatedAt: productForSync.updatedAt,
              };
              const wooTargets = targets.filter((t) => t.channel === 'woocommerce');
              const wooInstanceIds = wooTargets.map((t) => t.channelInstanceId).filter((id): id is string => id != null);
              if (wooInstanceIds.length > 0) {
                await woocommerceApi.exportProducts([payload], { instanceIds: wooInstanceIds });
              }
              if (targets.some((t) => t.channel === 'cdon')) {
                await cdonApi.exportProducts([payload], { markets: ['se', 'dk', 'fi'] });
              }
              if (targets.some((t) => t.channel === 'fyndiq')) {
                await fyndiqApi.exportProducts([payload], { markets: ['se', 'dk', 'fi'] });
              }
            } catch (syncErr) {
              console.warn('Sync to channels after create failed', syncErr);
            }
          })();
        }
        clearChannelDataCache();
        closeProductPanel();
      }
      return true;
    } catch (error: any) {
      console.error('Failed to save product:', error);
      
      // Handle validation errors from backend
      const validationErrors: ValidationError[] = [];
      
      // Handle 404 errors (product not found - should not happen on create, but can on update)
      if (error?.status === 404) {
        validationErrors.push({
          field: 'general',
          message: error?.error || error?.message || 'Product not found. It may have been deleted.',
        });
        setValidationErrors(validationErrors);
        return false;
      }
      
      // Handle field-level errors (409 conflicts or validation errors)
      if (error?.errors && Array.isArray(error.errors)) {
        error.errors.forEach((err: any) => {
          if (err.field && err.message) {
            validationErrors.push({ field: err.field, message: err.message });
          }
        });
      }
      
      // If no specific field errors, show general error
      if (validationErrors.length === 0) {
        const errorMessage = error?.error || error?.message || 'Failed to save product. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }
      
      setValidationErrors(validationErrors);
      return false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productsApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedProductIds((prev) => prev.filter((pid) => pid !== String(id)));
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete product';
      alert(errorMessage);
    }
  };

  // Bulk delete
  const deleteProducts = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!uniqueIds.length) return;

    try {
      await productsApi.deleteProductsBulk(uniqueIds);
      setProducts((prev) => prev.filter((p) => !uniqueIds.includes(String(p.id))));
      setSelectedProductIds((prev) => prev.filter((id) => !uniqueIds.includes(id)));
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      const errorMessage = error?.message || error?.error || 'Failed to delete products';
      alert(errorMessage);
    }
  };

  const batchUpdateProducts = async (
    ids: string[],
    updates: { priceAmount?: number; quantity?: number; status?: string; vatRate?: number; currency?: string },
  ) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!uniqueIds.length) return { updatedCount: 0 };
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as { priceAmount?: number; quantity?: number; status?: string; vatRate?: number; currency?: string };
    if (Object.keys(filtered).length === 0) return { updatedCount: 0 };
    try {
      const result = await productsApi.batchUpdate(uniqueIds, filtered);
      await loadProducts();
      return { updatedCount: result?.updatedCount ?? 0 };
    } catch (error: any) {
      console.error('Batch update failed:', error);
      throw error;
    }
  };

  const importProducts = useCallback(async (file: File, mode: ProductImportMode): Promise<ProductImportResult> => {
    const result = await productsApi.importProducts(file, mode);
    await loadProducts();
    return result;
  }, [loadProducts]);

  // ---------- Selection helpers ----------
  const toggleProductSelected = useCallback((id: string) => {
    const key = String(id);
    setSelectedProductIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }, []);

  const selectAllProducts = useCallback((ids: string[]) => {
    const norm = Array.isArray(ids) ? ids.map(String) : [];
    setSelectedProductIds(norm);
  }, []);

  const clearProductSelection = useCallback(() => {
    setSelectedProductIds([]);
  }, []);

  const getPanelTitle = (mode: string, item: Product | null, isMobileView: boolean) => {
    if (batchProductIds.length > 0) {
      return `Batch Edit (${batchProductIds.length} products)`;
    }
    if (mode === 'edit' && item) {
      const productNumber = `#${item.productNumber || item.id}`;
      const title = item.title;
      const price = `${item.priceAmount} ${item.currency}`;
      if (isMobileView && price) {
        return (
          <div>
            <div>
              {productNumber} • {title}
            </div>
            <div className="text-sm font-normal text-gray-600 mt-1">{price}</div>
          </div>
        );
      }
      return `${productNumber} • ${title}${price ? ` • ${price}` : ''}`;
    }
    switch (mode) {
      case 'edit':
        return 'Edit Product';
      case 'create':
        return 'Create Product';
      default:
        return 'Product';
    }
  };

  const getPanelSubtitle = (mode: string, item: Product | null) => {
    if (batchProductIds.length > 0) {
      return 'Change only the fields you want to update; leave others empty.';
    }
    // Single product view: no subtitle row, so content starts higher
    return null;
  };

  const getDeleteMessage = (item: Product | null) => {
    if (!item) return 'Are you sure you want to delete this product?';
    const itemName = item.title || 'this product';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const value: ProductContextType = useMemo(
    () => ({
      isProductPanelOpen,
      currentProduct,
      panelMode,
      validationErrors,
      products,
      productSettings,
      loadProductSettings,

      // selection
      selectedProductIds,
      toggleProductSelected,
      selectAllProducts,
      clearProductSelection,

      // actions
      openProductPanel,
      openProductForEdit,
      openProductForView,
      openProductPanelForBatch,
      closeProductPanel,
      batchProductIds,
      saveProduct,
      deleteProduct,
      deleteProducts,
      batchUpdateProducts,
      importProducts,
      clearValidationErrors,

      // titles
      getPanelTitle,
      getPanelSubtitle,
      getDeleteMessage,

      getChannelDataCache,
      setChannelDataCache,
      clearChannelDataCache,
      getChannelCategories,
    }),
    [
      isProductPanelOpen,
      currentProduct,
      panelMode,
      batchProductIds,
      validationErrors,
      products,
      productSettings,
      loadProductSettings,
      selectedProductIds,
      toggleProductSelected,
      selectAllProducts,
      clearProductSelection,
      importProducts,
      getChannelDataCache,
      setChannelDataCache,
      clearChannelDataCache,
      getChannelCategories,
    ],
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProductContext() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
}
