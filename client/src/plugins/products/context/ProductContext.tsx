import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, ValidationError } from '../types/products'; // TEMP: will migrate to ../types/products
import { productsApi } from '../api/productsApi';
import { useApp } from '@/core/api/AppContext';


interface ProductContextType {
  isProductPanelOpen: boolean;
  currentProduct: Product | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];
  products: Product[];
  openProductPanel: (product: Product | null) => void;
  openProductForEdit: (product: Product) => void;
  openProductForView: (product: Product) => void;
  closeProductPanel: () => void;
  saveProduct: (data: any) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<void>;
  clearValidationErrors: () => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ProductProvider({ children, isAuthenticated, onCloseOtherPanels }: ProductProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel state
  const [isProductPanelOpen, setIsProductPanelOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);

  // Load products when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    } else {
      setProducts([]);
    }
  }, [isAuthenticated]);

  // Register panel-close with AppContext (only once)
  useEffect(() => {
    registerPanelCloseFunction('products', closeProductPanel);
    return () => {
      unregisterPanelCloseFunction('products');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global form actions (plural naming)
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
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }));
      setProducts(transformed);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // TEMP: keep contact-number generator logic until we define real product fields
  const generateNextProductNumber = (): string => {
    const existingNumbers = products.map((p: any) => parseInt(p.contactNumber) || 0);
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return (maxNumber + 1).toString().padStart(2, '0');
  };

  // TEMP: validation structure; field names will be updated later
  const validateProduct = (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!data.contactNumber?.trim()) {
      errors.push({ field: 'contactNumber', message: 'Contact number is required' });
    } else {
      const existing = (products as any).find((p: any) =>
        p.id !== currentProduct?.id && p.contactNumber === data.contactNumber.trim()
      );
      if (existing) {
        errors.push({
          field: 'contactNumber',
          message: `Contact number "${data.contactNumber}" already exists for "${existing.companyName}"`
        });
      }
    }
    if (!data.companyName?.trim()) {
      errors.push({ field: 'companyName', message: data.contactType === 'company' ? 'Company name is required' : 'Full name is required' });
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

  const saveProduct = async (data: any): Promise<boolean> => {
    // TEMP: auto-number until proper product schema is defined
    if (!currentProduct && !data.contactNumber?.trim()) {
      data.contactNumber = generateNextProductNumber();
    }

    const errors = validateProduct(data);
    setValidationErrors(errors);
    const blocking = errors.filter(e => !e.message.includes('Warning'));
    if (blocking.length > 0) return false;

    try {
      if (currentProduct) {
        const saved = await productsApi.updateProduct((currentProduct as any).id, data);
        setProducts(prev => prev.map(p => (p.id === (currentProduct as any).id
          ? { ...saved, createdAt: new Date(saved.createdAt), updatedAt: new Date(saved.updatedAt) }
          : p)));
        setCurrentProduct({ ...saved, createdAt: new Date(saved.createdAt), updatedAt: new Date(saved.updatedAt) } as any);
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        const saved = await productsApi.createProduct(data);
        setProducts(prev => [...prev, { ...saved, createdAt: new Date(saved.createdAt), updatedAt: new Date(saved.updatedAt) }]);
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
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const value: ProductContextType = {
    isProductPanelOpen,
    currentProduct,
    panelMode,
    validationErrors,
    products,
    openProductPanel,
    openProductForEdit,
    openProductForView,
    closeProductPanel,
    saveProduct,
    deleteProduct,
    clearValidationErrors,
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProductContext() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
}
