import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FilePenLine,
  Folders,
  History,
  Info,
  SlidersHorizontal,
  Star,
  Tags,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { AlertDialogRoundCancel, AlertDialogRoundDelete } from '@/core/ui/DialogRoundButtons';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import { listReorderRowStyle } from '@/core/ui/listReorderTransition';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { QUICK_CONTEXT_LINK_TILE_CLASS } from '@/core/ui/QuickContextLinkTile';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { ClubdeskInventoryItem } from '../types/inventory';
import type {
  ClubdeskPriceList,
  ClubdeskPriceListItem,
  ClubdeskPriceListItemCategory,
  PublicationStatus,
} from '../types/priceList';
import { formatPriceListPrice } from '../utils/formatPriceListPrice';
import { groupItemsByCategory } from '../utils/priceListItemOps';
import {
  resolveEffectivePriceListItemPrice,
  syncPriceListItemsWithInventoryCatalog,
} from '../utils/priceListInventoryLink';

import { ClubdeskPublicationPropertiesFields } from './ClubdeskPublicationPropertiesFields';
import { PriceListCategoriesPanel } from './PriceListCategoriesPanel';
import { PriceListDetailHeaderMenus } from './PriceListDetailHeaderMenus';

type PriceListViewTab = 'information' | 'categories' | 'items' | 'activity';

const PRICE_LIST_VIEW_TABS: PriceListViewTab[] = ['information', 'categories', 'items', 'activity'];

function parsePriceListViewTab(value: string | null): PriceListViewTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && PRICE_LIST_VIEW_TABS.includes(value as PriceListViewTab)) {
    return value as PriceListViewTab;
  }
  // Legacy ?tab=currency → Information (currency lives there now).
  return 'information';
}

function categoryNameKey(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

function sortPriceListCategories(
  rows: ClubdeskPriceListItemCategory[],
): ClubdeskPriceListItemCategory[] {
  return [...rows].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'sv'),
  );
}

