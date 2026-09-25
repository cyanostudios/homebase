import {
  Copy,
  History,
  Info,
  Layers,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_INPUT_ERROR_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS } from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { ValidationError } from '../types/clubdesk';
import type { ClubdeskInventoryItemPayload, ClubdeskInventoryVariant } from '../types/inventory';
import {
  buildDuplicatedVariantPayload,
  findDuplicateVariantIndices,
} from '../utils/inventoryValidation';
import { CLUBDESK_INVENTORY_SETTINGS_KEY } from '../utils/clubdeskInventorySettingsKey';
import { normalizeInventoryTags } from '../utils/inventoryTags';
import {
  VARIANT_COMPACT_INPUT_CLASS,
  VARIANT_COMPACT_LABEL_CLASS,
  VARIANT_EDIT_GRID_CLASS,
  VARIANT_EDIT_ROW_CLASS,
  VARIANT_WARNING_DOT_CLASS,
  VARIANT_WARNING_DOT_PLACEHOLDER_CLASS,
} from '../utils/variantListStyles';

interface InventoryFormProps {
  onCancel?: () => void;
  isSubmitting?: boolean;
  stacked?: boolean;
  headerTrailing?: React.ReactNode;
}

function emptyVariant(): ClubdeskInventoryVariant {
  return { sku: '', audience: '', color: '', size: '', quantity: 0 };
}

type InventoryFormTab = 'information' | 'variants' | 'activity';

const INVENTORY_FORM_TABS: InventoryFormTab[] = ['information', 'variants', 'activity'];

const INVENTORY_FORM_EDIT_DISABLED_TABS: ReadonlySet<InventoryFormTab> = new Set(['activity']);

const INVENTORY_TAB_ERROR_FIELDS: Record<InventoryFormTab, string[]> = {
  information: [
    'description',
    'comment',
    'articleName',
    'purchasePrice',
    'recommendedPrice',
    'salePrice',
  ],
  variants: ['variants'],
  activity: [],
};

function parseInventoryFormTab(value: string | null): InventoryFormTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && INVENTORY_FORM_TABS.includes(value as InventoryFormTab)) {
    return value as InventoryFormTab;
  }
  return 'information';
}

