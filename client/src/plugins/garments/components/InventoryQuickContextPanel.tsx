import {
  Hash,
  History,
  Info,
  Layers,
  List,
  Minus,
  Package,
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
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
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

import type { InventoryItem, InventoryVariant } from '../types/garments';
import { findDuplicateVariantIndices } from '../utils/inventoryValidation';
import {
  VARIANT_LIST_ROW_CLASS,
  VARIANT_WARNING_DOT_CLASS,
  VARIANT_WARNING_DOT_PLACEHOLDER_CLASS,
} from '../utils/variantListStyles';

import { InventoryDetailHeaderMenus } from './GarmentDetailHeaderMenus';
import { InventoryListAssignmentCheckboxes } from './InventoryListAssignmentCheckboxes';

type InventoryViewTab = 'information' | 'variants' | 'lists' | 'activity';

const INVENTORY_VIEW_TABS: InventoryViewTab[] = ['information', 'variants', 'lists', 'activity'];

function parseInventoryViewTab(value: string | null): InventoryViewTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && INVENTORY_VIEW_TABS.includes(value as InventoryViewTab)) {
    return value as InventoryViewTab;
  }
  return 'information';
}

function variantLabel(variant: InventoryVariant): string {
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
  variant: InventoryVariant;
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
    await onQuantityChange(variant.id, next);
  };

  if (!onQuantityChange) {
    return <div className={DETAIL_FIELD_VALUE_CLASS}>{variant.quantity}</div>;
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <RoundIconLabelButton
        icon={Minus}
        label={t('garments.quickContext.decreaseQuantity')}
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
        aria-label={t('garments.quantity')}
      />
      <RoundIconLabelButton
        icon={Plus}
        label={t('garments.quickContext.increaseQuantity')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        disabled={disabled}
        onClick={() => void commit(variant.quantity + 1)}
      />
    </div>
  );
}

export function InventoryQuickContextPanel({
  item,
  onVariantQuantityChange,
  quantitySaving = false,
  readOnly = false,
  headerTrailing,
}: {
  item: InventoryItem;
  onVariantQuantityChange?: (variantId: string, quantity: number) => void | Promise<void>;
  quantitySaving?: boolean;
  /** Companion / browse-only: no edit chrome, local tabs (do not mutate URL). */
  readOnly?: boolean;
  /** Optional trailing control on the title row (e.g. companion close). */
  headerTrailing?: React.ReactNode;
}) {
  const { t } = useTranslation();
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
    if (readOnly) {
      setLocalTab('information');
    }
  }, [item.id, readOnly]);

  const comment = item.comment?.trim() || '';
  const description = item.description?.trim() || '';
  const material = item.material?.trim() || '';
  const variants = item.variants || [];
  const duplicateVariantIndices = useMemo(() => findDuplicateVariantIndices(variants), [variants]);
  const variantCount = item.variantCount ?? variants.length;

  const tabs = useMemo(
    () => [
      { id: 'information' as const, label: t('garments.tabs.information'), icon: Info },
      {
        id: 'variants' as const,
        label: t('garments.tabs.variants'),
        icon: Layers,
        count: variantCount > 0 ? variantCount : null,
      },
      { id: 'lists' as const, label: t('garments.tabs.lists'), icon: List },
      { id: 'activity' as const, label: t('garments.tabs.activity'), icon: History },
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
        {item.articleName || '—'}
      </h3>
    </div>
  );

  const propertyRows: { label: string; value: string }[] = [
    { label: t('garments.brand'), value: item.brand?.trim() || '—' },
    {
      label: t('garments.purchasePrice'),
      value: formatPurchasePrice(item.purchasePrice, item.currency || 'SEK'),
    },
    ...(item.recommendedPrice != null && !Number.isNaN(item.recommendedPrice)
      ? [
          {
            label: t('garments.recommendedPrice'),
            value: formatPurchasePrice(item.recommendedPrice, item.currency || 'SEK'),
          },
        ]
      : []),
    ...(item.salePrice != null && !Number.isNaN(item.salePrice)
      ? [
          {
            label: t('garments.salePrice'),
            value: formatPurchasePrice(item.salePrice, item.currency || 'SEK'),
          },
        ]
      : []),
    { label: t('garments.totalQuantity'), value: String(item.totalQuantity ?? 0) },
    { label: t('garments.variantCount'), value: String(variantCount) },
    ...(material ? [{ label: t('garments.material'), value: material }] : []),
  ];

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('garments.tabs.information')} icon={Info} subtleTitle className="p-6">
        <div className="space-y-4">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.description')}</div>
            {description ? (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{description}</p>
            ) : (
              <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'mt-0.5')}>—</p>
            )}
          </div>
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.comment')}</div>
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

  const propertiesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('garments.details')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <div className="space-y-4">
          <div className="space-y-0">
            {propertyRows.map((row) => (
              <div key={row.label} className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'sm:text-right')}>{row.value}</span>
              </div>
            ))}
          </div>
          {Array.isArray(item.tags) && item.tags.length > 0 ? (
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('garments.tags')}
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

  const quantityChangeHandler = readOnly ? undefined : onVariantQuantityChange;

  const variantsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('garments.variants')}
        icon={Layers}
        subtleTitle
        className="p-4 sm:p-5"
      >
        {variants.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('garments.noVariantsYet')}</p>
        ) : (
          <div className="space-y-1">
            {duplicateVariantIndices.identity.size > 0 ? (
              <p className="text-sm text-destructive">
                {t('garments.variantIdentityDuplicateWarning')}
              </p>
            ) : null}
            {duplicateVariantIndices.sku.size > 0 ? (
              <p className="text-sm text-destructive">{t('garments.variantSkuDuplicateWarning')}</p>
            ) : null}
            {variants.map((row, index) => {
              const rowDup = duplicateVariantIndices.any.has(index);
              const sku = row.sku?.trim() || '';
              return (
                <div key={row.id} className={VARIANT_LIST_ROW_CLASS}>
                  <span
                    className={
                      rowDup ? VARIANT_WARNING_DOT_CLASS : VARIANT_WARNING_DOT_PLACEHOLDER_CLASS
                    }
                    aria-hidden={!rowDup}
                    title={rowDup ? t('garments.variantIdentityDuplicateWarning') : undefined}
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
                    </div>
                    <VariantQuantityEditor
                      variant={row}
                      disabled={quantitySaving}
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

  const listsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('garments.assignToLists')} icon={Package} subtleTitle className="p-6">
        <InventoryListAssignmentCheckboxes itemId={item.id} embedded readOnly={readOnly} />
      </DetailSection>
    </Card>
  );

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
            {item.brand?.trim() ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" aria-hidden />
                {item.brand.trim()}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" aria-hidden />
              {t('garments.qty', { count: item.totalQuantity ?? 0 })}
            </span>
            {item.recommendedPrice != null && !Number.isNaN(item.recommendedPrice) ? (
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <ShoppingBag className="h-3 w-3" aria-hidden />
                {formatPurchasePrice(item.recommendedPrice, item.currency || 'SEK')}
              </span>
            ) : null}
          </DetailHeaderMetaRow>
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>

      {activeTab === 'information' ? informationCard : null}

      {activeTab === 'information' ? propertiesCard : null}
      {activeTab === 'variants' ? variantsCard : null}
      {activeTab === 'lists' ? listsCard : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="inventory"
          entityId={item.id}
          limit={30}
          title={t('garments.activity')}
          showClearButton={!readOnly}
          refreshKey={String(item.updatedAt ?? item.id)}
          systemId={formatDisplayNumber('garments', item.id)}
        />
      ) : null}
    </DetailLayout>
  );
}
