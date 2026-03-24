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
import { decodeHtmlEntities } from '@/core/utils/decodeHtmlEntities';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';

import { productsApi, type ProductImportMode, type ProductImportResult } from '../api/productsApi';
import type {
  Product,
  ProductSaveChangeSet,
  ProductSettings,
  ValidationError,
} from '../types/products';

interface ProductContextType {
  // Panel state
  isProductPanelOpen: boolean;
  currentProduct: Product | null;
  panelMode: 'create' | 'edit';
  validationErrors: ValidationError[];
  isSaving: boolean;
  setProductFormSaving: (saving: boolean) => void;

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
  openProductPanelForBatch: (productIds: string[]) => void;
  closeProductPanel: () => void;
  /** When non-empty, panel is in batch-edit mode: same form, only filled fields are applied on save. */
  batchProductIds: string[];

  // CRUD actions
  /** Run validation and update validationErrors (for footer display). Does not save. */
  validateProductForm: (
    data: any,
    options?: {
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
  ) => void;
  saveProduct: (
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
        category?: string | null;
        priceAmount?: number | null;
        salePrice?: number | null;
        originalPrice?: number | null;
      }>;
    },
  ) => Promise<boolean>;
  resyncProducts: (ids: string[]) => Promise<{
    woo?: { ok: boolean; instances?: any[]; endpoint?: string; counts?: any };
    cdon?: { ok: boolean; counts?: any; endpoint?: string };
    fyndiq?: { ok: boolean; counts?: any; endpoint?: string };
  }>;
  deleteProduct: (id: string) => Promise<void>;
  deleteProducts: (ids: string[]) => Promise<void>; // bulk
  batchUpdateProducts: (
    ids: string[],
    updates: {
      priceAmount?: number;
      quantity?: number;
      status?: string;
      vatRate?: number;
      currency?: string;
    },
  ) => Promise<{ updatedCount: number }>;
  groupProducts: (
    productIds: string[],
    groupVariationType: 'color' | 'size' | 'model',
    mainProductId?: string | null,
  ) => Promise<{ updatedCount: number }>;
  importProducts: (file: File, mode: ProductImportMode) => Promise<ProductImportResult>;

  clearValidationErrors: () => void;

  // Panel Title Functions
  getPanelTitle: (mode: string, item: Product | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Product | null) => any;
  getDeleteMessage: (item: Product | null) => string;

  // Kanaler tab: cache so switching tabs doesn’t refetch (survives form remount)
  getChannelDataCache: (
    productKey: string,
  ) => { instances: any[]; overrides: any[]; targetKeys: string[] } | null;
  setChannelDataCache: (
    productKey: string,
    data: { instances: any[]; overrides: any[]; targetKeys: string[] },
  ) => void;
  clearChannelDataCache: () => void;

  getChannelCategories: (inst: {
    channel: string;
    id: string | number;
    market?: string | null;
    instanceKey?: string;
  }) => Promise<Array<{ id: string; name: string; path?: string; parent?: number }>>;
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, getSettings, settingsVersion } =
    useApp();

  // Panel state (no 'view' mode: always editable form with Avbryt + Spara only)
  const [isProductPanelOpen, setIsProductPanelOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const setProductFormSaving = useCallback((saving: boolean) => setIsSaving(saving), []);
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
    return c && c.productKey === productKey
      ? { instances: c.instances, overrides: c.overrides, targetKeys: c.targetKeys }
      : null;
  }, []);
  const setChannelDataCache = useCallback(
    (productKey: string, data: { instances: any[]; overrides: any[]; targetKeys: string[] }) => {
      channelDataCacheRef.current = { productKey, ...data };
    },
    [],
  );
  const clearChannelDataCache = useCallback(() => {
    channelDataCacheRef.current = null;
  }, []);

  const TTL_CDON_FYNDIQ_MS = 24 * 60 * 60 * 1000;
  const TTL_WOO_MS = 6 * 60 * 60 * 1000;

  const channelCategoriesCacheRef = useRef<
    Record<
      string,
      {
        items: Array<{ id: string; name: string; path?: string; parent?: number }>;
        fetchedAt: number;
      }
    >
  >({});

  const getChannelCategories = useCallback(
    async (inst: {
      channel: string;
      id: string | number;
      market?: string | null;
      instanceKey?: string;
    }): Promise<Array<{ id: string; name: string; path?: string; parent?: number }>> => {
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

      const res = await fetch(`/api/products/category-cache?key=${encodeURIComponent(cacheKey)}`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        channelCategoriesCacheRef.current[cacheKey] = { items: [], fetchedAt: Date.now() };
        return [];
      }
      if (!res.ok) {
        let message = res.statusText || 'Failed to load categories';
        try {
          const errBody = await res.json();
          if (errBody?.error && typeof errBody.error === 'string') {
            message = errBody.error;
          }
          if (errBody?.detail && typeof errBody.detail === 'string' && errBody.detail !== message) {
            message = `${message}: ${errBody.detail}`;
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TTL constants are stable
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
      if (selectedProductIds.length) {
        setSelectedProductIds([]);
      }
      return;
    }
    const existing = new Set(products.map((p) => String(p.id)));
    setSelectedProductIds((prev) => prev.filter((id) => existing.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intended: run only when products change
  }, [products]);

  // Listen for category-cache invalidation (e.g. from WooCommerce manual sync)
  useEffect(() => {
    const handler = (e: CustomEvent<{ key: string }>) => {
      const key = e?.detail?.key;
      if (key && channelCategoriesCacheRef.current[key]) {
        delete channelCategoriesCacheRef.current[key];
      }
    };
    window.addEventListener('category-cache-invalidated', handler as EventListener);
    return () => window.removeEventListener('category-cache-invalidated', handler as EventListener);
  }, []);

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
    (window as any).submitProductsFormIgnorePriceWarning = () => {
      window.dispatchEvent(new CustomEvent('submitProductForm', { detail: { ignorePriceWarning: true } }));
    };
    (window as any).cancelProductsForm = () => {
      window.dispatchEvent(new CustomEvent('cancelProductForm'));
    };
    return () => {
      delete (window as any).submitProductsForm;
      delete (window as any).submitProductsFormIgnorePriceWarning;
      delete (window as any).cancelProductsForm;
    };
  }, []);

  const validateProduct = (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    const add = (field: string, message: string) => errors.push({ field, message });
    const isFiniteNumber = (n: any) => typeof n === 'number' && Number.isFinite(n);

    if (!data.title?.trim()) {
      add('title', 'Title is required');
    }
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
      if (!/^[A-Z]{3}$/.test(c)) {
        add('currency', 'Currency must be a 3-letter code (e.g., SEK)');
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

    if (!data.brand?.trim()) {
      add('brand', 'Märke är obligatoriskt');
    }

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

  /** Build data + run validation. Used by validateProductForm and saveProduct. */
  const buildDataAndValidate = useCallback(
    (
      raw: any,
      options?: {
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
    ): { errors: ValidationError[]; data: Record<string, unknown> } => {
      const data: Record<string, unknown> = {
        title: (raw.title ?? '').trim(),
        status: raw.status,
        quantity: Number(raw.quantity ?? 0),
        priceAmount: Number(raw.priceAmount ?? 0),
        purchasePrice:
          (raw.purchasePrice ?? null) !== null &&
          raw.purchasePrice !== '' &&
          Number.isFinite(Number(raw.purchasePrice))
            ? Number(raw.purchasePrice)
            : undefined,
        currency: (raw.currency ?? 'SEK').toUpperCase(),
        vatRate: Number(raw.vatRate ?? 25),
        sku: (raw.sku ?? '').trim(),
        mpn: (raw.mpn ?? '').trim() || (raw.sku ?? '').trim(),
        description: raw.description ?? '',
        mainImage: raw.mainImage ?? '',
        images: Array.isArray(raw.images) ? raw.images : [],
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        brand: (raw.brand ?? '').trim(),
        privateName: (raw.privateName ?? '').trim() || undefined,
        brandId: raw.brandId ? String(raw.brandId).trim() : undefined,
        ean: (raw.ean ?? '').trim() || undefined,
        gtin: (raw.gtin ?? '').trim() || undefined,
        knNumber: (raw.knNumber ?? raw.kn_number ?? '').trim() || undefined,
        supplierId: raw.supplierId ? String(raw.supplierId).trim() : undefined,
        manufacturerId: raw.manufacturerId ? String(raw.manufacturerId).trim() : undefined,
        lagerplats: (raw.lagerplats ?? '').trim() || undefined,
        condition:
          raw.condition === 'used' || raw.condition === 'refurb' ? raw.condition : 'new',
        groupId: (raw.groupId ?? '').trim() || undefined,
        color: (raw.color ?? '').trim() || undefined,
        colorText: (raw.colorText ?? '').trim() || undefined,
        size: (raw.size ?? '').trim() || undefined,
        sizeText: (raw.sizeText ?? '').trim() || undefined,
        pattern: (raw.pattern ?? '').trim() || undefined,
        material: (raw.material ?? '').trim() || undefined,
        patternText: (raw.patternText ?? '').trim() || undefined,
        model: (raw.model ?? '').trim() || undefined,
        weight:
          (raw.weight ?? null) !== null &&
          raw.weight !== '' &&
          Number.isFinite(Number(raw.weight))
            ? Number(raw.weight)
            : undefined,
        lengthCm:
          (raw.lengthCm ?? null) !== null &&
          raw.lengthCm !== '' &&
          Number.isFinite(Number(raw.lengthCm))
            ? Number(raw.lengthCm)
            : undefined,
        widthCm:
          (raw.widthCm ?? null) !== null &&
          raw.widthCm !== '' &&
          Number.isFinite(Number(raw.widthCm))
            ? Number(raw.widthCm)
            : undefined,
        heightCm:
          (raw.heightCm ?? null) !== null &&
          raw.heightCm !== '' &&
          Number.isFinite(Number(raw.heightCm))
            ? Number(raw.heightCm)
            : undefined,
        depthCm:
          (raw.depthCm ?? null) !== null &&
          raw.depthCm !== '' &&
          Number.isFinite(Number(raw.depthCm))
            ? Number(raw.depthCm)
            : undefined,
        volume:
          (raw.volume ?? null) !== null &&
          raw.volume !== '' &&
          Number.isFinite(Number(raw.volume))
            ? Number(raw.volume)
            : undefined,
        volumeUnit: (raw.volumeUnit ?? '').trim() || undefined,
        notes: (raw.notes ?? '').trim() || undefined,
        listId:
          (raw.listId ?? null) != null && String(raw.listId).trim() !== ''
            ? String(raw.listId).trim()
            : undefined,
      };
      if (
        raw.channelSpecific !== undefined &&
        raw.channelSpecific !== null &&
        typeof raw.channelSpecific === 'object' &&
        !Array.isArray(raw.channelSpecific)
      ) {
        data.channelSpecific = raw.channelSpecific;
      }

      const errors = validateProduct(data);
      const channelTargets = options?.channelTargets ?? [];
      const channelTargetsWithMarket = options?.channelTargetsWithMarket ?? [];
      const channelOverridesToSave = options?.channelOverridesToSave ?? [];

      for (const t of channelTargets.filter(
        (x) =>
          (x.channelInstanceId ?? null) !== null &&
          ['cdon', 'fyndiq'].includes(String(x.channel).toLowerCase()),
      )) {
        const withMarket = channelTargetsWithMarket.find(
          (m) => String(m.channelInstanceId) === String(t.channelInstanceId),
        );
        if (!withMarket?.market) {
          errors.push({
            field: 'kanaler',
            message:
              'En eller flera valda butiker saknar marknad. Gå till fliken Kanaler och ange vilken marknad (SE, DK, NO eller FI) varje CDON- och Fyndiq-butik gäller.',
          });
          break;
        }
      }

      if (channelTargets.length > 0) {
        const globalPrice = Number(data.priceAmount ?? 0);
        const hasGlobalPrice = Number.isFinite(globalPrice) && globalPrice > 0;
        for (const t of channelTargets) {
          if ((t.channelInstanceId ?? null) === null) continue;
          const ov = channelOverridesToSave.find(
            (o) => String(o.channelInstanceId) === String(t.channelInstanceId),
          );
          const instancePriceOverride = ov?.priceAmount;
          const hasInstancePriceOverride =
            (instancePriceOverride ?? null) !== null &&
            Number.isFinite(Number(instancePriceOverride)) &&
            Number(instancePriceOverride) > 0;
          const hasEffectivePrice = hasGlobalPrice || hasInstancePriceOverride;
          if (!hasEffectivePrice) {
            errors.push({
              field: 'priceAmount',
              message:
                'Varning: Minst en aktiv kanal saknar effektivt pris. Ange baspris eller fyll i pris per butik under Priser.',
            });
            break;
          }
        }
      }

      const cdonFyndiqWithMarket = channelTargetsWithMarket.filter(
        (m) => ['cdon', 'fyndiq'].includes(String(m.channel).toLowerCase()) && m.market,
      );
      const marketsMissingText = new Set<string>();
      const MARKET_TO_LANG: Record<string, string> = {
        se: 'sv-SE',
        dk: 'da-DK',
        fi: 'fi-FI',
        no: 'nb-NO',
      };
      const MARKET_LABELS: Record<string, string> = {
        se: 'Sverige',
        dk: 'Danmark',
        fi: 'Finland',
        no: 'Norge',
      };
      for (const t of cdonFyndiqWithMarket) {
        const market = String(t.market).toLowerCase().slice(0, 2);
        if (!['se', 'dk', 'fi', 'no'].includes(market)) continue;
        const lang = MARKET_TO_LANG[market] || 'sv-SE';
        const cs = data.channelSpecific as any;
        const channelTitle = t.channel === 'cdon' ? cs?.cdon?.title : cs?.fyndiq?.title;
        const channelDesc = t.channel === 'cdon' ? cs?.cdon?.description : cs?.fyndiq?.description;
        const hasTitle =
          Array.isArray(channelTitle) &&
          channelTitle.some((e: any) => String(e?.language).toLowerCase() === lang.toLowerCase());
        const hasDesc =
          Array.isArray(channelDesc) &&
          channelDesc.some((e: any) => String(e?.language).toLowerCase() === lang.toLowerCase());
        if (!hasTitle || !hasDesc) {
          marketsMissingText.add(market);
        }
      }
      if (marketsMissingText.size > 0) {
        const labels = Array.from(marketsMissingText)
          .map((m) => MARKET_LABELS[m] || m)
          .join(', ');
        errors.push({
          field: 'texter',
          message: `Varning: ${labels} saknar titel och/eller beskrivning (standardtexten är också tom). Fyll i texter under fliken Texter för dessa marknader, eller välj en annan marknad som standard.`,
        });
      }

      return { errors, data };
    },
    [validateProduct],
  );

  const validateProductForm = useCallback(
    (
      raw: any,
      options?: {
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
    ) => {
      const { errors } = buildDataAndValidate(raw, options);
      setValidationErrors(errors);
    },
    [buildDataAndValidate],
  );

  const normalizeProductRecord = useCallback((saved: any) => {
    if (!saved) {
      return saved;
    }
    return {
      ...saved,
      createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
      updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
    };
  }, []);

  const buildChannelExportPayload = useCallback((productForSync: any) => {
    if (!productForSync) {
      return null;
    }
    return {
      id: productForSync.id,
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
      condition: productForSync.condition,
      knNumber: productForSync.knNumber,
      weight: productForSync.weight ?? null,
      volume: productForSync.volume ?? null,
      volumeUnit: productForSync.volumeUnit ?? null,
      channelSpecific: productForSync.channelSpecific,
      parentProductId: productForSync.parentProductId,
      groupVariationType: productForSync.groupVariationType,
      color: productForSync.color,
      colorText: productForSync.colorText,
      size: productForSync.size,
      sizeText: productForSync.sizeText,
      model: productForSync.model,
      createdAt: productForSync.createdAt,
      updatedAt: productForSync.updatedAt,
    };
  }, []);

  const applyDesiredTargets = useCallback(
    async (
      productId: string,
      desiredTargets: Array<{ channel: string; channelInstanceId: number | null }> | undefined,
    ) => {
      if (!desiredTargets) {
        return;
      }

      const { targets: currentTargets } = await channelsApi.getProductTargets(String(productId));
      const currentSet = new Set(
        (currentTargets ?? []).map((t) =>
          (t.channelInstanceId ?? null) !== null ? `${t.channel}:${t.channelInstanceId}` : t.channel,
        ),
      );
      const desiredSet = new Set(
        desiredTargets.map((t) =>
          (t.channelInstanceId ?? null) !== null ? `${t.channel}:${t.channelInstanceId}` : t.channel,
        ),
      );
      const toEnable = desiredTargets.filter((t) => {
        const key =
          (t.channelInstanceId ?? null) !== null ? `${t.channel}:${t.channelInstanceId}` : t.channel;
        return !currentSet.has(key);
      });
      const toDisable = (currentTargets ?? []).filter((t) => {
        const key =
          (t.channelInstanceId ?? null) !== null ? `${t.channel}:${t.channelInstanceId}` : t.channel;
        return !desiredSet.has(key);
      });
      const mapUpdates = [
        ...toEnable.map((t) => ({
          channel: t.channel,
          channelInstanceId: t.channelInstanceId ?? undefined,
          enabled: true as const,
        })),
        ...toDisable.map((t) => ({
          channel: t.channel,
          channelInstanceId:
            (t.channelInstanceId ?? null) !== null ? Number(t.channelInstanceId) : undefined,
          enabled: false as const,
        })),
      ];
      if (mapUpdates.length > 0) {
        await channelsApi.setProductMapBulk({
          productId: String(productId),
          updates: mapUpdates,
        });
      }
    },
    [],
  );

  const saveOverridesBulk = useCallback(
    async (
      productId: string,
      overridesToSave:
        | Array<{
            channelInstanceId: number | string;
            active?: boolean;
            category?: string | null;
            priceAmount?: number | null;
            salePrice?: number | null;
            originalPrice?: number | null;
          }>
        | undefined,
    ) => {
      if (!overridesToSave?.length) {
        return;
      }

      await channelsApi.upsertOverridesBulk({
        productId: String(productId),
        items: overridesToSave.map((o) => ({
          channelInstanceId: o.channelInstanceId,
          active: o.active !== false,
          category: o.category ?? undefined,
          priceAmount: o.priceAmount ?? undefined,
          salePrice: o.salePrice ?? undefined,
          originalPrice: o.originalPrice ?? undefined,
        })),
      });
    },
    [],
  );

  const runSaveSync = useCallback(
    async (
      productForSync: any,
      changeSet: ProductSaveChangeSet | undefined,
      channelTargets: Array<{ channel: string; channelInstanceId: number | null }> | undefined,
      targetDetails:
        | Array<{ channel: string; channelInstanceId: number | null; market: string }>
        | undefined,
    ) => {
      const payload = buildChannelExportPayload(productForSync);
      if (!payload) {
        return;
      }

      const strictChannels = new Set(changeSet?.sync.strictChannels ?? []);
      const fullChannels = new Set(changeSet?.sync.fullChannels ?? []);
      const articleOnlyChannels = new Set(changeSet?.sync.articleOnlyChannels ?? []);
      if (strictChannels.size === 0 && fullChannels.size === 0) {
        return;
      }

      const detailsMap = new Map<string, { channel: string; channelInstanceId: number | null; market: string }>();
      for (const target of channelTargets ?? []) {
        const key =
          (target.channelInstanceId ?? null) !== null
            ? `${target.channel}:${target.channelInstanceId}`
            : target.channel;
        detailsMap.set(key, { ...target, market: '' });
      }
      for (const detail of targetDetails ?? []) {
        const key =
          (detail.channelInstanceId ?? null) !== null
            ? `${detail.channel}:${detail.channelInstanceId}`
            : detail.channel;
        detailsMap.set(key, detail);
      }
      const details = Array.from(detailsMap.values());
      const wooTargets = details.filter((t) => t.channel === 'woocommerce');
      const wooInstanceIds = wooTargets
        .map((t) => t.channelInstanceId)
        .filter((id): id is number => (id ?? null) !== null)
        .map(String);
      if (fullChannels.has('woocommerce')) {
        await woocommerceApi.exportProducts(
          [payload],
          wooInstanceIds.length > 0 ? { instanceIds: wooInstanceIds } : undefined,
        );
      } else if (strictChannels.has('woocommerce')) {
        await woocommerceApi.exportProducts(
          [payload],
          wooInstanceIds.length > 0
            ? { instanceIds: wooInstanceIds, mode: 'update_only_strict' }
            : { mode: 'update_only_strict' },
        );
      }

      const cdonMarkets = Array.from(
        new Set(details.filter((t) => t.channel === 'cdon').map((t) => t.market)),
      ).filter((market): market is 'se' | 'dk' | 'fi' => ['se', 'dk', 'fi'].includes(market));
      if (fullChannels.has('cdon') && cdonMarkets.length > 0) {
        await cdonApi.exportProducts([payload], { markets: cdonMarkets });
      } else if (strictChannels.has('cdon') && cdonMarkets.length > 0) {
        await cdonApi.exportProducts([payload], {
          markets: cdonMarkets,
          mode: 'update_only_strict',
        });
      }

      const fyndiqMarkets = Array.from(
        new Set(details.filter((t) => t.channel === 'fyndiq').map((t) => t.market)),
      ).filter((market): market is 'se' | 'dk' | 'fi' => ['se', 'dk', 'fi'].includes(market));
      if (fullChannels.has('fyndiq') && fyndiqMarkets.length > 0) {
        await fyndiqApi.exportProducts([payload], {
          markets: fyndiqMarkets,
          includePriceAndQuantity: !articleOnlyChannels.has('fyndiq'),
        });
      } else if (strictChannels.has('fyndiq') && fyndiqMarkets.length > 0) {
        await fyndiqApi.exportProducts([payload], {
          markets: fyndiqMarkets,
          mode: 'update_only_strict',
        });
      }
    },
    [buildChannelExportPayload],
  );

  const saveProduct = async (
    raw: any,
    options?: {
      changeSet?: ProductSaveChangeSet;
      ignorePriceWarning?: boolean;
      channelTargets?: Array<{ channel: string; channelInstanceId: number | null }>;
      channelTargetsWithMarket?: Array<{
        channel: string;
        channelInstanceId: number | null;
        market: string;
      }>;
      categoryOverrides?: Array<{ channelInstanceId: string; category: string | null }>;
      channelOverridesToSave?: Array<{
        channelInstanceId: number | string;
        active?: boolean;
        category?: string | null;
        priceAmount?: number | null;
      }>;
    },
  ): Promise<boolean> => {
    const { errors, data } = buildDataAndValidate(raw, {
      channelTargets: options?.channelTargets,
      channelTargetsWithMarket: options?.channelTargetsWithMarket,
      channelOverridesToSave: options?.channelOverridesToSave,
    });

    setValidationErrors(errors);
    const isWarningMessage = (message: string) =>
      /^varning\b/i.test(String(message || '').trim()) ||
      /^warning\b/i.test(String(message || '').trim());
    const blocking = errors.filter((e) => !isWarningMessage(e.message));
    const hasPriceWarning = errors.some(
      (e) =>
        e.field === 'priceAmount' &&
        /effektivt pris/i.test(String(e.message || '')),
    );
    if (blocking.length > 0 || (hasPriceWarning && !options?.ignorePriceWarning)) {
      return false;
    }

    try {
      if (currentProduct) {
        const changeSet = options?.changeSet;
        if (changeSet?.local.noChanges) {
          return true;
        }

        let productForSync: any = currentProduct;
        if (changeSet?.local.productChanged ?? true) {
          const saved = await productsApi.updateProduct(currentProduct.id, data);
          const normalized = normalizeProductRecord(saved);
          setProducts((prev) => prev.map((p) => (p.id === currentProduct.id ? normalized : p)));
          setCurrentProduct(normalized);
          productForSync = normalized;
        }
        setValidationErrors([]);

        const desiredTargets = options?.channelTargets ?? null;
        if (changeSet?.local.targetsChanged && desiredTargets) {
          try {
            await applyDesiredTargets(String(productForSync.id), desiredTargets);
          } catch (diffErr) {
            console.warn('Channel diff failed', diffErr);
          }
        }

        const overridesToSave = options?.channelOverridesToSave;
        if (changeSet?.local.overridesChanged && overridesToSave?.length && productForSync?.id) {
          try {
            await saveOverridesBulk(String(productForSync.id), overridesToSave);
          } catch (overrideErr) {
            console.warn('Channel overrides save failed', overrideErr);
          }
        }

        if (changeSet?.local.listChanged && productForSync?.id) {
          try {
            const listId =
              (data.listId ?? null) !== null && String(data.listId).trim() !== ''
                ? String(data.listId).trim()
                : null;
            const savedWithList = await productsApi.setProductList(String(productForSync.id), listId);
            const normalizedWithList = normalizeProductRecord(savedWithList);
            setProducts((prev) =>
              prev.map((p) => (p.id === currentProduct.id ? normalizedWithList : p)),
            );
            setCurrentProduct(normalizedWithList);
            productForSync = normalizedWithList;
          } catch (listErr) {
            console.warn('Set product list failed', listErr);
          }
        }

        if (
          productForSync?.id &&
          ((changeSet?.sync.strictChannels?.length ?? 0) > 0 ||
            (changeSet?.sync.fullChannels?.length ?? 0) > 0)
        ) {
          (async () => {
            try {
              await runSaveSync(
                productForSync,
                changeSet,
                options?.channelTargets,
                options?.channelTargetsWithMarket,
              );
            } catch (syncErr) {
              console.warn('Sync to channels after save failed', syncErr);
            }
          })();
        }
        clearChannelDataCache();
        closeProductPanel();
      } else {
        const saved = await productsApi.createProduct(data);
        const listId =
          (data.listId ?? null) !== null && String(data.listId).trim() !== ''
            ? String(data.listId).trim()
            : null;
        if (listId !== null) {
          try {
            await productsApi.setProductList(String(saved.id), listId);
          } catch (listErr) {
            console.warn('Set product list after create failed', listErr);
          }
        }
        const normalized = {
          ...normalizeProductRecord(saved),
          listId: listId ?? saved.listId ?? null,
          listName: saved.listName ?? null,
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
        }
        const overridesToSaveNew = options?.channelOverridesToSave;
        if (overridesToSaveNew?.length) {
          try {
            await saveOverridesBulk(String(saved.id), overridesToSaveNew);
          } catch (overrideErr) {
            console.warn('Channel overrides after create failed', overrideErr);
          }
        }
        if (desiredTargets.length > 0) {
          const productForSync = normalized;
          (async () => {
            try {
              await runSaveSync(
                productForSync,
                options?.changeSet,
                options?.channelTargets,
                options?.channelTargetsWithMarket,
              );
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
          const field = String(err?.field ?? 'general');
          const message = String(err?.message ?? '').trim();
          if (!message) {
            return;
          }
          validationErrors.push({ field, message });
        });
      }

      // If no specific field errors, show general error
      if (validationErrors.length === 0) {
        const errorMessage =
          error?.error || error?.message || 'Failed to save product. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }

      setValidationErrors(validationErrors);
      return false;
    }
  };

  const resyncProducts = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!uniqueIds.length) {
      return {};
    }

    const selected = products.filter((product) => uniqueIds.includes(String(product.id)));
    if (!selected.length) {
      return {};
    }

    const sumCounts = (
      current: { requested?: number; success?: number; error?: number } | undefined,
      next: { requested?: number; success?: number; error?: number } | undefined,
    ) => ({
      requested: (current?.requested ?? 0) + (next?.requested ?? 0),
      success: (current?.success ?? 0) + (next?.success ?? 0),
      error: (current?.error ?? 0) + (next?.error ?? 0),
    });

    const [instanceResp, targetsByProduct] = await Promise.all([
      channelsApi.getInstances({ includeDisabled: true }),
      Promise.all(
        selected.map(async (product) => ({
          product,
          targets: (await channelsApi.getProductTargets(String(product.id))).targets ?? [],
        })),
      ),
    ]);

    const instanceById = new Map(
      (instanceResp?.items ?? []).map((instance) => [String(instance.id), instance]),
    );

    const wooGroups = new Map<string, { instanceIds: string[]; products: any[] }>();
    const cdonGroups = new Map<string, { markets: Array<'se' | 'dk' | 'fi'>; products: any[] }>();
    const fyndiqGroups = new Map<string, { markets: Array<'se' | 'dk' | 'fi'>; products: any[] }>();

    for (const entry of targetsByProduct) {
      const payload = buildChannelExportPayload(entry.product);
      if (!payload) {
        continue;
      }

      const wooInstanceIds = Array.from(
        new Set(
          entry.targets
            .filter((target) => target.channel === 'woocommerce' && (target.channelInstanceId ?? null) !== null)
            .map((target) => String(target.channelInstanceId)),
        ),
      ).sort();
      const hasWooLegacy = entry.targets.some(
        (target) => target.channel === 'woocommerce' && (target.channelInstanceId ?? null) === null,
      );
      if (wooInstanceIds.length > 0 || hasWooLegacy) {
        const signature = wooInstanceIds.length > 0 ? wooInstanceIds.join(',') : 'legacy';
        const existing = wooGroups.get(signature) ?? {
          instanceIds: wooInstanceIds,
          products: [],
        };
        existing.products.push(payload);
        wooGroups.set(signature, existing);
      }

      const cdonMarkets = Array.from(
        new Set(
          entry.targets
            .filter((target) => target.channel === 'cdon' && (target.channelInstanceId ?? null) !== null)
            .map((target) => {
              const instance = instanceById.get(String(target.channelInstanceId));
              return String(instance?.market ?? '')
                .trim()
                .toLowerCase()
                .slice(0, 2);
            })
            .filter((market): market is 'se' | 'dk' | 'fi' => ['se', 'dk', 'fi'].includes(market)),
        ),
      ).sort();
      if (cdonMarkets.length > 0) {
        const signature = cdonMarkets.join(',');
        const existing = cdonGroups.get(signature) ?? { markets: cdonMarkets, products: [] };
        existing.products.push(payload);
        cdonGroups.set(signature, existing);
      }

      const fyndiqMarkets = Array.from(
        new Set(
          entry.targets
            .filter((target) => target.channel === 'fyndiq' && (target.channelInstanceId ?? null) !== null)
            .map((target) => {
              const instance = instanceById.get(String(target.channelInstanceId));
              return String(instance?.market ?? '')
                .trim()
                .toLowerCase()
                .slice(0, 2);
            })
            .filter((market): market is 'se' | 'dk' | 'fi' => ['se', 'dk', 'fi'].includes(market)),
        ),
      ).sort();
      if (fyndiqMarkets.length > 0) {
        const signature = fyndiqMarkets.join(',');
        const existing = fyndiqGroups.get(signature) ?? { markets: fyndiqMarkets, products: [] };
        existing.products.push(payload);
        fyndiqGroups.set(signature, existing);
      }
    }

    const result: {
      woo?: { ok: boolean; instances?: any[]; endpoint?: string; counts?: any };
      cdon?: { ok: boolean; counts?: any; endpoint?: string };
      fyndiq?: { ok: boolean; counts?: any; endpoint?: string };
    } = {};

    if (wooGroups.size > 0) {
      const instances: Array<{
        instanceId: string | null;
        label: string | null;
        ok: boolean;
        counts?: { requested?: number; success?: number; error?: number };
      }> = [];
      for (const group of wooGroups.values()) {
        try {
          const response = await woocommerceApi.exportProducts(group.products, {
            ...(group.instanceIds.length > 0 ? { instanceIds: group.instanceIds } : {}),
            mode: 'update_only_strict',
          });
          result.woo = {
            ok: true,
            endpoint: response?.endpoint,
            counts: sumCounts(result.woo?.counts, response?.counts),
            instances: instances,
          };
          if (group.instanceIds.length > 0) {
            for (const instanceId of group.instanceIds) {
              const instance = instanceById.get(String(instanceId));
              instances.push({
                instanceId,
                label: instance?.label ?? null,
                ok: true,
                counts: response?.counts,
              });
            }
          } else {
            instances.push({
              instanceId: null,
              label: 'Legacy WooCommerce',
              ok: true,
              counts: response?.counts,
            });
          }
        } catch (error) {
          if (group.instanceIds.length > 0) {
            for (const instanceId of group.instanceIds) {
              const instance = instanceById.get(String(instanceId));
              instances.push({
                instanceId,
                label: instance?.label ?? null,
                ok: false,
              });
            }
          } else {
            instances.push({
              instanceId: null,
              label: 'Legacy WooCommerce',
              ok: false,
            });
          }
          result.woo = {
            ok: false,
            endpoint: result.woo?.endpoint,
            counts: result.woo?.counts,
            instances,
          };
        }
      }
      if (!result.woo) {
        result.woo = { ok: false, instances };
      } else {
        result.woo.ok = instances.every((instance) => instance.ok);
      }
    }

    if (cdonGroups.size > 0) {
      for (const group of cdonGroups.values()) {
        try {
          const response = await cdonApi.exportProducts(group.products, {
            markets: group.markets,
            mode: 'update_only_strict',
          });
          result.cdon = {
            ok: (result.cdon?.ok ?? true) && !!response?.ok,
            endpoint: response?.endpoint ?? result.cdon?.endpoint,
            counts: sumCounts(result.cdon?.counts, response?.counts),
          };
        } catch (error) {
          result.cdon = {
            ok: false,
            endpoint: result.cdon?.endpoint,
            counts: result.cdon?.counts,
          };
        }
      }
    }

    if (fyndiqGroups.size > 0) {
      for (const group of fyndiqGroups.values()) {
        try {
          const response = await fyndiqApi.exportProducts(group.products, {
            markets: group.markets,
            mode: 'update_only_strict',
          });
          result.fyndiq = {
            ok: (result.fyndiq?.ok ?? true) && !!response?.ok,
            endpoint: response?.endpoint ?? result.fyndiq?.endpoint,
            counts: sumCounts(result.fyndiq?.counts, response?.counts),
          };
        } catch (error) {
          result.fyndiq = {
            ok: false,
            endpoint: result.fyndiq?.endpoint,
            counts: result.fyndiq?.counts,
          };
        }
      }
    }

    return result;
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
    if (!uniqueIds.length) {
      return;
    }

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
    updates: {
      priceAmount?: number;
      quantity?: number;
      status?: string;
      vatRate?: number;
      currency?: string;
    },
  ) => {
    const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!uniqueIds.length) {
      return { updatedCount: 0 };
    }
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ) as {
      priceAmount?: number;
      quantity?: number;
      status?: string;
      vatRate?: number;
      currency?: string;
    };
    if (Object.keys(filtered).length === 0) {
      return { updatedCount: 0 };
    }
    try {
      const result = await productsApi.batchUpdate(uniqueIds, filtered);
      setProducts((prev) =>
        prev.map((p) =>
          uniqueIds.includes(String(p.id))
            ? {
                ...p,
                ...filtered,
                status: (filtered.status as Product['status'] | undefined) ?? p.status,
              }
            : p,
        ),
      );
      return { updatedCount: result?.updatedCount ?? 0 };
    } catch (error: any) {
      console.error('Batch update failed:', error);
      throw error;
    }
  };

  const groupProducts = async (
    productIds: string[],
    groupVariationType: 'color' | 'size' | 'model',
    mainProductId?: string | null,
  ) => {
    const ids = Array.from(new Set((productIds || []).map(String))).filter(Boolean);
    if (ids.length < 2) {
      return { updatedCount: 0 };
    }
    try {
      const result = await productsApi.groupProducts(ids, groupVariationType, mainProductId);
      await loadProducts();
      return { updatedCount: result?.updatedCount ?? 0 };
    } catch (error: any) {
      console.error('Group products failed:', error);
      throw error;
    }
  };

  const importProducts = useCallback(
    async (file: File, mode: ProductImportMode): Promise<ProductImportResult> => {
      const result = await productsApi.importProducts(file, mode);
      await loadProducts();
      return result;
    },
    [loadProducts],
  );

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
      const displayId = item.id;
      const title = decodeHtmlEntities(item.title ?? '');
      const price = `${item.priceAmount} ${item.currency}`;
      if (isMobileView && price) {
        return (
          <div>
            <div>
              {displayId} • {title}
            </div>
            <div className="text-sm font-normal text-gray-600 mt-1">{price}</div>
          </div>
        );
      }
      return `${displayId} • ${title}${price ? ` • ${price}` : ''}`;
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

  const getPanelSubtitle = (_mode: string, _item: Product | null) => {
    if (batchProductIds.length > 0) {
      return 'Change only the fields you want to update; leave others empty.';
    }
    // Single product view: no subtitle row, so content starts higher
    return null;
  };

  const getDeleteMessage = (item: Product | null) => {
    if (!item) {
      return 'Are you sure you want to delete this product?';
    }
    const itemName = decodeHtmlEntities(item.title ?? '') || 'this product';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const value: ProductContextType = useMemo(
    () => ({
      isProductPanelOpen,
      currentProduct,
      panelMode,
      validationErrors,
      isSaving,
      setProductFormSaving,
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
      openProductPanelForBatch,
      closeProductPanel,
      batchProductIds,
      validateProductForm,
      saveProduct,
      resyncProducts,
      deleteProduct,
      deleteProducts,
      batchUpdateProducts,
      groupProducts,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- broad deps intentional for panel API
    [
      isProductPanelOpen,
      currentProduct,
      panelMode,
      batchProductIds,
      validationErrors,
      isSaving,
      setProductFormSaving,
      products,
      productSettings,
      loadProductSettings,
      selectedProductIds,
      toggleProductSelected,
      selectAllProducts,
      clearProductSelection,
      importProducts,
      saveProduct,
      resyncProducts,
      deleteProduct,
      deleteProducts,
      batchUpdateProducts,
      groupProducts,
      validateProductForm,
      closeProductPanel,
      openProductPanel,
      openProductForEdit,
      openProductPanelForBatch,
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
