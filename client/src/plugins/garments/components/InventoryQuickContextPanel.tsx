import { Hash, Minus, Plus, ShoppingBag, Shirt, Tag } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { useGarments } from '../hooks/useGarments';
import type { InventoryItem, InventoryVariant } from '../types/garments';
import { findDuplicateVariantIndices } from '../utils/inventoryValidation';
import {
  VARIANT_LIST_ROW_CLASS,
  VARIANT_WARNING_DOT_CLASS,
  VARIANT_WARNING_DOT_PLACEHOLDER_CLASS,
} from '../utils/variantListStyles';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

const LIST_CONTENT_PREVIEW_CHARS = 1200;

function inventoryInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '—';
}

function truncatePlainText(
  content: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  const plain = content.trim();
  if (!plain) {
    return { text: '', truncated: false };
  }
  if (plain.length <= maxChars) {
    return { text: plain, truncated: false };
  }
  const slice = plain.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return { text: `${plain.slice(0, cut).trimEnd()}…`, truncated: true };
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
        className="h-8 w-12 min-w-[3rem] shrink-0 px-1 py-0 text-center text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
  onClose,
  onOpenFullProfile,
  onEdit,
  onVariantQuantityChange,
  quantitySaving = false,
  variant = 'list',
}: {
  item: InventoryItem;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  onVariantQuantityChange?: (variantId: string, quantity: number) => void | Promise<void>;
  quantitySaving?: boolean;
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const { t } = useTranslation();
  const { garmentLists } = useGarments();
  const [contentExpanded, setContentExpanded] = useState(false);

  useEffect(() => {
    setContentExpanded(false);
  }, [item.id]);

  const updatedLabel = item.updatedAt
    ? new Date(item.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const comment = item.comment?.trim() || '';
  const description = item.description?.trim() || '';
  const descriptionPreview = useMemo(
    () => truncatePlainText(description, LIST_CONTENT_PREVIEW_CHARS),
    [description],
  );
  const displayedDescription = contentExpanded ? description : descriptionPreview.text;
  const showReadMoreToggle = descriptionPreview.truncated && !isFullView;
  const variants = item.variants || [];
  const duplicateVariantIndices = useMemo(() => findDuplicateVariantIndices(variants), [variants]);
  const assignedLists = useMemo(() => {
    const ids = new Set((item.assignedListIds ?? []).map(String));
    return garmentLists.filter((list) => ids.has(String(list.id)));
  }, [garmentLists, item.assignedListIds]);

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
        aria-hidden
      >
        {inventoryInitials(item.articleName)}
      </div>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1')}>{item.articleName || '—'}</h3>
      <QuickContextHeaderActions
        onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
        onEdit={onEdit}
        onClose={!isFullView && onClose ? onClose : undefined}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  const factGrid = (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Tag className="h-3 w-3" />
          {t('garments.brand')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>{item.brand?.trim() || '—'}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <ShoppingBag className="h-3 w-3" />
          {t('garments.purchasePrice')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>
          {formatPurchasePrice(item.purchasePrice, item.currency || 'SEK')}
        </div>
      </div>
      {item.recommendedPrice != null && !Number.isNaN(item.recommendedPrice) ? (
        <div>
          <div className={FACT_LABEL_CLASS}>
            <ShoppingBag className="h-3 w-3" />
            {t('garments.recommendedPrice')}
          </div>
          <div className={DETAIL_FIELD_VALUE_CLASS}>
            {formatPurchasePrice(item.recommendedPrice, item.currency || 'SEK')}
          </div>
        </div>
      ) : null}
      {item.salePrice != null && !Number.isNaN(item.salePrice) ? (
        <div>
          <div className={FACT_LABEL_CLASS}>
            <ShoppingBag className="h-3 w-3" />
            {t('garments.salePrice')}
          </div>
          <div className={DETAIL_FIELD_VALUE_CLASS}>
            {formatPurchasePrice(item.salePrice, item.currency || 'SEK')}
          </div>
        </div>
      ) : null}
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Hash className="h-3 w-3" />
          {t('garments.totalQuantity')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>{item.totalQuantity ?? 0}</div>
      </div>
      <div>
        <div className={FACT_LABEL_CLASS}>
          <Hash className="h-3 w-3" />
          {t('garments.variantCount')}
        </div>
        <div className={DETAIL_FIELD_VALUE_CLASS}>{item.variantCount ?? variants.length}</div>
      </div>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="border-b border-border/50 px-4 py-5">{identityHeader}</div>

      <div
        className={cn(
          'min-w-0 overflow-x-hidden px-4 py-4',
          isFullView ? 'space-y-4' : 'space-y-6',
        )}
      >
        {updatedLabel ? (
          <p className="text-xs text-muted-foreground">
            {t('common.updated')} {updatedLabel}
          </p>
        ) : null}

        {factGrid}

        <div>
          <div className={FACT_LABEL_CLASS}>
            <Shirt className="h-3 w-3" />
            {t('garments.assignToLists')}
          </div>
          {assignedLists.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {assignedLists.map((list) => (
                <Badge
                  key={list.id}
                  variant="outline"
                  className="rounded-md border-border/60 bg-primary/5 text-xs font-extrabold text-primary"
                >
                  {list.name || '—'}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('garments.quickContext.notInAnyList')}
            </p>
          )}
        </div>

        {displayedDescription ? (
          <div>
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('garments.description')}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{displayedDescription}</p>
            {showReadMoreToggle ? (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-primary hover:underline"
                onClick={() => setContentExpanded((open) => !open)}
              >
                {contentExpanded
                  ? t('garments.quickContext.showLess')
                  : t('garments.quickContext.readMore')}
              </button>
            ) : null}
          </div>
        ) : null}

        {comment ? (
          <div>
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {t('garments.comment')}
              </span>
            </div>
            <div className={DETAIL_NOTE_CALLOUT_CLASS}>
              <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                {comment}
              </p>
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {t('garments.variants')}
            </span>
          </div>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('garments.noVariantsYet')}</p>
          ) : (
            <div className="space-y-1">
              {duplicateVariantIndices.identity.size > 0 ? (
                <p className="text-sm text-destructive">
                  {t('garments.variantIdentityDuplicateWarning')}
                </p>
              ) : null}
              {duplicateVariantIndices.sku.size > 0 ? (
                <p className="text-sm text-destructive">
                  {t('garments.variantSkuDuplicateWarning')}
                </p>
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
                        onQuantityChange={onVariantQuantityChange}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!isFullView && onOpenFullProfile ? (
        <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
      ) : null}
    </Card>
  );
}
