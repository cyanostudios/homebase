import { ArrowDown, ArrowUp, Info, Tags } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import { RichTextContent } from '@/core/ui/RichTextContent';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_INFO_ROW_CLASS,
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
import type { ClubdeskPriceList, ClubdeskPriceListItemCategory } from '../types/priceList';
import { formatPriceListPrice } from '../utils/formatPriceListPrice';
import { groupItemsByCategory } from '../utils/priceListItemOps';

import { PriceListDetailHeaderMenus } from './PriceListDetailHeaderMenus';

type PriceListViewTab = 'information' | 'items';

const PRICE_LIST_VIEW_TABS: PriceListViewTab[] = ['information', 'items'];

function parsePriceListViewTab(value: string | null): PriceListViewTab {
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
    refreshPriceListCategories,
    priceListCategories,
    isSaving,
  } = useClubdesk();
  const [reorderingCategory, setReorderingCategory] = useState(false);

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

  const groups = useMemo(
    () => groupItemsByCategory(viewItem?.items || [], catalogOrder),
    [viewItem?.items, catalogOrder],
  );

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
        id: 'items' as const,
        label: t('clubdesk.priceList.tabs.items'),
        icon: Tags,
        count: itemsCount,
      },
    ],
    [itemsCount, t],
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

  if (!viewItem) {
    return null;
  }

  const isPublished = viewItem.publicationStatus === 'published';

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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge
            variant={isPublished ? 'default' : 'secondary'}
            className={cn(
              'text-[10px] font-extrabold',
              isPublished &&
                'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200',
            )}
          >
            {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
          </Badge>
          {viewItem.slug ? (
            <span className="font-mono text-xs text-muted-foreground">/{viewItem.slug}</span>
          ) : null}
        </div>

        {!isPublished ? (
          <div className={cn(DETAIL_NOTE_CALLOUT_CLASS, 'mb-3 text-xs text-muted-foreground')}>
            {t('clubdesk.priceList.notVisiblePublic')}
          </div>
        ) : null}

        <div className="mb-3">
          <div className={DETAIL_INFO_ROW_CLASS}>
            <span className="text-slate-500 dark:text-slate-400">
              {t('clubdesk.priceList.tabs.currency')}
            </span>
            <span className="font-mono font-extrabold text-foreground">
              {viewItem.currency || 'SEK'}
            </span>
          </div>
        </div>

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
          const categoryLabel = group.category?.trim()
            ? group.category
            : t('clubdesk.priceList.uncategorized');
          const catalogRow = group.category
            ? catalogByName.get(categoryNameKey(group.category))
            : undefined;
          const catalogIndex = catalogRow
            ? sortedCatalog.findIndex((row) => String(row.id) === String(catalogRow.id))
            : -1;
          const canReorderCategory = Boolean(catalogRow) && catalogIndex >= 0;

          return (
            <Card
              key={group.category ?? '__uncategorized__'}
              padding="none"
              className={DETAIL_VIEW_CARD_CLASS}
            >
              <DetailSection
                title={categoryLabel}
                icon={Tags}
                iconPlugin="clubdesk"
                subtleTitle
                className="p-6"
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
                <ul className="space-y-2">
                  {group.items.map((item, index) => (
                    <li
                      key={item.id ?? `${group.category}-${index}`}
                      className={cn(QUICK_CONTEXT_LINK_TILE_CLASS, 'flex items-start gap-3')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={DETAIL_LIST_ITEM_TITLE_CLASS}>{item.title}</div>
                        {item.description ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <RichTextContent content={item.description} />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex-shrink-0 pt-0.5 font-mono text-sm font-semibold tabular-nums">
                        {formatPriceListPrice(
                          item.price,
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
                          disabled={isSaving || reorderingCategory || index === 0}
                          onClick={() =>
                            void reorderPriceListItems(viewItem, group.category, index, -1)
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
                            isSaving || reorderingCategory || index === group.items.length - 1
                          }
                          onClick={() =>
                            void reorderPriceListItems(viewItem, group.category, index, 1)
                          }
                        />
                      </div>
                    </li>
                  ))}
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
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'items' ? (groups.length === 0 ? itemsEmptyCard : categoryCards) : null}
    </DetailLayout>
  );
}
