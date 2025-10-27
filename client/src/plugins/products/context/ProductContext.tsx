// client/src/plugins/products/context/ProductContext.tsx
import { ShoppingCart } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';
import { Badge } from '@/core/ui/Badge';

import { productsApi } from '../api/productsApi';
import type { Product, ValidationError } from '../types/products';

interface ProductContextType {
  // Panel state
  isProductPanelOpen: boolean;
  currentProduct: Product | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  products: Product[];

  // NEW: selection state (IDs as strings)
  selectedProductIds: string[];
  toggleProductSelected: (id: string) => void;
  selectAllProducts: (ids: string[]) => void; // sets selection to provided list
  clearProductSelection: () => void;

  // Panel actions
  openProductPanel: (product: Product | null) => void;
  openProductForEdit: (product: Product) => void;
  openProductForView: (product: Product) => void;
  closeProductPanel: () => void;

  // CRUD actions
  saveProduct: (data: any) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<void>;

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
  onCloseOtherPanels: () => void; // kept for API compatibility, not used in open*
}

export function ProductProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels, // eslint-disable-line @typescript-eslint/no-unused-vars
}: ProductProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel state
  const [isProductPanelOpen, setIsProductPanelOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);

  // NEW: per-row selection state (IDs normalized to string)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Load products when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    } else {
      setProducts([]);
      setSelectedProductIds([]); // clear selection on logout
    }
  }, [isAuthenticated]);

  // Keep selection valid when the product list changes (drop IDs that disappeared)
  useEffect(() => {
    if (!products?.length) {
      if (selectedProductIds.length) {
        setSelectedProductIds([]);
      }
      return;
    }
    const existing = new Set(products.map((p) => String((p as any).id)));
    setSelectedProductIds((prev) => prev.filter((id) => existing.has(id)));
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register panel-close with AppContext (only once)
  useEffect(() => {
    registerPanelCloseFunction('products', closeProductPanel);
    return () => {
      unregisterPanelCloseFunction('products');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global form actions (PLURAL) - kept for keyboard/guard integration
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

  const loadProducts = async () => {
    try {
      const data = await productsApi.getProducts();
      const transformed = data.map((item: any) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
      }));
      setProducts(transformed);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Generate next product number (numeric, zero-padded) with legacy fallback support
  const generateNextProductNumber = (): string => {
    const toNum = (val: any) => {
      if (!val) return 0;
      const s = String(val);
      const m = s.match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : parseInt(s, 10) || 0;
    };
    const existingNumbers = products.map((p: any) => toNum(p.productNumber ?? p.contactNumber));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return String(maxNumber + 1).padStart(2, '0'); // e.g. "01", "02", …
  };

  // MVP validation (no legacy fields)
  const validateProduct = (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    const add = (field: string, message: string) => errors.push({ field, message });
    const isFiniteNumber = (n: any) => typeof n === 'number' && Number.isFinite(n);

    // Required
    if (!data.title?.trim()) add('title', 'Title is required');
    if (!data.status || !['for sale', 'draft', 'archived'].includes(String(data.status))) {
      add('status', 'Status must be one of: for sale, draft, archived');
    }

    // Numbers
    if (!isFiniteNumber(data.quantity) || data.quantity < 0 || !Number.isInteger(data.quantity)) {
      add('quantity', 'Quantity must be a non-negative integer');
    }
    if (!isFiniteNumber(data.priceAmount) || data.priceAmount < 0) {
      add('priceAmount', 'Price must be a non-negative number');
    }
    if (!isFiniteNumber(data.vatRate) || data.vatRate < 0 || data.vatRate > 50) {
      add('vatRate', 'VAT rate must be between 0 and 50');
    }

    // Currency
    if (!data.currency?.trim()) {
      add('currency', 'Currency is required');
    } else {
      const c = String(data.currency).toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) add('currency', 'Currency must be a 3-letter code (e.g., SEK)');
    }

    // Uniqueness (scoped to current user list we have in memory)
    if (data.productNumber?.trim()) {
      const pn = data.productNumber.trim();
      const clash = (products as any).find(
        (p: any) =>
          p.id !== currentProduct?.id && String(p.productNumber ?? p.contactNumber) === pn,
      );
      if (clash) {
        add(
          'productNumber',
          `Product number "${pn}" already exists (used by "${clash.title ?? clash.companyName ?? 'another product'}")`,
        );
      }
    }
    if (data.sku?.trim()) {
      const sku = data.sku.trim();
      const clash = (products as any).find(
        (p: any) => p.id !== currentProduct?.id && String(p.sku || '') === sku,
      );
      if (clash) {
        add('sku', `SKU "${sku}" already exists (used by "${clash.title ?? clash.companyName ?? 'another product'}")`);
      }
    }

    // GTIN soft warning
    if (data.gtin?.trim() && !/^\d{8,14}$/.test(String(data.gtin).trim())) {
      errors.push({ field: 'gtin', message: 'Warning: GTIN should be 8–14 digits' });
    }

    return errors;
  };

  // Panel actions (NO onCloseOtherPanels here to avoid self-closing)
  const openProductPanel = (product: Product | null) => {
    setCurrentProduct(product);
    setPanelMode(product ? 'edit' : 'create');
    setIsProductPanelOpen(true);
    setValidationErrors([]);
  };

  const openProductForEdit = (product: Product) => {
    setCurrentProduct(product);
    setPanelMode('edit');
    setIsProductPanelOpen(true);
    setValidationErrors([]);
  };

  const openProductForView = (product: Product) => {
    setCurrentProduct(product);
    setPanelMode('view');
    setIsProductPanelOpen(true);
    setValidationErrors([]);
  };

  const closeProductPanel = () => {
    setIsProductPanelOpen(false);
    setCurrentProduct(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const saveProduct = async (raw: any): Promise<boolean> => {
    const data = {
      productNumber: (raw.productNumber ?? '').trim(),
      title: (raw.title ?? '').trim(),
      status: raw.status,
      quantity: Number(raw.quantity ?? 0),
      priceAmount: Number(raw.priceAmount ?? 0),
      currency: (raw.currency ?? 'SEK').toUpperCase(),
      vatRate: Number(raw.vatRate ?? 25),
      sku: (raw.sku ?? '').trim(),
      description: raw.description ?? '',
      mainImage: raw.mainImage ?? '',
      images: Array.isArray(raw.images) ? raw.images : [],
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      brand: (raw.brand ?? '').trim(),
      gtin: (raw.gtin ?? '').trim(),
    };

    // Auto-generate productNumber on create if missing
    if (!currentProduct && !data.productNumber) {
      data.productNumber = generateNextProductNumber();
    }

    const errors = validateProduct(data);
    setValidationErrors(errors);
    const blocking = errors.filter((e) => !e.message.includes('Warning'));
    if (blocking.length > 0) return false;

    try {
      if (currentProduct) {
        const saved = await productsApi.updateProduct((currentProduct as any).id, data);
        const normalized = {
          ...saved,
          createdAt: saved.createdAt ? new Date(saved.createdAt) : null,
          updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
        };
        setProducts((prev) =>
          prev.map((p) => (p.id === (currentProduct as any).id ? normalized : p)),
        );
        setCurrentProduct(normalized as any);
        setPanelMode('view');
        setValidationErrors([]);
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
    } catch (error) {
      console.error('Failed to save product:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save product. Please try again.' }]);
      return false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productsApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedProductIds((prev) => prev.filter((pid) => pid !== String(id)));
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

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
  // --------------------------------------

  // Panel titles/subtitles/delete message
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
