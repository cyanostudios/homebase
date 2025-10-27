import { Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useProducts } from '../hooks/useProducts';

interface ProductFormProps {
  currentItem?: any; // must match pluginRegistry expected prop
  onSave: (data: any) => Promise<boolean> | boolean;
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
  isSubmitting = false,
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
    description: '',
    mainImage: '',
    images: [],
    categories: [],
    brand: '',
    gtin: '',
  };

  const [formData, setFormData] = useState<FormData>(initialState);
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

  // Load current product (support legacy fallbacks during transition)
  useEffect(() => {
    if (currentProduct) {
      setFormData({
        productNumber: currentProduct.productNumber ?? currentProduct.contactNumber ?? '',
        title: currentProduct.title ?? currentProduct.companyName ?? '',
        status: (currentProduct.status as FormData['status']) ?? 'for sale',
        quantity: Number.isFinite(currentProduct.quantity) ? Number(currentProduct.quantity) : 0,
        priceAmount: Number.isFinite(currentProduct.priceAmount)
          ? Number(currentProduct.priceAmount)
          : 0,
        currency: currentProduct.currency ?? 'SEK',
        vatRate: Number.isFinite(currentProduct.vatRate) ? Number(currentProduct.vatRate) : 25,
        sku: currentProduct.sku ?? '',
        description: currentProduct.description ?? '',
        mainImage: currentProduct.mainImage ?? '',
        images: Array.isArray(currentProduct.images) ? currentProduct.images : [],
        categories: Array.isArray(currentProduct.categories) ? currentProduct.categories : [],
        brand: currentProduct.brand ?? '',
        gtin: currentProduct.gtin ?? '',
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentProduct, markClean]);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setNewImage('');
    setNewCategory('');
    markClean();
  }, [markClean]);

  const updateField = (field: keyof FormData, value: string | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }) as FormData);
    markDirty();
    clearValidationErrors();
  };
  const updateNumber = (field: 'quantity' | 'priceAmount' | 'vatRate', raw: string) => {
    const n = raw === '' ? NaN : Number(raw.replace(',', '.'));
    updateField(field, Number.isFinite(n) ? n : field === 'vatRate' ? 25 : 0);
  };

  const handleSubmit = useCallback(async () => {
    const success = await onSave(formData);
    if (success) {
      markClean();
      if (!currentProduct) {
        resetForm();
      }
    }
  }, [formData, onSave, markClean, currentProduct, resetForm]);

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

  const handleDiscardChanges = () => {
    if (!currentProduct) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
    }
  };

  const getFieldError = (fieldName: string) => validationErrors.find((e) => e.field === fieldName);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  // Array helpers
  const addImage = () => {
    const v = newImage.trim();
    if (!v) {
      return;
    }
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
    if (!v) {
      return;
    }
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Number</label>
              <input
                type="text"
                value={formData.productNumber}
                onChange={(e) => updateField('productNumber', e.target.value)}
                placeholder="P-0001"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('productNumber') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {getFieldError('productNumber') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('productNumber')?.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                placeholder="SKU-ABC-123"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('sku') ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {getFieldError('sku') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('sku')?.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as FormData['status'])}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="for sale">For sale</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Basic info */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Basic Information
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('title') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {getFieldError('title') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your product..."
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <input
                inputMode="decimal"
                type="text"
                value={String(formData.priceAmount)}
                onChange={(e) => updateNumber('priceAmount', e.target.value)}
                placeholder="0.00"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('priceAmount') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {getFieldError('priceAmount') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('priceAmount')?.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="SEK">SEK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="NOK">NOK</option>
                <option value="DKK">DKK</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT rate (%)</label>
              <input
                inputMode="decimal"
                type="text"
                value={String(formData.vatRate)}
                onChange={(e) => updateNumber('vatRate', e.target.value)}
                placeholder="25"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('vatRate') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {getFieldError('vatRate') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('vatRate')?.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                inputMode="numeric"
                type="text"
                value={String(formData.quantity)}
                onChange={(e) => updateNumber('quantity', e.target.value)}
                placeholder="0"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('quantity') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {getFieldError('quantity') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('quantity')?.message}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Media */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Media
          </Heading>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main image URL</label>
              <input
                type="url"
                value={formData.mainImage}
                onChange={(e) => updateField('mainImage', e.target.value)}
                placeholder="https://…"
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add image URL
                  </label>
                  <input
                    type="url"
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    placeholder="https://…"
                    className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <Button type="button" variant="secondary" icon={Plus} onClick={addImage}>
                  Add
                </Button>
              </div>

              {formData.images.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {formData.images.map((url, i) => (
                    <li key={`${url}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{url}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => removeImage(i)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* Classification */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Classification
          </Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => updateField('brand', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GTIN</label>
              <input
                type="text"
                value={formData.gtin}
                onChange={(e) => updateField('gtin', e.target.value)}
                placeholder="EAN/UPC (8–14 digits)"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('gtin') ? 'border-yellow-500' : 'border-gray-300'
                }`}
              />
              {getFieldError('gtin') && (
                <p
                  className={`mt-1 text-sm ${getFieldError('gtin')?.message.includes('Warning') ? 'text-yellow-600' : 'text-red-600'}`}
                >
                  {getFieldError('gtin')?.message}
                </p>
              )}
            </div>

            <div className="md:col-span-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add category
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Accessories"
                    className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <Button type="button" variant="secondary" icon={Plus} onClick={addCategory}>
                  Add
                </Button>
              </div>

              {formData.categories.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {formData.categories.map((c, i) => (
                    <li
                      key={`${c}-${i}`}
                      className="flex items-center gap-2 px-2 py-1 rounded-full border text-sm"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => removeCategory(i)}
                        aria-label={`Remove ${c}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </form>

      {/* Unsaved Changes Warning Dialog */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={
          currentProduct
            ? 'You have unsaved changes. Discard changes and return to view mode?'
            : 'You have unsaved changes. Discard changes and close the form?'
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