export function PriceListView({
  priceList,
  stacked: _stacked = false,
}: {
  /** Preview item; falls back to context currentPriceList when omitted. */
  priceList?: ClubdeskPriceList | null;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parsePriceListViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: PriceListViewTab) => {
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
    [setSearchParams],
  );
  const {
    currentPriceList,
    reorderPriceListItems,
    reorderPriceListCategories,
    createPriceListCategory,
    setPriceListCategoryEnabled,
    deletePriceListCategory,
    refreshPriceListCategories,
    priceListCategories,
    isSaving,
    updatePriceListPublicationStatus,
    updatePriceListFeatured,
    updatePriceListCategoriesEnabled,
    validationErrors,
    inventoryItems,
    openInventoryForView,
  } = useClubdesk();
  const [reorderingCategory, setReorderingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null);
  const [moveToCategory, setMoveToCategory] = useState('__uncategorized__');
  const [categoryDeleteError, setCategoryDeleteError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [pendingOpenInventory, setPendingOpenInventory] = useState<ClubdeskInventoryItem | null>(
    null,
  );

  const resolveInventoryForPriceListItem = useCallback(
    (item: ClubdeskPriceListItem): ClubdeskInventoryItem | null => {
      if (!item.inventoryItemId) {
        return null;
      }
      const inv = inventoryItems.find((row) => String(row.id) === String(item.inventoryItemId));
      if (inv) {
        return inv;
      }
      return {
        id: String(item.inventoryItemId),
        articleName: item.inventoryArticleName || item.title,
        brand: '',
        description: null,
        material: '',
        purchasePrice: null,
        recommendedPrice: null,
        salePrice: null,
        currency: 'SEK',
        comment: null,
        tags: [],
        slug: item.inventorySlug || String(item.inventoryItemId),
        featuredImageUrl: null,
        publicationStatus: 'draft',
        featured: false,
        variants: [],
        totalQuantity: 0,
        variantCount: 0,
        createdAt: '',
        updatedAt: '',
      };
    },
    [inventoryItems],
  );

  const viewItem = priceList ?? currentPriceList;

  useEffect(() => {
    if (!viewItem?.id) {
      return;
    }
    void refreshPriceListCategories(viewItem.id).catch(() => {
      /* keep existing catalog if refresh fails */
    });
  }, [viewItem?.id, refreshPriceListCategories]);

  const sortedCatalog = useMemo(
    () => sortPriceListCategories(priceListCategories),
    [priceListCategories],
  );

  const catalogOrder = useMemo(() => sortedCatalog.map((c) => c.name), [sortedCatalog]);

  const catalogByName = useMemo(() => {
    const map = new Map<string, ClubdeskPriceListItemCategory>();
    for (const row of sortedCatalog) {
      map.set(categoryNameKey(row.name), row);
    }
    return map;
  }, [sortedCatalog]);

  const liveItems = useMemo(
    () => syncPriceListItemsWithInventoryCatalog(viewItem?.items || [], inventoryItems),
    [viewItem?.items, inventoryItems],
  );

  const categoriesEnabled = viewItem?.categoriesEnabled !== false;

  const groups = useMemo(() => {
    if (!categoriesEnabled) {
      return liveItems.length === 0 ? [] : [{ category: null as string | null, items: liveItems }];
    }
    return groupItemsByCategory(liveItems, catalogOrder);
  }, [catalogOrder, categoriesEnabled, liveItems]);

  const categoryNames = useMemo(() => sortedCatalog.map((row) => row.name), [sortedCatalog]);

  const handleMoveCategory = useCallback(
    async (categoryName: string, direction: -1 | 1) => {
      if (!viewItem?.id) {
        return;
      }
      const key = categoryNameKey(categoryName);
      const index = sortedCatalog.findIndex((row) => categoryNameKey(row.name) === key);
      if (index < 0) {
        return;
      }
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= sortedCatalog.length) {
        return;
      }
      const next = [...sortedCatalog];
      const tmp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = tmp;
      setReorderingCategory(true);
      try {
        await reorderPriceListCategories(
          viewItem.id,
          next.map((row) => String(row.id)),
        );
      } catch (err) {
        console.error('Failed to reorder categories:', err);
      } finally {
        setReorderingCategory(false);
      }
    },
    [reorderPriceListCategories, sortedCatalog, viewItem?.id],
  );

  const handleAddCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name || !viewItem?.id || addingCategory) {
      return;
    }
    setAddingCategory(true);
    try {
      await createPriceListCategory(viewItem.id, name);
      setNewCategoryName('');
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setAddingCategory(false);
    }
  }, [addingCategory, createPriceListCategory, newCategoryName, viewItem?.id]);

  const countItemsInCategory = useCallback(
    (name: string) =>
      liveItems.filter((item) => categoryNameKey(item.category) === categoryNameKey(name)).length,
    [liveItems],
  );

  const reassignmentTargets = useMemo(() => {
    if (!categoryPendingDelete) {
      return [];
    }
    const pendingKey = categoryNameKey(categoryPendingDelete);
    return categoryNames.filter((name) => categoryNameKey(name) !== pendingKey);
  }, [categoryNames, categoryPendingDelete]);

  const completeCategoryDelete = useCallback(
    async (name: string, moveTo: string | null, withReassignment: boolean) => {
      if (!viewItem?.id) {
        return;
      }
      const serverCat = sortedCatalog.find(
        (row) => categoryNameKey(row.name) === categoryNameKey(name),
      );
      if (!serverCat) {
        return;
      }
      setDeletingCategory(true);
      setCategoryDeleteError(null);
      try {
        if (withReassignment) {
          await deletePriceListCategory(viewItem.id, serverCat.id, { moveToCategory: moveTo });
        } else {
          await deletePriceListCategory(viewItem.id, serverCat.id);
        }
        setCategoryPendingDelete(null);
        setMoveToCategory('__uncategorized__');
      } catch (err) {
        const apiErr = err as { status?: number; message?: string };
        setCategoryDeleteError(apiErr?.message || t('clubdesk.priceList.deleteCategoryFailed'));
        if (apiErr?.status === 409) {
          const others = categoryNames.filter(
            (row) => categoryNameKey(row) !== categoryNameKey(name),
          );
          setMoveToCategory(others[0] || '__uncategorized__');
          setCategoryPendingDelete(name);
        }
      } finally {
        setDeletingCategory(false);
      }
    },
    [categoryNames, deletePriceListCategory, sortedCatalog, t, viewItem?.id],
  );

  const handleRequestDeleteCategory = useCallback(
    (name: string) => {
      setCategoryDeleteError(null);
      if (countItemsInCategory(name) === 0) {
        void completeCategoryDelete(name, null, false);
        return;
      }
      const others = categoryNames.filter((row) => categoryNameKey(row) !== categoryNameKey(name));
      setMoveToCategory(others[0] || '__uncategorized__');
      setCategoryPendingDelete(name);
    },
    [categoryNames, completeCategoryDelete, countItemsInCategory],
  );

  const handleCategoriesEnabledChange = useCallback(
    (enabled: boolean) => {
      if (!viewItem) {
        return;
      }
      void updatePriceListCategoriesEnabled(viewItem, enabled);
    },
    [updatePriceListCategoriesEnabled, viewItem],
  );

  const itemCount = viewItem?.items?.length ?? 0;
  const itemsCount = itemCount > 0 ? itemCount : null;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('clubdesk.priceList.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'categories' as const,
        label: t('clubdesk.priceList.tabs.categories'),
        icon: Folders,
        count: sortedCatalog.length > 0 ? sortedCatalog.length : null,
      },
      {
        id: 'items' as const,
        label: t('clubdesk.priceList.tabs.items'),
        icon: Tags,
        count: itemsCount,
      },
      {
        id: 'activity' as const,
        label: t('clubdesk.priceList.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [itemsCount, sortedCatalog.length, t],
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

  const handlePublicationStatusChange = useCallback(
    (status: PublicationStatus) => {
      if (!viewItem) {
        return;
      }
      void updatePriceListPublicationStatus(viewItem, status);
    },
    [updatePriceListPublicationStatus, viewItem],
  );

  const handleFeaturedChange = useCallback(
    (featured: boolean) => {
      if (!viewItem) {
        return;
      }
      void updatePriceListFeatured(viewItem, featured);
    },
    [updatePriceListFeatured, viewItem],
  );

  if (!viewItem) {
    return null;
  }

  const isPublished = viewItem.publicationStatus === 'published';
  const isFeatured = viewItem.featured === true;
  const blockingValidationErrors = validationErrors.filter(
    (error) => !String(error.message || '').includes('Warning'),
  );

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.clubdesk-price-list')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Tags}
          className="h-9 w-9 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {(viewItem.title || '').trim() || '—'}
      </h3>
    </div>
  );

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.priceList.tabs.information')}
        iconPlugin="clubdesk"
        className="p-6"
        subtleTitle
      >
        {!isPublished ? (
          <div className={cn(DETAIL_NOTE_CALLOUT_CLASS, 'mb-3 text-xs text-muted-foreground')}>
            {t('clubdesk.priceList.notVisiblePublic')}
          </div>
        ) : null}

        {viewItem.featuredImageUrl ? (
          <img
            src={viewItem.featuredImageUrl}
            alt=""
            width={300}
            height={300}
            className="mb-4 h-[300px] w-[300px] max-w-full rounded-lg object-cover"
          />
        ) : null}

        {viewItem.description ? (
          <div className="text-sm text-foreground">
            <RichTextContent content={viewItem.description} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </DetailSection>
    </Card>
  );

  const propertiesCard = (
    <div className="space-y-4">
      {blockingValidationErrors.length > 0 ? (
        <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
          <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
          <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
            {blockingValidationErrors.map((error) => (
              <li key={`${error.field}-${error.message}`}>{error.message}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('clubdesk.priceList.properties')}
          icon={SlidersHorizontal}
          iconPlugin="clubdesk"
          subtleTitle
          className="p-6"
        >
          <ClubdeskPublicationPropertiesFields
            values={{
              publicationStatus: viewItem.publicationStatus,
              featured: viewItem.featured === true,
              slug: viewItem.slug,
              currency: viewItem.currency,
            }}
            showCurrency
            onPublicationStatusChange={handlePublicationStatusChange}
            onFeaturedChange={handleFeaturedChange}
            disabled={isSaving}
          />
        </DetailSection>
      </Card>
    </div>
  );

  const categoriesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.priceList.tabs.categories')}
        icon={Folders}
        iconPlugin="clubdesk"
        subtleTitle
        className="p-6"
      >
        <PriceListCategoriesPanel
          enabled={categoriesEnabled}
          onEnabledChange={handleCategoriesEnabledChange}
          entries={sortedCatalog}
          newCategoryName={newCategoryName}
          onNewCategoryNameChange={setNewCategoryName}
          onAdd={() => void handleAddCategory()}
          onDelete={handleRequestDeleteCategory}
          onMove={(index, direction) => {
            const entry = sortedCatalog[index];
            if (entry) {
              void handleMoveCategory(entry.name, direction);
            }
          }}
          onEntryEnabledChange={(entry, enabled) => {
            if (!viewItem?.id || !entry.id) {
              return;
            }
            void setPriceListCategoryEnabled(viewItem.id, entry.id, enabled).catch(() => {
              setCategoryDeleteError(t('clubdesk.priceList.categoryEnabledFailed'));
            });
          }}
          busy={
            addingCategory || deletingCategory || reorderingCategory || isSaving || !viewItem.id
          }
          error={categoryDeleteError && !categoryPendingDelete ? categoryDeleteError : null}
        />
      </DetailSection>
    </Card>
  );

  const itemsEmptyCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.priceList.tabs.items')}
        icon={Tags}
        iconPlugin="clubdesk"
        subtleTitle
        className="p-6"
      >
        <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.priceList.noItemsYet')}</p>
      </DetailSection>
    </Card>
  );

  const categoryCards =
    groups.length === 0
      ? null
      : groups.map((group) => {
          const categoryLabel = !categoriesEnabled
            ? t('clubdesk.priceList.tabs.items')
            : group.category?.trim()
              ? group.category
              : t('clubdesk.priceList.uncategorized');
          const catalogRow =
            categoriesEnabled && group.category
              ? catalogByName.get(categoryNameKey(group.category))
              : undefined;
          const catalogIndex = catalogRow
            ? sortedCatalog.findIndex((row) => String(row.id) === String(catalogRow.id))
            : -1;
          const canReorderCategory = Boolean(catalogRow) && catalogIndex >= 0;
          const groupCategoryOff = Boolean(catalogRow && catalogRow.enabled === false);

          return (
            <Card
              key={group.category ?? '__uncategorized__'}
              padding="none"
              className={DETAIL_VIEW_CARD_CLASS}
              style={
                catalogRow?.id ? listReorderRowStyle(`price-list-cat-${catalogRow.id}`) : undefined
              }
            >
              <DetailSection
                title={categoryLabel}
                icon={Tags}
                iconPlugin="clubdesk"
                subtleTitle
                className="p-6"
                titleAside={
                  groupCategoryOff ? (
                    <StatusOutlineBadge className="text-sm text-red-600 dark:text-red-500">
                      {t('clubdesk.priceList.categoryOff')}
                    </StatusOutlineBadge>
                  ) : undefined
                }
                action={
                  canReorderCategory ? (
                    <div className="flex flex-shrink-0 flex-row items-center gap-1.5">
                      <RoundIconLabelButton
                        type="button"
                        icon={ArrowUp}
                        label={t('clubdesk.priceList.moveCategoryUp', {
                          name: categoryLabel,
                        })}
                        variant="secondary"
                        size="xs"
                        expandOnHover={false}
                        disabled={isSaving || reorderingCategory || catalogIndex === 0}
                        onClick={() => void handleMoveCategory(group.category!, -1)}
                      />
                      <RoundIconLabelButton
                        type="button"
                        icon={ArrowDown}
                        label={t('clubdesk.priceList.moveCategoryDown', {
                          name: categoryLabel,
                        })}
                        variant="secondary"
                        size="xs"
                        expandOnHover={false}
                        disabled={
                          isSaving ||
                          reorderingCategory ||
                          catalogIndex === sortedCatalog.length - 1
                        }
                        onClick={() => void handleMoveCategory(group.category!, 1)}
                      />
                    </div>
                  ) : undefined
                }
              >
                {group.items.length === 0 ? (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>
                    {t('clubdesk.priceList.noItemsInCategory')}
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {group.items.map((item, index) => {
                    const siblings = categoriesEnabled
                      ? group.items
                      : liveItems.filter(
                          (row) => categoryNameKey(row.category) === categoryNameKey(item.category),
                        );
                    const indexInCategory = categoriesEnabled
                      ? index
                      : siblings.findIndex(
                          (row) =>
                            row === item ||
                            (row.id && item.id && String(row.id) === String(item.id)),
                        );
                    const itemCategory = categoriesEnabled
                      ? group.category
                      : (item.category ?? null);
                    const itemCategoryOff = categoriesEnabled
                      ? groupCategoryOff
                      : catalogByName.get(categoryNameKey(item.category))?.enabled === false;
                    return (
                      <li
                        key={item.id ?? `${group.category}-${index}`}
                        className={cn(
                          QUICK_CONTEXT_LINK_TILE_CLASS,
                          'line-item-reorder-row flex items-start gap-3',
                        )}
                        style={listReorderRowStyle(
                          String(item.id ?? `${group.category}-${index}-${item.title}`),
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              className={cn(
                                DETAIL_LIST_ITEM_TITLE_CLASS,
                                itemCategoryOff && 'text-muted-foreground',
                              )}
                            >
                              {item.title}
                            </div>
                            {itemCategoryOff ? (
                              <StatusOutlineBadge className="text-sm text-red-600 dark:text-red-500">
                                {t('clubdesk.priceList.categoryOff')}
                              </StatusOutlineBadge>
                            ) : null}
                          </div>
                          {item.inventoryItemId ? (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span>
                                {t('clubdesk.priceList.inventoryMeta', {
                                  name:
                                    [item.inventoryArticleName, item.inventoryVariantLabel]
                                      .filter((p) => (p ?? '').trim())
                                      .join(' · ') || item.title,
                                })}
                              </span>
                              {item.inventoryArchived ? (
                                <span className="font-extrabold text-muted-foreground">
                                  {t('clubdesk.inventory.archived')}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                className={cn(
                                  'font-medium text-primary underline-offset-2 hover:underline',
                                )}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const inv = resolveInventoryForPriceListItem(item);
                                  if (inv) {
                                    setPendingOpenInventory(inv);
                                  }
                                }}
                              >
                                {t('clubdesk.priceList.openInInventory')}
                              </button>
                            </div>
                          ) : null}
                          {item.description ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              <RichTextContent content={item.description} />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex-shrink-0 pt-0.5 font-mono text-sm font-semibold tabular-nums">
                          {formatPriceListPrice(
                            resolveEffectivePriceListItemPrice({
                              priceOverride: item.priceOverride,
                              inventoryCatalogPrice: item.inventoryCatalogPrice,
                              price: item.price,
                            }),
                            viewItem.currency || 'SEK',
                            i18n.language,
                          )}
                        </div>
                        <div className="flex flex-shrink-0 flex-row items-center gap-1.5">
                          <RoundIconLabelButton
                            type="button"
                            icon={ArrowUp}
                            label={t('clubdesk.priceList.moveItemUp')}
                            variant="secondary"
                            size="xs"
                            expandOnHover={false}
                            disabled={isSaving || reorderingCategory || indexInCategory <= 0}
                            onClick={() =>
                              void reorderPriceListItems(
                                viewItem,
                                itemCategory,
                                indexInCategory,
                                -1,
                              )
                            }
                          />
                          <RoundIconLabelButton
                            type="button"
                            icon={ArrowDown}
                            label={t('clubdesk.priceList.moveItemDown')}
                            variant="secondary"
                            size="xs"
                            expandOnHover={false}
                            disabled={
                              isSaving ||
                              reorderingCategory ||
                              indexInCategory < 0 ||
                              indexInCategory >= siblings.length - 1
                            }
                            onClick={() =>
                              void reorderPriceListItems(viewItem, itemCategory, indexInCategory, 1)
                            }
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </DetailSection>
            </Card>
          );
        });

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <PriceListDetailHeaderMenus priceList={viewItem} leading={titleLeading} />
          <DetailHeaderMetaRow>
            {viewItem.slug ? (
              <span className="min-w-0 font-mono text-xs text-muted-foreground">
                /{viewItem.slug}
              </span>
            ) : null}
            <StatusOutlineBadge
              icon={isPublished ? CheckCircle2 : FilePenLine}
              className={
                isPublished ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.muted
              }
            >
              {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
            </StatusOutlineBadge>
            {isFeatured ? (
              <StatusOutlineBadge icon={Star} className={QC_STATUS_BADGE_COLORS.success}>
                {t('clubdesk.featuredShort')}
              </StatusOutlineBadge>
            ) : null}
          </DetailHeaderMetaRow>
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'information' ? propertiesCard : null}
      {activeTab === 'categories' ? categoriesCard : null}
      {activeTab === 'items' ? (groups.length === 0 ? itemsEmptyCard : categoryCards) : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="clubdesk"
          entityId={viewItem.id}
          limit={30}
          title={t('clubdesk.activity')}
          showClearButton
          refreshKey={String(viewItem.updatedAt ?? viewItem.id)}
          systemId={formatDisplayNumber('clubdesk', viewItem.id)}
        />
      ) : null}
      <ConfirmDialog
        isOpen={pendingOpenInventory !== null}
        title={t('clubdesk.priceList.openInInventoryConfirmTitle')}
        message={t('clubdesk.priceList.openInInventoryConfirmMessage', {
          name: pendingOpenInventory?.articleName ?? '',
        })}
        confirmText={t('clubdesk.priceList.openInInventory')}
        cancelText={t('common.cancel')}
        variant="warning"
        onConfirm={() => {
          if (pendingOpenInventory) {
            openInventoryForView(pendingOpenInventory);
          }
          setPendingOpenInventory(null);
        }}
        onCancel={() => setPendingOpenInventory(null)}
      />
      <AlertDialog
        open={Boolean(categoryPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingCategory) {
            setCategoryPendingDelete(null);
            setMoveToCategory('__uncategorized__');
            setCategoryDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('clubdesk.priceList.deleteCategoryTitle', {
                name: categoryPendingDelete || '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('clubdesk.priceList.deleteCategoryMovePrompt', {
                count: categoryPendingDelete ? countItemsInCategory(categoryPendingDelete) : 0,
                name: categoryPendingDelete || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {categoryDeleteError ? (
            <p className="text-xs text-destructive" role="alert">
              {categoryDeleteError}
            </p>
          ) : null}
          <div className="py-2">
            <Label htmlFor="price-list-view-move-category" className="text-xs">
              {t('clubdesk.priceList.moveItemsToCategory')}
            </Label>
            <Select value={moveToCategory} onValueChange={setMoveToCategory}>
              <SelectTrigger id="price-list-view-move-category" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__uncategorized__">
                  {t('clubdesk.priceList.uncategorized')}
                </SelectItem>
                {reassignmentTargets.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogRoundCancel
              disabled={deletingCategory}
              onClick={() => {
                setCategoryPendingDelete(null);
                setMoveToCategory('__uncategorized__');
                setCategoryDeleteError(null);
              }}
            />
            <AlertDialogRoundDelete
              disabled={deletingCategory}
              label={
                deletingCategory
                  ? t('common.saving')
                  : t('clubdesk.priceList.deleteCategoryConfirm')
              }
              onClick={() => {
                if (!categoryPendingDelete) {
                  return;
                }
                const moveTo =
                  moveToCategory === '__uncategorized__' ? null : moveToCategory.trim() || null;
                void completeCategoryDelete(categoryPendingDelete, moveTo, true);
              }}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailLayout>
  );
}