export const InventoryForm = React.forwardRef<PanelFormHandle, InventoryFormProps>(
  function InventoryForm(
    {
      onCancel,
      isSubmitting: externalIsSubmitting = false,
      stacked: _stacked = false,
      headerTrailing,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseInventoryFormTab(searchParams.get('tab'));
    const setActiveTab = useCallback(
      (tab: InventoryFormTab, replace = false) => {
        if (INVENTORY_FORM_EDIT_DISABLED_TABS.has(tab)) {
          return;
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (tab === 'information') {
              next.delete('tab');
            } else {
              next.set('tab', tab);
            }
            return next;
          },
          { replace },
        );
      },
      [setSearchParams],
    );

    useEffect(() => {
      if (!INVENTORY_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          return next;
        },
        { replace: true },
      );
    }, [activeTab, setSearchParams]);

    const { getSettings, settingsVersion } = useApp();
    const {
      validationErrors,
      clearValidationErrors,
      isSaving,
      currentInventoryItem,
      saveInventoryItem,
      closeClubdeskPanel,
    } = useClubdesk();
    const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
      useUnsavedChanges();
    const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
      useGlobalNavigationGuard();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [tagToAdd, setTagToAdd] = useState('');
    const [inventoryForm, setInventoryForm] = useState<ClubdeskInventoryItemPayload>({
      articleName: '',
      brand: '',
      description: null,
      material: '',
      purchasePrice: null,
      recommendedPrice: null,
      salePrice: null,
      currency: 'SEK',
      comment: null,
      tags: [],
      variants: [],
      slug: '',
      featuredImageUrl: null,
      publicationStatus: 'draft',
      featured: false,
    });
    const [pendingDeleteVariantIndex, setPendingDeleteVariantIndex] = useState<number | null>(null);

    const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;
    const formKey = `clubdesk-inventory-${currentInventoryItem?.id || 'new'}`;

    useEffect(() => {
      registerUnsavedChangesChecker(formKey, () => true);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [formKey, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    const resetForm = useCallback(() => {
      setInventoryForm({
        articleName: '',
        brand: '',
        description: null,
        material: '',
        purchasePrice: null,
        recommendedPrice: null,
        salePrice: null,
        currency: 'SEK',
        comment: null,
        tags: [],
        slug: '',
        featuredImageUrl: null,
        publicationStatus: 'draft',
        featured: false,
        variants: [],
      });
      setTagToAdd('');
      markClean();
    }, [markClean]);

    useEffect(() => {
      let cancelled = false;
      getSettings(CLUBDESK_INVENTORY_SETTINGS_KEY)
        .then((settings) => {
          if (cancelled) {
            return;
          }
          setAvailableTags(normalizeInventoryTags(settings?.tags));
        })
        .catch(() => {
          if (!cancelled) {
            setAvailableTags([]);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [getSettings, settingsVersion]);

    useEffect(() => {
      if (currentInventoryItem) {
        setInventoryForm({
          articleName: currentInventoryItem.articleName,
          brand: currentInventoryItem.brand,
          description: currentInventoryItem.description,
          material: currentInventoryItem.material ?? '',
          purchasePrice: currentInventoryItem.purchasePrice,
          recommendedPrice: currentInventoryItem.recommendedPrice,
          salePrice: currentInventoryItem.salePrice,
          currency: currentInventoryItem.currency || 'SEK',
          comment: currentInventoryItem.comment,
          tags: normalizeInventoryTags(currentInventoryItem.tags),
          slug: currentInventoryItem.slug ?? '',
          featuredImageUrl: currentInventoryItem.featuredImageUrl,
          publicationStatus:
            currentInventoryItem.publicationStatus === 'published' ? 'published' : 'draft',
          featured: currentInventoryItem.featured === true,
          variants: (currentInventoryItem.variants || []).map(
            (variant: ClubdeskInventoryVariant) => ({
              id: variant.id,
              sku: variant.sku ?? '',
              audience: variant.audience ?? '',
              color: variant.color ?? '',
              size: variant.size ?? '',
              quantity: variant.quantity ?? 0,
              sortOrder: variant.sortOrder,
            }),
          ),
        });
        setTagToAdd('');
        markClean();
      } else {
        resetForm();
      }
    }, [currentInventoryItem, markClean, resetForm]);

    const handleSubmit = useCallback(async () => {
      if (isCurrentlySubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await saveInventoryItem(inventoryForm);
        if (ok) {
          markClean();
          if (!currentInventoryItem) {
            resetForm();
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    }, [
      currentInventoryItem,
      inventoryForm,
      isCurrentlySubmitting,
      markClean,
      resetForm,
      saveInventoryItem,
    ]);

    const handleCancel = useCallback(() => {
      attemptAction(() => (onCancel ? onCancel() : closeClubdeskPanel()), { force: true });
    }, [attemptAction, closeClubdeskPanel, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
      }),
      [handleSubmit, handleCancel],
    );

    const handleDiscardChanges = () => {
      if (!currentInventoryItem) {
        resetForm();
      }
      // pendingAction from handleCancel is already onCancel — do not call it twice
      // (edit cancel returns to view; a second call would close the panel).
      confirmDiscard();
    };

    const getFieldError = (field: string) =>
      validationErrors.find((err: ValidationError) => err.field === field);
    const hasBlockingErrors = validationErrors.some(
      (e: ValidationError) => !e.message.includes('Warning'),
    );

    const updateInventoryField = (
      field: keyof ClubdeskInventoryItemPayload,
      value: string | number | null | string[] | ClubdeskInventoryVariant[],
    ) => {
      setInventoryForm((prev) => ({ ...prev, [field]: value }));
      markDirty();
      clearValidationErrors();
    };

    const formTags = Array.isArray(inventoryForm.tags) ? inventoryForm.tags : [];
    const addableTags = useMemo(
      () =>
        availableTags.filter(
          (item) => !formTags.some((tag) => tag.toLowerCase() === item.toLowerCase()),
        ),
      [availableTags, formTags],
    );

    const addInventoryTag = (tag: string) => {
      setInventoryForm((prev) => ({
        ...prev,
        tags: normalizeInventoryTags([...(prev.tags ?? []), tag]),
      }));
      setTagToAdd('');
      markDirty();
      clearValidationErrors();
    };

    const removeInventoryTag = (tag: string) => {
      setInventoryForm((prev) => ({
        ...prev,
        tags: (prev.tags ?? []).filter((item) => item !== tag),
      }));
      markDirty();
      clearValidationErrors();
    };

    const addVariant = () => {
      setInventoryForm((prev) => ({
        ...prev,
        variants: [...(prev.variants || []), emptyVariant()],
      }));
      markDirty();
      clearValidationErrors();
    };

    const updateVariant = (index: number, patch: Partial<ClubdeskInventoryVariant>) => {
      setInventoryForm((prev) => ({
        ...prev,
        variants: (prev.variants || []).map((row, i) => (i === index ? { ...row, ...patch } : row)),
      }));
      markDirty();
      clearValidationErrors();
    };

    const removeVariant = (index: number) => {
      setInventoryForm((prev) => ({
        ...prev,
        variants: (prev.variants || []).filter((_, i) => i !== index),
      }));
      markDirty();
      clearValidationErrors();
    };

    /** Insert a copy of the variant immediately after it (no id — treated as new on save). */
    const duplicateVariant = (index: number) => {
      setInventoryForm((prev) => {
        const variants = prev.variants || [];
        const source = variants[index];
        if (!source) {
          return prev;
        }
        const copy: ClubdeskInventoryVariant = buildDuplicatedVariantPayload(source);
        const next = [...variants];
        next.splice(index + 1, 0, copy);
        return { ...prev, variants: next };
      });
      markDirty();
      clearValidationErrors();
    };

    const inventoryVariantTotal = (inventoryForm.variants || []).reduce(
      (sum, row) => sum + (Number(row.quantity) || 0),
      0,
    );
    const inventoryVariantCount = (inventoryForm.variants || []).length;
    const duplicateVariantIndices = useMemo(
      () => findDuplicateVariantIndices(inventoryForm.variants || []),
      [inventoryForm.variants],
    );

    const tabHasError = (tab: InventoryFormTab) =>
      INVENTORY_TAB_ERROR_FIELDS[tab].some((field) =>
        validationErrors.some((e: ValidationError) => e.field === field),
      );

    const inventoryTabs = useMemo(
      () => [
        { id: 'information' as const, label: t('clubdesk.inventory.tabs.information'), icon: Info },
        {
          id: 'variants' as const,
          label: t('clubdesk.inventory.tabs.variants'),
          icon: Layers,
          count: inventoryVariantCount > 0 ? inventoryVariantCount : null,
        },
        { id: 'activity' as const, label: t('clubdesk.inventory.tabs.activity'), icon: History },
      ],
      [inventoryVariantCount, t],
    );

    const inventoryTabChips = (
      <div className={LIST_FILTER_CHIP_ROW_CLASS}>
        {inventoryTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isDisabled = INVENTORY_FORM_EDIT_DISABLED_TABS.has(tab.id);
          const isActive = !isDisabled && activeTab === tab.id;
          const hasError = !isDisabled && tabHasError(tab.id);
          return (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              title={
                isDisabled
                  ? t('clubdesk.inventory.tabUnavailableInEdit', {
                      defaultValue: 'Available in view mode only',
                    })
                  : undefined
              }
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
                isDisabled && 'pointer-events-none opacity-40',
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                {'count' in tab && tab.count != null ? (
                  <>
                    {' '}
                    <span className="tabular-nums font-semibold">({tab.count})</span>
                  </>
                ) : null}
                {hasError ? (
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                    aria-label={t('common.error', { defaultValue: 'Error' })}
                  />
                ) : null}
              </span>
            </Button>
          );
        })}
      </div>
    );

    const inventoryFormHeader = (
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0" aria-hidden>
              <SectionCategoryIcon
                icon={ShoppingBag}
                className="h-8 w-8 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 [&_svg]:h-4 [&_svg]:w-4"
              />
            </span>
            <div className="min-w-0 flex-1">
              <Input
                id="garment-article"
                value={inventoryForm.articleName}
                onChange={(e) => updateInventoryField('articleName', e.target.value)}
                placeholder={t('clubdesk.inventory.articleName')}
                aria-label={t('clubdesk.inventory.articleName')}
                className={cn(
                  DETAIL_FORM_TITLE_INPUT_CLASS,
                  getFieldError('articleName') && FORM_INPUT_ERROR_CLASS,
                )}
              />
              {getFieldError('articleName') ? (
                <p className="mt-1 text-sm text-destructive">
                  {getFieldError('articleName')?.message}
                </p>
              ) : null}
            </div>
            {headerTrailing ? (
              <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
            ) : null}
          </div>
          <div className="mt-4">{inventoryTabChips}</div>
        </div>
      </Card>
    );

    const inventoryInformationCard = (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('clubdesk.inventory.tabs.information')}
          icon={Info}
          subtleTitle
          className="p-6"
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="garment-description">{t('clubdesk.inventory.description')}</Label>
              <Textarea
                id="garment-description"
                value={inventoryForm.description ?? ''}
                onChange={(e) => updateInventoryField('description', e.target.value)}
                rows={4}
                className={FORM_GHOST_TEXTAREA_CLASS}
              />
            </div>
            <div>
              <Label htmlFor="garment-inv-comment">{t('clubdesk.inventory.comment')}</Label>
              <Textarea
                id="garment-inv-comment"
                value={inventoryForm.comment ?? ''}
                onChange={(e) => updateInventoryField('comment', e.target.value)}
                rows={3}
                className={FORM_GHOST_TEXTAREA_CLASS}
              />
            </div>
          </div>
        </DetailSection>
      </Card>
    );

    const inventoryPropertiesCard = (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('clubdesk.inventory.details')}
          icon={SlidersHorizontal}
          subtleTitle
          className="p-6"
        >
          <div className="space-y-3">
            <div>
              <Label htmlFor="garment-brand">{t('clubdesk.inventory.brand')}</Label>
              <Input
                id="garment-brand"
                value={inventoryForm.brand ?? ''}
                onChange={(e) => updateInventoryField('brand', e.target.value)}
                className={FORM_GHOST_INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="garment-price">{t('clubdesk.inventory.purchasePrice')}</Label>
                <Input
                  id="garment-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inventoryForm.purchasePrice ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateInventoryField('purchasePrice', raw === '' ? null : Number(raw));
                  }}
                  className={cn(
                    FORM_GHOST_INPUT_CLASS,
                    getFieldError('purchasePrice') && FORM_INPUT_ERROR_CLASS,
                  )}
                />
                {getFieldError('purchasePrice') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('purchasePrice')?.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="garment-currency">{t('clubdesk.inventory.currency')}</Label>
                <Input
                  id="garment-currency"
                  value={inventoryForm.currency ?? 'SEK'}
                  onChange={(e) => updateInventoryField('currency', e.target.value)}
                  maxLength={10}
                  className={FORM_GHOST_INPUT_CLASS}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="garment-recommended-price">
                  {t('clubdesk.inventory.recommendedPrice')}
                </Label>
                <Input
                  id="garment-recommended-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inventoryForm.recommendedPrice ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateInventoryField('recommendedPrice', raw === '' ? null : Number(raw));
                  }}
                  className={cn(
                    FORM_GHOST_INPUT_CLASS,
                    getFieldError('recommendedPrice') && FORM_INPUT_ERROR_CLASS,
                  )}
                />
                {getFieldError('recommendedPrice') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('recommendedPrice')?.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="garment-sale-price">{t('clubdesk.inventory.salePrice')}</Label>
                <Input
                  id="garment-sale-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={inventoryForm.salePrice ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateInventoryField('salePrice', raw === '' ? null : Number(raw));
                  }}
                  className={cn(
                    FORM_GHOST_INPUT_CLASS,
                    getFieldError('salePrice') && FORM_INPUT_ERROR_CLASS,
                  )}
                />
                {getFieldError('salePrice') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('salePrice')?.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              <Label htmlFor="garment-material">{t('clubdesk.inventory.material')}</Label>
              <Input
                id="garment-material"
                value={inventoryForm.material ?? ''}
                onChange={(e) => updateInventoryField('material', e.target.value)}
                className={FORM_GHOST_INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t('clubdesk.inventory.totalQuantity')}
                </span>
                <div className="font-medium text-foreground">{inventoryVariantTotal}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t('clubdesk.inventory.variantCount')}
                </span>
                <div className="font-medium text-foreground">{inventoryVariantCount}</div>
              </div>
            </div>
            <div>
              <Label>{t('clubdesk.inventory.tags')}</Label>
              <div className="mt-1.5 space-y-2">
                <Select
                  value={tagToAdd || '__add_tag__'}
                  onValueChange={(value) => {
                    if (value && value !== '__add_tag__') {
                      addInventoryTag(value);
                    }
                  }}
                  disabled={addableTags.length === 0}
                >
                  <SelectTrigger className={cn(FORM_GHOST_INPUT_CLASS, 'sm:w-[220px]')}>
                    <SelectValue placeholder={t('clubdesk.inventory.addTagPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add_tag__">
                      {addableTags.length === 0
                        ? t('clubdesk.inventory.noMoreTagsToAdd')
                        : t('clubdesk.inventory.addTagPlaceholder')}
                    </SelectItem>
                    {addableTags.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {formTags.map((item) => (
                      <Badge
                        key={item}
                        className="flex items-center gap-1 rounded-md border-0 bg-slate-100 text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Tag className="h-3 w-3" />
                        {item}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-muted"
                          onClick={() => removeInventoryTag(item)}
                          aria-label={t('clubdesk.inventory.removeTagAria', { tag: item })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t('clubdesk.inventory.noTags')}
                  </span>
                )}
                {availableTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('clubdesk.inventory.tagsEmptyHint')}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>
    );

    const variantsCard = (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('clubdesk.inventory.variants')}
          icon={Layers}
          subtleTitle
          className="p-4 sm:p-5"
        >
          <p className="mb-3 text-xs text-muted-foreground">
            {t('clubdesk.inventory.variantsHelp')}
          </p>
          {duplicateVariantIndices.identity.size > 0 ? (
            <p className="mb-2 text-sm text-destructive">
              {t('clubdesk.inventory.variantIdentityDuplicateWarning')}
            </p>
          ) : null}
          {duplicateVariantIndices.sku.size > 0 ? (
            <p className="mb-2 text-sm text-destructive">
              {t('clubdesk.inventory.variantSkuDuplicateWarning')}
            </p>
          ) : null}
          {getFieldError('variants') ? (
            <p className="mb-2 text-sm text-destructive">{getFieldError('variants')?.message}</p>
          ) : null}
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              {(inventoryForm.variants || []).map((variant, index) => {
                const rowDup = duplicateVariantIndices.any.has(index);
                return (
                  <div key={variant.id ?? `new-${index}`} className={VARIANT_EDIT_ROW_CLASS}>
                    <span
                      className={
                        rowDup ? VARIANT_WARNING_DOT_CLASS : VARIANT_WARNING_DOT_PLACEHOLDER_CLASS
                      }
                      aria-hidden={!rowDup}
                      title={
                        rowDup ? t('clubdesk.inventory.variantIdentityDuplicateWarning') : undefined
                      }
                    />
                    <div className={VARIANT_EDIT_GRID_CLASS}>
                      <div className="min-w-0 sm:col-span-1">
                        <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                          {t('clubdesk.inventory.sku')}
                        </Label>
                        <Input
                          value={variant.sku ?? ''}
                          onChange={(e) => updateVariant(index, { sku: e.target.value })}
                          placeholder={t('clubdesk.inventory.skuPlaceholder')}
                          className={VARIANT_COMPACT_INPUT_CLASS}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                          {t('clubdesk.inventory.audience')}
                        </Label>
                        <Input
                          value={variant.audience ?? ''}
                          onChange={(e) => updateVariant(index, { audience: e.target.value })}
                          placeholder={t('clubdesk.inventory.audiencePlaceholder')}
                          className={VARIANT_COMPACT_INPUT_CLASS}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                          {t('clubdesk.inventory.color')}
                        </Label>
                        <Input
                          value={variant.color ?? ''}
                          onChange={(e) => updateVariant(index, { color: e.target.value })}
                          placeholder={t('clubdesk.inventory.colorPlaceholder')}
                          className={VARIANT_COMPACT_INPUT_CLASS}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                          {t('clubdesk.inventory.size')}
                        </Label>
                        <Input
                          value={variant.size ?? ''}
                          onChange={(e) => updateVariant(index, { size: e.target.value })}
                          placeholder={t('clubdesk.inventory.sizePlaceholder')}
                          className={VARIANT_COMPACT_INPUT_CLASS}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                          {t('clubdesk.inventory.quantity')}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={variant.quantity ?? 0}
                          onChange={(e) =>
                            updateVariant(index, { quantity: Number(e.target.value) || 0 })
                          }
                          className={VARIANT_COMPACT_INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-2 flex shrink-0 items-end justify-end gap-0.5 sm:col-span-1 sm:justify-start">
                        <RoundIconLabelButton
                          type="button"
                          icon={Copy}
                          label={t('clubdesk.inventory.duplicateVariant')}
                          variant="secondary"
                          size="xs"
                          expandOnHover={false}
                          contentClassName="text-green-600 dark:text-green-400"
                          onClick={() => duplicateVariant(index)}
                        />
                        <RoundIconLabelButton
                          type="button"
                          icon={Trash2}
                          label={t('clubdesk.inventory.removeVariant')}
                          variant="dangerSoft"
                          size="xs"
                          expandOnHover={false}
                          onClick={() => setPendingDeleteVariantIndex(index)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <RoundIconLabelButton
                type="button"
                icon={Plus}
                label={t('clubdesk.inventory.addVariant')}
                variant="soft"
                size="xs"
                alwaysExpanded
                onClick={addVariant}
              />
            </div>
          </div>
        </DetailSection>
      </Card>
    );

    return (
      <>
        <div className="plugin-clubdesk-inventory">
          <DetailLayout gridClassName="grid-cols-1" sidebar={undefined}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              {hasBlockingErrors && (
                <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                  <div className="text-sm font-medium text-destructive">
                    {t('common.cannotSave')}
                  </div>
                  <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                    {validationErrors
                      .filter((e: ValidationError) => !e.message.includes('Warning'))
                      .map((e: ValidationError) => (
                        <li key={`${e.field}-${e.message}`}>{e.message}</li>
                      ))}
                  </ul>
                </Card>
              )}

              {inventoryFormHeader}
              {activeTab === 'information' ? inventoryInformationCard : null}
              {activeTab === 'information' ? inventoryPropertiesCard : null}
              {activeTab === 'variants' ? variantsCard : null}
            </form>
          </DetailLayout>
        </div>

        <ConfirmDialog
          isOpen={pendingDeleteVariantIndex !== null}
          title={t('clubdesk.inventory.deleteVariant')}
          message={t('clubdesk.inventory.deleteVariantConfirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          onConfirm={() => {
            if (pendingDeleteVariantIndex !== null) {
              removeVariant(pendingDeleteVariantIndex);
            }
            setPendingDeleteVariantIndex(null);
          }}
          onCancel={() => setPendingDeleteVariantIndex(null)}
          variant="danger"
        />

        <ConfirmDialog
          isOpen={showWarning}
          title={t('dialog.unsavedChanges')}
          message={
            currentInventoryItem ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')
          }
          confirmText={t('common.discard')}
          cancelText={t('common.continueEditing')}
          onConfirm={handleDiscardChanges}
          onCancel={cancelDiscard}
          variant="warning"
        />
      </>
    );
  },
);
