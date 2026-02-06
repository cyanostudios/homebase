import { Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useProducts } from '../hooks/useProducts';

interface ProductFormProps {
  currentItem?: any;
  onSave: (data: any, options?: { hadChanges?: boolean }) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

type FormData = {
  productNumber: string;
  title: string;
  status: 'for sale' | 'draft' | 'archived';
  quantity: number;
  priceAmount: number;
  currency: string;
  vatRate: number;
  sku: string;
  mpn: string;
  description: string;
  mainImage: string;
  images: string[];
  categories: string[];
  brand: string;
  gtin: string;
};

export const ProductForm: React.FC<ProductFormProps> = ({
  currentItem,
  onSave,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
}) => {
  const { validationErrors, clearValidationErrors } = useProducts();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentProduct = currentItem;

  const initialState: FormData = {
    productNumber: '',
    title: '',
    status: 'for sale',
    quantity: 0,
    priceAmount: 0,
    currency: 'SEK',
    vatRate: 25,
    sku: '',
    mpn: '',
    description: '',
    mainImage: '',
    images: [],
    categories: [],
    brand: '',
    gtin: '',
  };

  const [formData, setFormData] = useState<FormData>(initialState);
  // If true: MPN mirrors SKU automatically (until user overrides MPN)
  const [isMpnAuto, setIsMpnAuto] = useState(true);
  const [newImage, setNewImage] = useState('');
  const [newCategory, setNewCategory] = useState('');

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = `product-form-${currentProduct?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentProduct, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load current product
  useEffect(() => {
    if (currentProduct) {
      const sku = currentProduct.sku ?? '';
      const mpn = currentProduct.mpn ?? '';
      setFormData({
        productNumber: currentProduct.productNumber ?? '',
        title: currentProduct.title ?? '',
        status: (currentProduct.status as FormData['status']) ?? 'for sale',
        quantity: Number.isFinite(currentProduct.quantity) ? Number(currentProduct.quantity) : 0,
        priceAmount: Number.isFinite(currentProduct.priceAmount)
          ? Number(currentProduct.priceAmount)
          : 0,
        currency: currentProduct.currency ?? 'SEK',
        vatRate: Number.isFinite(currentProduct.vatRate) ? Number(currentProduct.vatRate) : 25,
        sku,
        mpn,
        description: currentProduct.description ?? '',
        mainImage: currentProduct.mainImage ?? '',
        images: Array.isArray(currentProduct.images) ? currentProduct.images : [],
        categories: Array.isArray(currentProduct.categories) ? currentProduct.categories : [],
        brand: currentProduct.brand ?? '',
        gtin: currentProduct.gtin ?? '',
      });
      // Auto mode unless MPN differs from SKU
      setIsMpnAuto(!(mpn && mpn !== sku));
      markClean();
    } else {
      setFormData(initialState);
      setIsMpnAuto(true);
      markClean();
    }
  }, [currentProduct, markClean]);

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

      return ({ ...prev, [field]: value } as FormData);
    });
    markDirty();
    clearValidationErrors();
  };

  const updateNumber = (field: 'quantity' | 'priceAmount' | 'vatRate', raw: string) => {
    const n = raw === '' ? NaN : Number(raw.replace(',', '.'));
    updateField(field, Number.isFinite(n) ? n : field === 'vatRate' ? 25 : 0);
  };

  const handleSubmit = useCallback(async () => {
    // Clear previous errors
    clearValidationErrors();
    
    // Basic SKU check (will be validated more thoroughly in saveProduct)
    if (!String(formData.sku || '').trim()) {
      // This will be caught by saveProduct validation, but we can show immediate feedback
      return;
    }

    setIsSubmitting(true);
    try {
      const hadChanges = !!currentProduct && isDirty;
      const success = await onSave(formData, { hadChanges });
      if (success) {
        markClean();
        if (!currentProduct) {
          setFormData(initialState);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentProduct, clearValidationErrors, isDirty]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Global functions (PLURAL)
  useEffect(() => {
    (window as any).submitProductsForm = handleSubmit;
    (window as any).cancelProductsForm = handleCancel;
    return () => {
      delete (window as any).submitProductsForm;
      delete (window as any).cancelProductsForm;
    };
  }, [handleSubmit, handleCancel]);

  const getFieldError = (fieldName: string) => validationErrors.find((e) => e.field === fieldName);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

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

  const addCategory = () => {
    const v = newCategory.trim();
    if (!v) return;
    updateField('categories', [...formData.categories, v]);
    setNewCategory('');
  };

  const removeCategory = (idx: number) => {
    const next = formData.categories.slice();
    next.splice(idx, 1);
    updateField('categories', next);
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
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800">Cannot save product</h3>
              <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                {validationErrors
                  .filter((e) => !e.message.includes('Warning'))
                  .map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Identity */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Identity
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-3">
            <div>
              <Label htmlFor="productNumber" className="mb-1">Product Number</Label>
              <Input
                id="productNumber"
                type="text"
                value={formData.productNumber}
                onChange={(e) => updateField('productNumber', e.target.value)}
                placeholder="P-0001"
                className={getFieldError('productNumber') ? 'border-red-500' : ''}
              />
              {getFieldError('productNumber') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('productNumber')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="sku" className="mb-1">SKU *</Label>
              <Input
                id="sku"
                type="text"
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                placeholder="SKU-ABC-123"
                required
                className={getFieldError('sku') ? 'border-red-500' : ''}
              />
              {getFieldError('sku') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('sku')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status" className="mb-1">Status</Label>
              <NativeSelect
                id="status"
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as FormData['status'])}
                required
              >
                <option value="for sale">For sale</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </NativeSelect>
            </div>
          </div>
        </Card>

        {/* Basic info */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Basic Information
          </Heading>
          <div className="space-y-3">
            <div>
              <Label htmlFor="title" className="mb-1">Title *</Label>
              <Input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
                className={getFieldError('title') ? 'border-red-500' : ''}
              />
              {getFieldError('title') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description" className="mb-1">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your product..."
              />
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Pricing
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-4 md:gap-3">
            <div>
              <Label htmlFor="priceAmount" className="mb-1">Price *</Label>
              <Input
                id="priceAmount"
                inputMode="decimal"
                type="text"
                value={String(formData.priceAmount)}
                onChange={(e) => updateNumber('priceAmount', e.target.value)}
                placeholder="0.00"
                required
                className={getFieldError('priceAmount') ? 'border-red-500' : ''}
              />
              {getFieldError('priceAmount') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('priceAmount')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="currency" className="mb-1">Currency *</Label>
              <NativeSelect
                id="currency"
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                required
              >
                <option value="SEK">SEK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="NOK">NOK</option>
                <option value="DKK">DKK</option>
              </NativeSelect>
            </div>

            <div>
              <Label htmlFor="vatRate" className="mb-1">VAT rate (%) *</Label>
              <Input
                id="vatRate"
                inputMode="decimal"
                type="text"
                value={String(formData.vatRate)}
                onChange={(e) => updateNumber('vatRate', e.target.value)}
                placeholder="25"
                required
                className={getFieldError('vatRate') ? 'border-red-500' : ''}
              />
              {getFieldError('vatRate') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('vatRate')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="quantity" className="mb-1">Quantity *</Label>
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
          </div>
        </Card>

        {/* Additional info */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Additional Information
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div>
              <Label htmlFor="brand" className="mb-1">Brand</Label>
              <Input
                id="brand"
                type="text"
                value={formData.brand}
                onChange={(e) => updateField('brand', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="mpn" className="mb-1">MPN</Label>
              <Input
                id="mpn"
                type="text"
                value={formData.mpn}
                onChange={(e) => updateField('mpn', e.target.value)}
                placeholder="Manufacturer Part Number"
              />
            </div>

            <div>
              <Label htmlFor="gtin" className="mb-1">GTIN</Label>
              <Input
                id="gtin"
                type="text"
                value={formData.gtin}
                onChange={(e) => updateField('gtin', e.target.value)}
                placeholder="8-14 digits"
                className={getFieldError('gtin') ? 'border-yellow-500' : ''}
              />
              {getFieldError('gtin') && (
                <p className="mt-1 text-sm text-yellow-600">{getFieldError('gtin')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="mainImage" className="mb-1">Main Image URL</Label>
              <Input
                id="mainImage"
                type="url"
                value={formData.mainImage}
                onChange={(e) => updateField('mainImage', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </Card>

        {/* Images */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Images
          </Heading>
          <div className="space-y-2">
            {formData.images.map((img, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={img} readOnly className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeImage(idx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                placeholder="Image URL"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImage();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addImage}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Categories */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Categories
          </Heading>
          <div className="space-y-2">
            {formData.categories.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={cat} readOnly className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCategory(idx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        cancelText="Cancel"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </div>
  );
};
