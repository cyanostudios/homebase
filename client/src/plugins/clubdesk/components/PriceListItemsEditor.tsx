import { ArrowDown, ArrowUp, Copy, Link2, Search, Trash2, Unlink, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { BULK_ACTION_DESTRUCTIVE_CONTENT_CLASS } from '@/core/ui/BulkActionRoundBar';
import { listReorderRowStyle } from '@/core/ui/listReorderTransition';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_ERROR_CLASS } from '@/core/ui/formFieldStyles';
import { cn } from '@/lib/utils';

import { clubdeskApi } from '../api/clubdeskApi';
import { useClubdeskContext } from '../context/ClubdeskContext';
import type { ClubdeskInventoryItem, ClubdeskInventoryVariant } from '../types/inventory';
import type { ClubdeskPriceListItemPayload } from '../types/priceList';
import { canReorderItemWithinCategory } from '../utils/priceListItemOps';
import {
  buildInventoryLinkPatch,
  clearInventoryLinkPatch,
  formatInventoryVariantLabel,
} from '../utils/priceListInventoryLink';
import {
  LINE_ITEM_COMPACT_INPUT_CLASS,
  LINE_ITEM_COMPACT_LABEL_CLASS,
  LINE_ITEM_COMPACT_SELECT_CLASS,
  LINE_ITEM_EDIT_ROW_CLASS,
  LINE_ITEM_EDIT_SCROLL_CLASS,
  LINE_ITEM_FIELD_CLASS,
  LINE_ITEM_SECONDARY_TEXT_CLASS,
  PRICE_LIST_ITEM_EDIT_GRID_CLASS,
  PRICE_LIST_ITEM_EDIT_TRACK_CLASS,
  PRICE_LIST_ITEM_PRICE_CATEGORY_ROW_CLASS,
  PRICE_LIST_ITEM_STACK_CLASS,
  PRICE_LIST_UNLINK_CONTENT_CLASS,
} from '../utils/priceListItemStyles';

export type PriceListItemsEditorProps = {
  items: ClubdeskPriceListItemPayload[];
  categoryOptions: string[];
  duplicatedIndexes: Set<number>;
  getTitleError?: (index: number) => string | undefined;
  onUpdate: (index: number, patch: Partial<ClubdeskPriceListItemPayload>) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
};

function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim() === '';
}

