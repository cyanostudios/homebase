import { Copy, Info, Layers, Plus, SlidersHorizontal, Tag, Trash2, X } from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
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
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_INFO_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type {
  GarmentList,
  GarmentListPayload,
  InventoryItem,
  InventoryItemPayload,
  InventoryVariantPayload,
} from '../types/garments';
import {
  buildDuplicatedVariantPayload,
  findDuplicateVariantIndices,
} from '../utils/inventoryValidation';
import { GARMENTS_SETTINGS_KEY } from '../utils/garmentColumnCount';
import { normalizeInventoryTags } from '../utils/inventoryTags';
import {
  VARIANT_COMPACT_INPUT_CLASS,
  VARIANT_COMPACT_LABEL_CLASS,
  VARIANT_EDIT_GRID_CLASS,
  VARIANT_EDIT_ROW_CLASS,
  VARIANT_WARNING_DOT_CLASS,
  VARIANT_WARNING_DOT_PLACEHOLDER_CLASS,
} from '../utils/variantListStyles';

import { InventoryListAssignmentCheckboxes } from './InventoryListAssignmentCheckboxes';

interface GarmentFormProps {
  currentGarment?: GarmentList | null;
  currentItem?: GarmentList | null;
  onSave: (data: GarmentListPayload | InventoryItemPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function emptyVariant(): InventoryVariantPayload {
  return { sku: '', audience: '', color: '', size: '', quantity: 0 };
}

export const GarmentForm = React.forwardRef<PanelFormHandle, GarmentFormProps>(function GarmentForm(
  {
    currentGarment: currentGarmentProp,
    currentItem,
    onSave,
    onCancel,
    isSubmitting: externalIsSubmitting = false,
  },
  ref,
) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const { validationErrors, clearValidationErrors, panelKind, isSaving, currentInventoryItem } =
    useGarments();
  const enabledPlugins = useEnabledPlugins();
  const hasTeams = enabledPlugins.has('teams');
  const { teams } = useTeams();
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

  const currentList = currentGarmentProp ?? currentItem ?? null;
  const isInventory = panelKind === 'inventory';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagToAdd, setTagToAdd] = useState('');
  const [listForm, setListForm] = useState<GarmentListPayload>({
    name: '',
    teamId: null,
  });
  const [inventoryForm, setInventoryForm] = useState<InventoryItemPayload>({
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
  });
  const [pendingDeleteVariantIndex, setPendingDeleteVariantIndex] = useState<number | null>(null);

  const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;
  const formKey = isInventory
    ? `garment-inventory-${currentInventoryItem?.id || 'new'}`
    : `garment-list-${currentList?.id || 'new'}`;

  useEffect(() => {
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, formKey, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setListForm({ name: '', teamId: null });
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
      variants: [],
    });
    setTagToAdd('');
    markClean();
  }, [markClean]);

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
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
    if (isInventory) {
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
          variants: (currentInventoryItem.variants || []).map((variant) => ({
            id: variant.id,
            sku: variant.sku ?? '',
            audience: variant.audience ?? '',
            color: variant.color ?? '',
            size: variant.size ?? '',
            quantity: variant.quantity ?? 0,
            sortOrder: variant.sortOrder,
          })),
        });
        setTagToAdd('');
        markClean();
      } else {
        resetForm();
      }
      return;
    }
    if (currentList) {
      setListForm({
        name: currentList.name,
        teamId: currentList.teamId,
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentInventoryItem, currentList, isInventory, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await onSave(isInventory ? inventoryForm : listForm);
      if (ok) {
        markClean();
        if (!(isInventory ? currentInventoryItem : currentList)) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentInventoryItem,
    currentList,
    inventoryForm,
    isCurrentlySubmitting,
    isInventory,
    listForm,
    markClean,
    onSave,
    resetForm,
  ]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  const handleDiscardChanges = () => {
    if (!(isInventory ? currentInventoryItem : currentList)) {
      resetForm();
      setTimeout(() => confirmDiscard(), 0);
    } else {
      confirmDiscard();
      onCancel();
    }
  };

  const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const updateListField = (field: keyof GarmentListPayload, value: string | null) => {
    setListForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const updateInventoryField = (
    field: keyof InventoryItemPayload,
    value: string | number | null | string[] | InventoryVariantPayload[],
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

  const updateVariant = (index: number, patch: Partial<InventoryVariantPayload>) => {
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
      const copy: InventoryVariantPayload = buildDuplicatedVariantPayload(source);
      const next = [...variants];
      next.splice(index + 1, 0, copy);
      return { ...prev, variants: next };
    });
    markDirty();
    clearValidationErrors();
  };

  const sidebarItem: GarmentList | InventoryItem | null = isInventory
    ? currentInventoryItem
    : currentList;

  const formSidebar = sidebarItem ? (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('garments.information')}
          icon={Info}
          subtleTitle
          className="p-4"
          collapsible
        >
          <div>
            <div className={DETAIL_INFO_ROW_CLASS}>
              <span className="text-slate-500 dark:text-slate-400">ID</span>
              <span className="font-mono font-extrabold text-foreground">
                {formatDisplayNumber('garments', sidebarItem.id)}
              </span>
            </div>
            {'createdAt' in sidebarItem && sidebarItem.createdAt ? (
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.created')}</span>
                <span className="font-mono font-extrabold text-foreground">
                  {formatDate(sidebarItem.createdAt)}
                </span>
              </div>
            ) : null}
            {'updatedAt' in sidebarItem && sidebarItem.updatedAt ? (
              <div className={DETAIL_INFO_ROW_CLASS}>
                <span className="text-slate-500 dark:text-slate-400">{t('common.updated')}</span>
                <span className="font-mono font-extrabold text-foreground">
                  {formatDate(sidebarItem.updatedAt)}
                </span>
              </div>
            ) : null}
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  const inventoryVariantTotal = (inventoryForm.variants || []).reduce(
    (sum, row) => sum + (Number(row.quantity) || 0),
    0,
  );
  const inventoryVariantCount = (inventoryForm.variants || []).length;
  const duplicateVariantIndices = useMemo(
    () => findDuplicateVariantIndices(inventoryForm.variants || []),
    [inventoryForm.variants],
  );
  const articleInitials = (inventoryForm.articleName || '—').trim().slice(0, 2).toUpperCase();

  const inventoryLeftSidebar = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <div className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
              aria-hidden
            >
              {articleInitials}
            </div>
            <div className="min-w-0 flex-1">
              <Input
                id="garment-article"
                value={inventoryForm.articleName}
                onChange={(e) => updateInventoryField('articleName', e.target.value)}
                placeholder={t('garments.articleName')}
                className={cn(
                  DETAIL_FORM_TITLE_INPUT_CLASS,
                  getFieldError('articleName') && 'border-destructive',
                )}
              />
              {getFieldError('articleName') ? (
                <p className="mt-1 text-sm text-destructive">
                  {getFieldError('articleName')?.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <DetailSection
          title={t('garments.details')}
          icon={SlidersHorizontal}
          subtleTitle
          className="p-4"
        >
          <div className="space-y-3">
            <div>
              <Label htmlFor="garment-brand">{t('garments.brand')}</Label>
              <Input
                id="garment-brand"
                value={inventoryForm.brand ?? ''}
                onChange={(e) => updateInventoryField('brand', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="garment-price">{t('garments.purchasePrice')}</Label>
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
                  className={cn(getFieldError('purchasePrice') && 'border-destructive')}
                />
                {getFieldError('purchasePrice') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('purchasePrice')?.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="garment-currency">{t('garments.currency')}</Label>
                <Input
                  id="garment-currency"
                  value={inventoryForm.currency ?? 'SEK'}
                  onChange={(e) => updateInventoryField('currency', e.target.value)}
                  maxLength={10}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="garment-recommended-price">{t('garments.recommendedPrice')}</Label>
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
                  className={cn(getFieldError('recommendedPrice') && 'border-destructive')}
                />
                {getFieldError('recommendedPrice') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('recommendedPrice')?.message}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="garment-sale-price">{t('garments.salePrice')}</Label>
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
                  className={cn(getFieldError('salePrice') && 'border-destructive')}
                />
                {getFieldError('salePrice') ? (
                  <p className="mt-1 text-sm text-destructive">
                    {getFieldError('salePrice')?.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              <Label htmlFor="garment-material">{t('garments.material')}</Label>
              <Input
                id="garment-material"
                value={inventoryForm.material ?? ''}
                onChange={(e) => updateInventoryField('material', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t('garments.totalQuantity')}
                </span>
                <div className="font-medium text-foreground">{inventoryVariantTotal}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {t('garments.variantCount')}
                </span>
                <div className="font-medium text-foreground">{inventoryVariantCount}</div>
              </div>
            </div>
            <div>
              <Label htmlFor="garment-description">{t('garments.description')}</Label>
              <Textarea
                id="garment-description"
                value={inventoryForm.description ?? ''}
                onChange={(e) => updateInventoryField('description', e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="garment-inv-comment">{t('garments.comment')}</Label>
              <Textarea
                id="garment-inv-comment"
                value={inventoryForm.comment ?? ''}
                onChange={(e) => updateInventoryField('comment', e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>{t('garments.tags')}</Label>
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
                  <SelectTrigger className="h-8 w-full text-xs sm:w-[220px]">
                    <SelectValue placeholder={t('garments.addTagPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add_tag__">
                      {addableTags.length === 0
                        ? t('garments.noMoreTagsToAdd')
                        : t('garments.addTagPlaceholder')}
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
                          aria-label={t('garments.removeTagAria', { tag: item })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('garments.noTags')}</span>
                )}
                {availableTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('garments.tagsEmptyHint')}</p>
                ) : null}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>
      <InventoryListAssignmentCheckboxes itemId={currentInventoryItem?.id} />
    </div>
  );

  const listDetailsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('garments.details')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="garment-name">{t('garments.name')}</Label>
            <Input
              id="garment-name"
              value={listForm.name}
              onChange={(e) => updateListField('name', e.target.value)}
              className={cn(getFieldError('name') && 'border-destructive')}
            />
            {getFieldError('name') ? (
              <p className="mt-1 text-sm text-destructive">{getFieldError('name')?.message}</p>
            ) : null}
          </div>
          {hasTeams ? (
            <div>
              <Label htmlFor="garment-team">{t('garments.team')}</Label>
              <Select
                value={listForm.teamId ?? '__none__'}
                onValueChange={(value) =>
                  updateListField('teamId', value === '__none__' ? null : value)
                }
              >
                <SelectTrigger id="garment-team" className="h-9">
                  <SelectValue placeholder={t('garments.teamNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('garments.teamNone')}</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {formatTeamLabel(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {!currentList ? (
            <p className="text-sm text-muted-foreground">{t('garments.defaultCheckboxesHint')}</p>
          ) : null}
        </div>
      </DetailSection>
    </Card>
  );

  const variantsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('garments.variants')}
        icon={Layers}
        subtleTitle
        className="p-4 sm:p-5"
      >
        <p className="mb-3 text-xs text-muted-foreground">{t('garments.variantsHelp')}</p>
        {duplicateVariantIndices.identity.size > 0 ? (
          <p className="mb-2 text-sm text-destructive">
            {t('garments.variantIdentityDuplicateWarning')}
          </p>
        ) : null}
        {duplicateVariantIndices.sku.size > 0 ? (
          <p className="mb-2 text-sm text-destructive">
            {t('garments.variantSkuDuplicateWarning')}
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
                    title={rowDup ? t('garments.variantIdentityDuplicateWarning') : undefined}
                  />
                  <div className={VARIANT_EDIT_GRID_CLASS}>
                    <div className="min-w-0 sm:col-span-1">
                      <Label className={VARIANT_COMPACT_LABEL_CLASS}>{t('garments.sku')}</Label>
                      <Input
                        value={variant.sku ?? ''}
                        onChange={(e) => updateVariant(index, { sku: e.target.value })}
                        placeholder={t('garments.skuPlaceholder')}
                        className={VARIANT_COMPACT_INPUT_CLASS}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                        {t('garments.audience')}
                      </Label>
                      <Input
                        value={variant.audience ?? ''}
                        onChange={(e) => updateVariant(index, { audience: e.target.value })}
                        placeholder={t('garments.audiencePlaceholder')}
                        className={VARIANT_COMPACT_INPUT_CLASS}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className={VARIANT_COMPACT_LABEL_CLASS}>{t('garments.color')}</Label>
                      <Input
                        value={variant.color ?? ''}
                        onChange={(e) => updateVariant(index, { color: e.target.value })}
                        placeholder={t('garments.colorPlaceholder')}
                        className={VARIANT_COMPACT_INPUT_CLASS}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className={VARIANT_COMPACT_LABEL_CLASS}>{t('garments.size')}</Label>
                      <Input
                        value={variant.size ?? ''}
                        onChange={(e) => updateVariant(index, { size: e.target.value })}
                        placeholder={t('garments.sizePlaceholder')}
                        className={VARIANT_COMPACT_INPUT_CLASS}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className={VARIANT_COMPACT_LABEL_CLASS}>
                        {t('garments.quantity')}
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
                        label={t('garments.duplicateVariant')}
                        variant="secondary"
                        size="xs"
                        expandOnHover={false}
                        contentClassName="text-green-600 dark:text-green-400"
                        onClick={() => duplicateVariant(index)}
                      />
                      <RoundIconLabelButton
                        type="button"
                        icon={Trash2}
                        label={t('garments.removeVariant')}
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
              label={t('garments.addVariant')}
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
      <div className="plugin-garments">
        <DetailLayout
          gridClassName={isInventory ? 'grid-cols-1 lg:grid-cols-2' : undefined}
          leftSidebar={isInventory ? inventoryLeftSidebar : undefined}
          sidebar={isInventory ? undefined : formSidebar}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
                <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                  {validationErrors
                    .filter((e) => !e.message.includes('Warning'))
                    .map((e) => (
                      <li key={`${e.field}-${e.message}`}>{e.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            {isInventory ? variantsCard : listDetailsCard}
          </form>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteVariantIndex !== null}
        title={t('garments.deleteVariant')}
        message={t('garments.deleteVariantConfirm')}
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
          (isInventory ? currentInventoryItem : currentList)
            ? t('dialog.discardAndReturn')
            : t('dialog.discardAndClose')
        }
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
