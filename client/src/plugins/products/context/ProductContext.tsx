// client/src/plugins/products/context/ProductContext.tsx
import { ShoppingCart } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

import { productsApi, type ProductImportMode, type ProductImportResult } from '../api/productsApi';
import type { Product, ValidationError } from '../types/products';
import { channelsApi } from '@/plugins/channels/api/channelsApi';
import { woocommerceApi } from '@/plugins/woocommerce-products/api/woocommerceApi';
import { cdonApi } from '@/plugins/cdon-products/api/cdonApi';
import { fyndiqApi } from '@/plugins/fyndiq-products/api/fyndiqApi';

interface ProductContextType {
  // Panel state
  isProductPanelOpen: boolean;
  currentProduct: Product | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  products: Product[];

  // selection (IDs as strings)
  selectedProductIds: string[];
  toggleProductSelected: (id: string) => void;
  selectAllProducts: (ids: string[]) => void;
  clearProductSelection: () => void;

  // Panel actions
  openProductPanel: (product: Product | null) => void;
  openProductForEdit: (product: Product) => void;
  openProductForView: (product: Product) => void;
  closeProductPanel: () => void;

  // CRUD actions
  saveProduct: (data: any, options?: { hadChanges?: boolean }) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<void>;
  deleteProducts: (ids: string[]) => Promise<void>; // bulk
  batchUpdateProducts: (ids: string[], updates: { priceAmount?: number; quantity?: number; status?: string; vatRate?: number; currency?: string }) => Promise<{ updatedCount: number }>;
  importProducts: (file: File, mode: ProductImportMode) => Promise<ProductImportResult>;

  clearValidationErrors: () => void;

  // Panel Title Functions
  getPanelTitle: (mode: string, item: Product | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Product | null) => any;
  getDeleteMessage: (item: Product | null) => string;
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel state
  const [isProductPanelOpen, setIsProductPanelOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);

  // selection
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

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

  // Reload when user returns to tab (handles "after a while" / tab switch)
  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProducts();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
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

  // Global form actions
  useEffect(() => {
    (window as any).submitProductsForm = () => {
      const event = new CustomEvent('submitProductForm');
      window.dispatchEvent(event);
    };
    (window as any).cancelProductsForm = () => {
      const event = new CustomEvent('cancelProductForm');
      window.dispatchEvent(event);
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

    if (data.gtin?.trim() && !/^\d{8,14}$/.test(String(data.gtin).trim())) {
      errors.push({ field: 'gtin', message: 'Warning: GTIN should be 8–14 digits' });
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
    setIsProductPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openProductForView = (product: Product) => {
    setCurrentProduct(product);
    setPanelMode('view');
    setIsProductPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeProductPanel = () => {
    setIsProductPanelOpen(false);
    setCurrentProduct(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const saveProduct = async (raw: any, options?: { hadChanges?: boolean }): Promise<boolean> => {
    const data = {
      productNumber: (raw.productNumber ?? '').trim(),
      title: (raw.title ?? '').trim(),
      status: raw.status,
      quantity: Number(raw.quantity ?? 0),
      priceAmount: Number(raw.priceAmount ?? 0),
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
      gtin: (raw.gtin ?? '').trim(),
    };

    if (!currentProduct && !data.productNumber) {
      data.productNumber = generateNextProductNumber();
    }

    const errors = validateProduct(data);
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
        setPanelMode('view');
        setValidationErrors([]);

        if (options?.hadChanges) {
          try {
            const { targets } = await channelsApi.getProductTargets(String(saved.id));
            if (targets?.length) {
              const payload = {
                id: saved.id,
                productNumber: saved.productNumber,
                sku: saved.sku,
                mpn: saved.mpn,
                title: saved.title,
                status: saved.status,
                quantity: saved.quantity,
                priceAmount: saved.priceAmount,
                currency: saved.currency,
                vatRate: saved.vatRate,
                description: saved.description,
                mainImage: saved.mainImage,
                images: saved.images,
                categories: saved.categories,
                brand: saved.brand,
                gtin: saved.gtin,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt,
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
            }
          } catch (syncErr) {
            console.warn('Sync to channels after save failed', syncErr);
          }
        }
      } else {
        const saved = await productsApi.createProduct(data);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
        };
        setProducts((prev) => [...prev, normalized]);
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
    if (mode === 'view' && item) {
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
    if (mode === 'view' && item) {
      const statusColors: Record<string, string> = {
        'for sale': 'bg-green-100 text-green-800',
        draft: 'bg-gray-100 text-gray-800',
        archived: 'bg-red-100 text-red-800',
      };
      const badgeColor = statusColors[item.status] || statusColors.draft;
      const badgeText = item.status?.charAt(0).toUpperCase() + item.status?.slice(1);
      const quantityText = item.quantity !== undefined ? `Qty: ${item.quantity}` : '';
      return (
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" style={{ color: '#2563eb' }} />
          <Badge className={badgeColor}>{badgeText}</Badge>
          {quantityText && <span className="text-xs text-gray-600">• {quantityText}</span>}
        </div>
      );
    }
    switch (mode) {
      case 'edit':
        return 'Update product information';
      case 'create':
        return 'Enter new product details';
      default:
        return '';
    }
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

      // selection
      selectedProductIds,
      toggleProductSelected,
      selectAllProducts,
      clearProductSelection,

      // actions
      openProductPanel,
      openProductForEdit,
      openProductForView,
      closeProductPanel,
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
    }),
    [
      isProductPanelOpen,
      currentProduct,
      panelMode,
      validationErrors,
      products,
      selectedProductIds,
      toggleProductSelected,
      selectAllProducts,
      clearProductSelection,
      importProducts,
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
