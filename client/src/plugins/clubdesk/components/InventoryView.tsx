import {
  Apple,
  Archive,
  CheckCircle2,
  FilePenLine,
  Hash,
  History,
  Info,
  Layers,
  Minus,
  Plus,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_COMPACT_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { ClubdeskInventoryItem, ClubdeskInventoryVariant } from '../types/inventory';
import { formatInventoryPackageSize, formatNutritionValue } from '../utils/inventoryKioskDisplay';
import { findDuplicateVariantIndices } from '../utils/inventoryValidation';
import {
  VARIANT_LIST_ROW_CLASS,
  VARIANT_WARNING_DOT_CLASS,
  VARIANT_WARNING_DOT_PLACEHOLDER_CLASS,
} from '../utils/variantListStyles';

import { InventoryDetailHeaderMenus } from './InventoryDetailHeaderMenus';
import { ClubdeskPublicationPropertiesFields } from './ClubdeskPublicationPropertiesFields';

type InventoryViewTab =
  | 'information'
  | 'details'
  | 'productPack'
  | 'ingredients'
  | 'variants'
  | 'activity';

const INVENTORY_VIEW_TABS: InventoryViewTab[] = [
  'information',
  'details',
  'productPack',
  'ingredients',
  'variants',
  'activity',
];

function parseInventoryViewTab(value: string | null): InventoryViewTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && INVENTORY_VIEW_TABS.includes(value as InventoryViewTab)) {
    return value as InventoryViewTab;
  }
  return 'information';
}

function variantLabel(variant: ClubdeskInventoryVariant): string {
  const parts = [variant.audience?.trim(), variant.color?.trim(), variant.size?.trim()].filter(
    Boolean,
  );
  if (parts.length) {
    return parts.join(' · ');
  }
  if (variant.sku?.trim()) {
    return variant.sku.trim();
  }
  return '—';
}