function ItemActions({
  index,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: {
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center gap-1.5 self-start pt-4">
      <RoundIconLabelButton
        type="button"
        icon={ArrowUp}
        label={t('clubdesk.priceList.moveItemUp')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        onClick={() => onMoveUp(index)}
        disabled={!canMoveUp}
      />
      <RoundIconLabelButton
        type="button"
        icon={ArrowDown}
        label={t('clubdesk.priceList.moveItemDown')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        onClick={() => onMoveDown(index)}
        disabled={!canMoveDown}
      />
      <RoundIconLabelButton
        type="button"
        icon={Copy}
        label={t('clubdesk.priceList.copyItem')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        contentClassName="text-green-600 dark:text-green-400"
        onClick={() => onDuplicate(index)}
      />
      <RoundIconLabelButton
        type="button"
        icon={Trash2}
        label={t('clubdesk.priceList.removeItem')}
        variant="secondary"
        size="xs"
        expandOnHover={false}
        contentClassName={BULK_ACTION_DESTRUCTIVE_CONTENT_CLASS}
        onClick={() => onDelete(index)}
      />
    </div>
  );
}

function InventoryLinkRow({
  item,
  index,
  onUpdate,
}: {
  item: ClubdeskPriceListItemPayload;
  index: number;
  onUpdate: (index: number, patch: Partial<ClubdeskPriceListItemPayload>) => void;
}) {
  const { t } = useTranslation();
  const { inventoryItems } = useClubdeskContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingItem, setPendingItem] = useState<ClubdeskInventoryItem | null>(null);
  const [pendingVariantId, setPendingVariantId] = useState<string>('__none__');
  const [loadingDetail, setLoadingDetail] = useState(false);

  const linked = Boolean(item.inventoryItemId);
  const linkedLabel = [item.inventoryArticleName, item.inventoryVariantLabel]
    .filter((p) => (p ?? '').trim())
    .join(' · ');

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = inventoryItems;
    const filtered = !q
      ? rows
      : rows.filter((row) => {
          const hay = `${row.articleName} ${row.brand}`.toLowerCase();
          return hay.includes(q);
        });
    return filtered.slice(0, 40);
  }, [inventoryItems, search]);

  const closePicker = () => {
    setPickerOpen(false);
    setSearch('');
    setPendingItem(null);
    setPendingVariantId('__none__');
    setLoadingDetail(false);
  };

  const applyLink = (full: ClubdeskInventoryItem, variant: ClubdeskInventoryVariant | null) => {
    onUpdate(index, buildInventoryLinkPatch(full, variant, item));
    closePicker();
  };

  const selectArticle = async (row: ClubdeskInventoryItem) => {
    setLoadingDetail(true);
    try {
      const full =
        Array.isArray(row.variants) && row.variants.length > 0
          ? row
          : await clubdeskApi.getInventoryItem(row.id);
      if ((full.variants?.length ?? 0) > 0) {
        setPendingItem(full);
        setPendingVariantId('__none__');
      } else {
        applyLink(full, null);
      }
    } catch (error) {
      console.error('Failed to load inventory item for price list link', error);
      applyLink(row, null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const confirmPending = () => {
    if (!pendingItem) {
      return;
    }
    const variant =
      pendingVariantId === '__none__'
        ? null
        : ((pendingItem.variants || []).find((v) => String(v.id) === pendingVariantId) ?? null);
    applyLink(pendingItem, variant);
  };

  return (
    <div className="contents">
      <div className="shrink-0 self-end">
        {linked ? (
          <RoundIconLabelButton
            type="button"
            icon={Unlink}
            label={t('clubdesk.priceList.unlinkInventory')}
            variant="secondary"
            size="xs"
            expandOnHover={false}
            contentClassName={PRICE_LIST_UNLINK_CONTENT_CLASS}
            onClick={() => onUpdate(index, clearInventoryLinkPatch())}
          />
        ) : (
          <Popover
            open={pickerOpen}
            onOpenChange={(open) => {
              if (!open) {
                closePicker();
              } else {
                setPickerOpen(true);
              }
            }}
          >
            <PopoverAnchor asChild>
              <div>
                <RoundIconLabelButton
                  type="button"
                  icon={Link2}
                  label={t('clubdesk.priceList.linkInventory')}
                  variant="soft"
                  size="xs"
                  expandOnHover={false}
                  onClick={() => setPickerOpen(true)}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={4}
              className="z-[120] w-[min(22rem,100vw-2rem)] rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
            >
              <div className="space-y-2 p-1">
                {pendingItem ? (
                  <div className="space-y-2 px-1 py-1">
                    <p className="text-xs font-semibold">{pendingItem.articleName}</p>
                    <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                      {t('clubdesk.priceList.pickVariant')}
                    </Label>
                    <Select value={pendingVariantId} onValueChange={setPendingVariantId}>
                      <SelectTrigger className={LINE_ITEM_COMPACT_SELECT_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[130]">
                        <SelectItem value="__none__">
                          {t('clubdesk.priceList.noSpecificVariant')}
                        </SelectItem>
                        {(pendingItem.variants || []).map((v) => (
                          <SelectItem key={String(v.id)} value={String(v.id)}>
                            {formatInventoryVariantLabel(v) ||
                              t('clubdesk.priceList.variantFallback')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2 pt-1">
                      <RoundIconLabelButton
                        type="button"
                        icon={X}
                        label={t('common.cancel')}
                        variant="secondary"
                        size="xs"
                        alwaysExpanded
                        onClick={() => {
                          setPendingItem(null);
                          setPendingVariantId('__none__');
                        }}
                      />
                      <RoundIconLabelButton
                        type="button"
                        icon={Link2}
                        label={t('clubdesk.priceList.useInventory')}
                        variant="soft"
                        size="xs"
                        alwaysExpanded
                        onClick={confirmPending}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative px-1 pt-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('clubdesk.priceList.searchInventory')}
                        className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'pl-8')}
                        autoFocus
                        disabled={loadingDetail}
                      />
                    </div>
                    {inventoryItems.length === 0 ? (
                      <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'px-2 py-3 text-left text-xs')}>
                        {t('clubdesk.priceList.emptyInventoryHint')}
                      </p>
                    ) : suggestions.length === 0 ? (
                      <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'px-2 py-3 text-left text-xs')}>
                        {t('clubdesk.priceList.noInventoryMatches')}
                      </p>
                    ) : (
                      <div className="max-h-52 overflow-y-auto">
                        {suggestions.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            className={cn(
                              'flex w-full items-start rounded-lg px-2.5 py-2 text-left',
                              DETAIL_LIST_ITEM_HOVER_CLASS,
                            )}
                            disabled={loadingDetail}
                            onClick={() => void selectArticle(row)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-extrabold">
                                {row.articleName}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {[
                                  row.brand,
                                  row.variantCount > 0
                                    ? t('clubdesk.priceList.variantCount', {
                                        count: row.variantCount,
                                      })
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {linked ? (
        <div className="col-span-2">
          <span className={LINE_ITEM_SECONDARY_TEXT_CLASS}>
            {t('clubdesk.priceList.inventoryMeta', {
              name: linkedLabel || item.inventoryArticleName || item.title,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function PriceListItemsEditor({
  items,
  categoryOptions,
  duplicatedIndexes,
  getTitleError,
  onUpdate,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: PriceListItemsEditorProps) {
  const { t } = useTranslation();
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

  const handleDeleteClick = (index: number) => {
    const item = items[index];
    const hasContent =
      (item.title?.trim() ?? '') !== '' ||
      (item.description?.replace(/<[^>]*>/g, '').trim() ?? '') !== '' ||
      (item.price ?? 0) !== 0 ||
      (item.priceOverride != null && Number(item.priceOverride) !== 0) ||
      Boolean(item.inventoryItemId);
    if (hasContent) {
      setPendingDeleteIndex(index);
    } else {
      onRemove(index);
    }
  };

  return (
    <>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.priceList.noItemsYet')}</p>
        </div>
      ) : (
        <div className={LINE_ITEM_EDIT_SCROLL_CLASS}>
          <div className={PRICE_LIST_ITEM_EDIT_TRACK_CLASS}>
            {items.map((item, index) => {
              const titleError = getTitleError?.(index);
              const isDuplicated = duplicatedIndexes.has(index);
              const inventoryCatalog =
                item.inventoryCatalogPrice != null &&
                Number.isFinite(Number(item.inventoryCatalogPrice))
                  ? Number(item.inventoryCatalogPrice)
                  : null;
              const listPriceFollowing =
                item.priceOverride == null || !Number.isFinite(Number(item.priceOverride));
              const listPriceValue = listPriceFollowing
                ? (inventoryCatalog ?? '')
                : Number(item.priceOverride);
              return (
                <div
                  key={
                    item.clientKey ||
                    `price-list-item-${item.sequenceOrder}-${item.category ?? ''}-${item.title}`
                  }
                  className={cn(
                    LINE_ITEM_EDIT_ROW_CLASS,
                    isDuplicated && 'bg-green-50 dark:bg-green-950/30',
                  )}
                  style={listReorderRowStyle(
                    item.clientKey ||
                      `price-list-item-${item.sequenceOrder}-${item.category ?? ''}-${item.title}`,
                  )}
                >
                  <div className={PRICE_LIST_ITEM_EDIT_GRID_CLASS}>
                    <div className={PRICE_LIST_ITEM_STACK_CLASS}>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1">
                        <div className={LINE_ITEM_FIELD_CLASS}>
                          <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                            {t('clubdesk.priceList.title')}
                          </Label>
                          <Input
                            value={item.title}
                            onChange={(e) => onUpdate(index, { title: e.target.value })}
                            placeholder={t('clubdesk.priceList.itemTitlePlaceholder')}
                            className={cn(
                              LINE_ITEM_COMPACT_INPUT_CLASS,
                              'font-semibold',
                              titleError && FORM_INPUT_ERROR_CLASS,
                            )}
                          />
                        </div>
                        <InventoryLinkRow item={item} index={index} onUpdate={onUpdate} />
                      </div>
                      <div
                        className={cn(
                          PRICE_LIST_ITEM_PRICE_CATEGORY_ROW_CLASS,
                          item.inventoryItemId && 'grid-cols-3',
                        )}
                      >
                        {item.inventoryItemId ? (
                          <>
                            <div className={LINE_ITEM_FIELD_CLASS}>
                              <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                                {t('clubdesk.priceList.inventoryPrice')}
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={
                                  item.inventoryCatalogPrice != null &&
                                  Number.isFinite(Number(item.inventoryCatalogPrice))
                                    ? item.inventoryCatalogPrice
                                    : ''
                                }
                                readOnly
                                tabIndex={-1}
                                className={cn(
                                  LINE_ITEM_COMPACT_INPUT_CLASS,
                                  'text-right text-muted-foreground',
                                )}
                              />
                            </div>
                            <div className={LINE_ITEM_FIELD_CLASS}>
                              <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                                {t('clubdesk.priceList.listPrice')}
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={listPriceValue}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  if (raw === '') {
                                    onUpdate(index, {
                                      priceOverride: null,
                                      price: inventoryCatalog ?? 0,
                                    });
                                    return;
                                  }
                                  const n = Number(raw);
                                  if (!Number.isFinite(n)) {
                                    return;
                                  }
                                  // Typing the catalog amount keeps following inventory.
                                  if (inventoryCatalog != null && n === inventoryCatalog) {
                                    onUpdate(index, {
                                      priceOverride: null,
                                      price: inventoryCatalog,
                                    });
                                    return;
                                  }
                                  onUpdate(index, {
                                    priceOverride: n,
                                    price: n,
                                  });
                                }}
                                className={cn(
                                  LINE_ITEM_COMPACT_INPUT_CLASS,
                                  'text-right',
                                  listPriceFollowing && 'text-muted-foreground',
                                )}
                              />
                            </div>
                          </>
                        ) : (
                          <div className={LINE_ITEM_FIELD_CLASS}>
                            <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                              {t('clubdesk.priceList.price')}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) =>
                                onUpdate(index, {
                                  price: Number(e.target.value) || 0,
                                  priceOverride: null,
                                })
                              }
                              className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'text-right')}
                            />
                          </div>
                        )}
                        <div className={LINE_ITEM_FIELD_CLASS}>
                          <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                            {t('clubdesk.priceList.category')}
                          </Label>
                          <Select
                            value={item.category?.trim() ? item.category : '__none__'}
                            onValueChange={(value) =>
                              onUpdate(
                                index,
                                value === '__none__' ? { category: null } : { category: value },
                              )
                            }
                          >
                            <SelectTrigger className={LINE_ITEM_COMPACT_SELECT_CLASS}>
                              <SelectValue
                                placeholder={t('clubdesk.priceList.categoryPlaceholder')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                {t('clubdesk.priceList.categoryNone')}
                              </SelectItem>
                              {categoryOptions.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className={cn(LINE_ITEM_FIELD_CLASS, 'h-full')}>
                      <Label className={LINE_ITEM_COMPACT_LABEL_CLASS}>
                        {t('clubdesk.priceList.description')}
                      </Label>
                      <Textarea
                        value={item.description ?? ''}
                        onChange={(e) => {
                          const html = e.target.value;
                          onUpdate(index, {
                            description: isEmptyRichText(html) ? null : html,
                          });
                        }}
                        rows={2}
                        placeholder={t('clubdesk.priceList.itemDescriptionPlaceholder')}
                        className={cn(
                          LINE_ITEM_COMPACT_INPUT_CLASS,
                          'min-h-[2.75rem] flex-1 resize-y py-1.5',
                        )}
                      />
                    </div>
                    <ItemActions
                      index={index}
                      canMoveUp={canReorderItemWithinCategory(items, index, -1)}
                      canMoveDown={canReorderItemWithinCategory(items, index, 1)}
                      onMoveUp={onMoveUp}
                      onMoveDown={onMoveDown}
                      onDuplicate={onDuplicate}
                      onDelete={handleDeleteClick}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteIndex !== null}
        title={t('clubdesk.priceList.removeItem')}
        message={t('clubdesk.priceList.removeItemConfirm', {
          defaultValue: 'Remove this item from the price list?',
        })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          if (pendingDeleteIndex !== null) {
            onRemove(pendingDeleteIndex);
          }
          setPendingDeleteIndex(null);
        }}
        onCancel={() => setPendingDeleteIndex(null)}
      />
    </>
  );
}