function trimDisplay(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function formatVerifiedAt(value: string | null | undefined): string | null {
  const raw = trimDisplay(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatPurchasePrice(price: number | null | undefined, currency: string): string {
  if (price == null || Number.isNaN(price)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'SEK',
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency || 'SEK'}`;
  }
}

export function VariantQuantityEditor({
  variant,
  disabled,
  onQuantityChange,
}: {
  variant: ClubdeskInventoryVariant;
  disabled?: boolean;
  onQuantityChange?: (variantId: string, quantity: number) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(variant.quantity));

  useEffect(() => {
    setDraft(String(variant.quantity));
  }, [variant.id, variant.quantity]);

  const commit = async (raw: string | number) => {
    if (!onQuantityChange) {
      return;
    }
    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
    const next = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    setDraft(String(next));
    if (next === variant.quantity) {
      return;
    }
    const variantId = variant.id;
    if (!variantId) {
      return;
    }
    await onQuantityChange(variantId, next);
  };

  if (!onQuantityChange) {
    return <div className={DETAIL_FIELD_VALUE_CLASS}>{variant.quantity}</div>;
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <RoundIconLabelButton
        icon={Minus}
        label={t('clubdesk.inventory.quickContext.decreaseQuantity')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        disabled={disabled || variant.quantity <= 0}
        onClick={() => void commit(variant.quantity - 1)}
      />
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          FORM_COMPACT_INPUT_CLASS,
          'w-12 min-w-[3rem] shrink-0 px-1 text-center tabular-nums',
        )}
        aria-label={t('clubdesk.inventory.quantity')}
      />
      <RoundIconLabelButton
        icon={Plus}
        label={t('clubdesk.inventory.quickContext.increaseQuantity')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        disabled={disabled}
        onClick={() => void commit(variant.quantity + 1)}
      />
    </div>
  );
}

export function InventoryView({
  item: itemProp,
  inventory: inventoryProp,
  stacked: _stacked = false,
  onVariantQuantityChange,
  quantitySaving = false,
  readOnly = false,
  headerTrailing,
}: {
  item?: ClubdeskInventoryItem | null;
  inventory?: ClubdeskInventoryItem | null;
  stacked?: boolean;
  onVariantQuantityChange?: (variantId: string, quantity: number) => void | Promise<void>;
  quantitySaving?: boolean;
  readOnly?: boolean;
  headerTrailing?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const {
    currentInventoryItem,
    updateInventoryVariantQuantity,
    updateInventoryPublicationStatus,
    isSaving,
  } = useClubdesk();
  const item = itemProp ?? inventoryProp ?? currentInventoryItem;
  const [searchParams, setSearchParams] = useSearchParams();
  const [localTab, setLocalTab] = useState<InventoryViewTab>('information');
  const urlTab = parseInventoryViewTab(searchParams.get('tab'));
  const activeTab = readOnly ? localTab : urlTab;
  const setActiveTab = useCallback(
    (tab: InventoryViewTab) => {
      if (readOnly) {
        setLocalTab(tab);
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
        { replace: false },
      );
    },
    [readOnly, setSearchParams],
  );

  useEffect(() => {
    if (readOnly && item) {
      setLocalTab('information');
    }
  }, [item?.id, readOnly, item]);

  const onQty =
    onVariantQuantityChange ??
    (async (variantId: string, quantity: number) => {
      if (!item) return;
      await updateInventoryVariantQuantity(item.id, variantId, quantity);
    });
  const qtySaving = quantitySaving || isSaving;

  const comment = item?.comment?.trim() || '';
  const description = item?.description?.trim() || '';
  const material = item?.material?.trim() || '';
  const variants = item?.variants || [];
  const duplicateVariantIndices = useMemo(() => findDuplicateVariantIndices(variants), [variants]);
  const variantCount = item?.variantCount ?? variants.length;

  const tabs = useMemo(
    () => [
      { id: 'information' as const, label: t('clubdesk.inventory.tabs.information'), icon: Info },
      {
        id: 'details' as const,
        label: t('clubdesk.inventory.tabs.details'),
        icon: SlidersHorizontal,
      },
      {
        id: 'productPack' as const,
        label: t('clubdesk.inventory.tabs.productAndPack'),
        icon: ShoppingBag,
      },
      {
        id: 'ingredients' as const,
        label: t('clubdesk.inventory.tabs.ingredients'),
        icon: Apple,
      },
      {
        id: 'variants' as const,
        label: t('clubdesk.inventory.tabs.variants'),
        icon: Layers,
        count: variantCount > 0 ? variantCount : null,
      },
      { id: 'activity' as const, label: t('clubdesk.inventory.tabs.activity'), icon: History },
    ],
    [t, variantCount],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.garments-inventory')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={ShoppingBag}
          className="h-8 w-8 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {item?.articleName || '—'}
      </h3>
    </div>
  );

  const productFactRows: { label: string; value: string; muted?: boolean }[] = [];
  const category = trimDisplay(item?.category);
  if (category) {
    productFactRows.push({ label: t('clubdesk.inventory.productCategory'), value: category });
  }
  const packageSize = formatInventoryPackageSize(item?.packageSize, item?.packageUnit);
  if (packageSize) {
    productFactRows.push({ label: t('clubdesk.inventory.packageSize'), value: packageSize });
  }
  const itemGtin = trimDisplay(item?.gtin);
  if (itemGtin) {
    productFactRows.push({ label: t('clubdesk.inventory.itemGtin'), value: itemGtin });
  }
  const articleNumber = trimDisplay(item?.articleNumber);
  if (articleNumber) {
    productFactRows.push({ label: t('clubdesk.inventory.articleNumber'), value: articleNumber });
  }
  const netContent = trimDisplay(item?.netContent);
  if (netContent) {
    productFactRows.push({ label: t('clubdesk.inventory.netContent'), value: netContent });
  }
  const countryOfOrigin = trimDisplay(item?.countryOfOrigin);
  if (countryOfOrigin) {
    productFactRows.push({
      label: t('clubdesk.inventory.countryOfOrigin'),
      value: countryOfOrigin,
    });
  }
  const countryOfManufacture = trimDisplay(item?.countryOfManufacture);
  if (countryOfManufacture) {
    productFactRows.push({
      label: t('clubdesk.inventory.countryOfManufacture'),
      value: countryOfManufacture,
    });
  }
  const supplier = trimDisplay(item?.supplier);
  if (supplier) {
    productFactRows.push({ label: t('clubdesk.inventory.supplier'), value: supplier });
  }
  const catalogKey = trimDisplay(item?.catalogKey);
  if (catalogKey) {
    productFactRows.push({
      label: t('clubdesk.inventory.catalogKey'),
      value: catalogKey,
      muted: true,
    });
  }

  const ingredientsText = trimDisplay(item?.ingredients);
  const allergensText = trimDisplay(item?.allergens);
  const nutritionRows: { label: string; value: string }[] = [];
  const energy = formatNutritionValue(item?.energyKcal100g, 'kcal');
  if (energy) {
    nutritionRows.push({ label: t('clubdesk.inventory.nutrition.energy'), value: energy });
  }
  const fat = formatNutritionValue(item?.fatG100g, 'g');
  if (fat) {
    nutritionRows.push({ label: t('clubdesk.inventory.nutrition.fat'), value: fat });
  }
  const saturatedFat = formatNutritionValue(item?.saturatedFatG100g, 'g');
  if (saturatedFat) {
    nutritionRows.push({
      label: t('clubdesk.inventory.nutrition.saturatedFat'),
      value: saturatedFat,
    });
  }
  const carbohydrate = formatNutritionValue(item?.carbohydrateG100g, 'g');
  if (carbohydrate) {
    nutritionRows.push({
      label: t('clubdesk.inventory.nutrition.carbohydrate'),
      value: carbohydrate,
    });
  }
  const sugar = formatNutritionValue(item?.sugarG100g, 'g');
  if (sugar) {
    nutritionRows.push({ label: t('clubdesk.inventory.nutrition.sugar'), value: sugar });
  }
  const protein = formatNutritionValue(item?.proteinG100g, 'g');
  if (protein) {
    nutritionRows.push({ label: t('clubdesk.inventory.nutrition.protein'), value: protein });
  }
  const salt = formatNutritionValue(item?.saltG100g, 'g');
  if (salt) {
    nutritionRows.push({ label: t('clubdesk.inventory.nutrition.salt'), value: salt });
  }

  const hasIngredientsGroup =
    Boolean(ingredientsText) || Boolean(allergensText) || nutritionRows.length > 0;

  const provenanceParts: { label: string; value: string }[] = [];
  const source = trimDisplay(item?.source);
  if (source) {
    provenanceParts.push({ label: t('clubdesk.inventory.source'), value: source });
  }
  const verifiedAt = formatVerifiedAt(item?.verifiedAt);
  if (verifiedAt) {
    provenanceParts.push({ label: t('clubdesk.inventory.verifiedAt'), value: verifiedAt });
  }
  const dataStatus = trimDisplay(item?.dataStatus);
  if (dataStatus) {
    provenanceParts.push({ label: t('clubdesk.inventory.dataStatus'), value: dataStatus });
  }

  const propertyRows: { label: string; value: string }[] = [
    { label: t('clubdesk.inventory.brand'), value: item?.brand?.trim() || '—' },
    {
      label: t('clubdesk.inventory.purchasePrice'),
      value: formatPurchasePrice(item?.purchasePrice ?? null, item?.currency || 'SEK'),
    },
    ...(item?.recommendedPrice != null && !Number.isNaN(item.recommendedPrice)
      ? [
          {
            label: t('clubdesk.inventory.recommendedPrice'),
            value: formatPurchasePrice(item.recommendedPrice, item?.currency || 'SEK'),
          },
        ]
      : []),
    ...(item?.salePrice != null && !Number.isNaN(item.salePrice)
      ? [
          {
            label: t('clubdesk.inventory.salePrice'),
            value: formatPurchasePrice(item.salePrice, item?.currency || 'SEK'),
          },
        ]
      : []),
    { label: t('clubdesk.inventory.totalQuantity'), value: String(item?.totalQuantity ?? 0) },
    { label: t('clubdesk.inventory.variantCount'), value: String(variantCount) },
    ...(material ? [{ label: t('clubdesk.inventory.material'), value: material }] : []),
  ];

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.inventory.tabs.information')}
        icon={Info}
        subtleTitle
        className="p-6"
      >
        <div className="space-y-4">
          {item?.featuredImageUrl?.trim() ? (
            <div>
              <img
                src={item.featuredImageUrl.trim()}
                alt=""
                className="max-h-48 w-auto rounded-md object-cover"
              />
            </div>
          ) : null}
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('clubdesk.inventory.description')}</div>
            {description ? (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{description}</p>
            ) : (
              <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'mt-0.5')}>—</p>
            )}
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('clubdesk.inventory.comment')}</div>
            {comment ? (
              <div className={cn(DETAIL_NOTE_CALLOUT_CLASS, 'mt-0.5')}>
                <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                  {comment}
                </p>
              </div>
            ) : (
              <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'mt-0.5')}>—</p>
            )}
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const handlePublicationStatusChange = useCallback(
    (status: 'draft' | 'published') => {
      if (!item || readOnly) {
        return;
      }
      void updateInventoryPublicationStatus(item, status);
    },
    [item, readOnly, updateInventoryPublicationStatus],
  );

  const propertiesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.inventory.details')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <div className="space-y-4">
          <ClubdeskPublicationPropertiesFields
            values={{
              publicationStatus: item?.publicationStatus === 'draft' ? 'draft' : 'published',
              featured: false,
              slug: item?.slug,
            }}
            onPublicationStatusChange={handlePublicationStatusChange}
            showFeatured={false}
            disabled={readOnly || isSaving}
          />
          <div className="space-y-0">
            {propertyRows.map((row) => (
              <div key={row.label} className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'sm:text-right')}>{row.value}</span>
              </div>
            ))}
          </div>
          {Array.isArray(item?.tags) && item.tags.length > 0 ? (
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('clubdesk.inventory.tags')}
              </span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {item.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="rounded-md border-border/60 bg-primary/5 text-xs font-extrabold text-primary"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DetailSection>
    </Card>
  );

  const productPackCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.inventory.productAndPack')}
        icon={ShoppingBag}
        subtleTitle
        className="p-6"
      >
        {productFactRows.length === 0 && provenanceParts.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.inventory.productAndPackEmpty')}</p>
        ) : (
          <div className="space-y-4">
            {productFactRows.length > 0 ? (
              <div className="space-y-0">
                {productFactRows.map((row) => (
                  <div key={row.label} className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
                    <span
                      className={cn(
                        DETAIL_FIELD_VALUE_CLASS,
                        'sm:text-right',
                        row.muted && 'text-muted-foreground',
                      )}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {provenanceParts.length > 0 ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                {provenanceParts.map((row) => (
                  <p key={row.label}>
                    <span className="font-medium">{row.label}:</span> {row.value}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  const ingredientsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.inventory.ingredientsAndNutrition')}
        icon={Apple}
        subtleTitle
        className="p-6"
      >
        {!hasIngredientsGroup ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.inventory.ingredientsEmpty')}</p>
        ) : (
          <div className="space-y-4">
            {ingredientsText ? (
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>
                  {t('clubdesk.inventory.ingredients')}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                  {ingredientsText}
                </p>
              </div>
            ) : null}
            {allergensText ? (
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('clubdesk.inventory.allergens')}</div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                  {allergensText}
                </p>
              </div>
            ) : null}
            {nutritionRows.length > 0 ? (
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>
                  {t('clubdesk.inventory.nutritionPer100g')}
                </div>
                <div className="mt-1 space-y-0">
                  {nutritionRows.map((row) => (
                    <div key={row.label} className={DETAIL_PROP_ROW_CLASS}>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {row.label}
                      </span>
                      <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'sm:text-right tabular-nums')}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  const quantityChangeHandler = readOnly ? undefined : onQty;

  const variantsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.inventory.variants')}
        icon={Layers}
        subtleTitle
        className="p-4 sm:p-5"
      >
        {variants.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.inventory.noVariantsYet')}</p>
        ) : (
          <div className="space-y-1">
            {duplicateVariantIndices.identity.size > 0 ? (
              <p className="text-sm text-destructive">
                {t('clubdesk.inventory.variantIdentityDuplicateWarning')}
              </p>
            ) : null}
            {duplicateVariantIndices.sku.size > 0 ? (
              <p className="text-sm text-destructive">
                {t('clubdesk.inventory.variantSkuDuplicateWarning')}
              </p>
            ) : null}
            {variants.map((row, index) => {
              const rowDup = duplicateVariantIndices.any.has(index);
              const sku = row.sku?.trim() || '';
              const gtin = row.gtin?.trim() || '';
              return (
                <div key={row.id} className={VARIANT_LIST_ROW_CLASS}>
                  <span
                    className={
                      rowDup ? VARIANT_WARNING_DOT_CLASS : VARIANT_WARNING_DOT_PLACEHOLDER_CLASS
                    }
                    aria-hidden={!rowDup}
                    title={
                      rowDup ? t('clubdesk.inventory.variantIdentityDuplicateWarning') : undefined
                    }
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="min-w-0 flex-1 truncate text-xs">
                      <span className="font-semibold text-foreground">{variantLabel(row)}</span>
                      {sku ? (
                        <span
                          className={cn(
                            'text-muted-foreground',
                            duplicateVariantIndices.sku.has(index) && 'text-destructive',
                          )}
                        >
                          {' · '}
                          {sku}
                        </span>
                      ) : null}
                      {gtin ? (
                        <span className="text-muted-foreground">
                          {' · '}
                          {gtin}
                        </span>
                      ) : null}
                    </div>
                    <VariantQuantityEditor
                      variant={row}
                      disabled={qtySaving}
                      onQuantityChange={quantityChangeHandler}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  if (!item) {
    return null;
  }

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          {readOnly ? (
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">{titleLeading}</div>
              {headerTrailing ? <div className="shrink-0">{headerTrailing}</div> : null}
            </div>
          ) : (
            <InventoryDetailHeaderMenus item={item} leading={titleLeading} />
          )}
          <DetailHeaderMetaRow>
            <StatusOutlineBadge
              icon={item.publicationStatus === 'published' ? CheckCircle2 : FilePenLine}
              className={
                item.publicationStatus === 'published'
                  ? QC_STATUS_BADGE_COLORS.success
                  : QC_STATUS_BADGE_COLORS.muted
              }
            >
              {item.publicationStatus === 'published'
                ? t('clubdesk.status.published')
                : t('clubdesk.status.draft')}
            </StatusOutlineBadge>
            {item.brand?.trim() ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" aria-hidden />
                {item.brand.trim()}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" aria-hidden />
              {t('clubdesk.inventory.qty', { count: item.totalQuantity ?? 0 })}
            </span>
            {item.recommendedPrice != null && !Number.isNaN(item.recommendedPrice) ? (
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <ShoppingBag className="h-3 w-3" aria-hidden />
                {formatPurchasePrice(item.recommendedPrice, item.currency || 'SEK')}
              </span>
            ) : null}
            {item.archivedAt ? (
              <StatusOutlineBadge icon={Archive} className={QC_STATUS_BADGE_COLORS.muted}>
                {t('clubdesk.inventory.archived')}
              </StatusOutlineBadge>
            ) : null}
          </DetailHeaderMetaRow>
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>

      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'details' ? propertiesCard : null}
      {activeTab === 'productPack' ? productPackCard : null}
      {activeTab === 'ingredients' ? ingredientsCard : null}
      {activeTab === 'variants' ? variantsCard : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="inventory"
          entityId={item.id}
          limit={30}
          title={t('clubdesk.inventory.activity')}
          showClearButton={!readOnly}
          refreshKey={String(item.updatedAt ?? item.id)}
          systemId={formatDisplayNumber('clubdesk', item.id)}
        />
      ) : null}
    </DetailLayout>
  );
}
