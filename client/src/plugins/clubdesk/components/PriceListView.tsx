import { ArrowDown, ArrowUp, Banknote, Info, Tags } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import { RichTextContent } from '@/core/ui/RichTextContent';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { ClubdeskPriceList } from '../types/priceList';
import { formatPriceListPrice } from '../utils/formatPriceListPrice';
import { groupItemsByCategory } from '../utils/priceListItemOps';

import { PriceListDetailHeaderMenus } from './PriceListDetailHeaderMenus';

type PriceListViewTab = 'information' | 'items' | 'currency';

const PRICE_LIST_VIEW_TABS: PriceListViewTab[] = ['information', 'items', 'currency'];

function parsePriceListViewTab(value: string | null): PriceListViewTab {
  if (value && PRICE_LIST_VIEW_TABS.includes(value as PriceListViewTab)) {
    return value as PriceListViewTab;
  }
  return 'information';
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
  const { currentPriceList, reorderPriceListItems, priceListCategories, isSaving } = useClubdesk();

  const viewItem = priceList ?? currentPriceList;

  const catalogOrder = useMemo(() => priceListCategories.map((c) => c.name), [priceListCategories]);

  const groups = useMemo(
    () => groupItemsByCategory(viewItem?.items || [], catalogOrder),
    [viewItem?.items, catalogOrder],
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
      {
        id: 'currency' as const,
        label: t('clubdesk.priceList.tabs.currency'),
        icon: Banknote,
        count: null as number | null,
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

  const itemsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.priceList.tabs.items')}
        icon={Tags}
        iconPlugin="clubdesk"
        subtleTitle
        className="p-6"
      >
        {groups.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.priceList.noItemsYet')}</p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.category ?? '__uncategorized__'}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.category?.trim() ? group.category : t('clubdesk.priceList.uncategorized')}
                </h4>
                <ul className="space-y-2">
                  {group.items.map((item, index) => (
                    <li
                      key={item.id ?? `${group.category}-${index}`}
                      className="rounded-lg border border-border/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium">
                          {item.title}
                        </div>
                        <div className="flex-shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {formatPriceListPrice(
                            item.price,
                            viewItem.currency || 'SEK',
                            i18n.language,
                          )}
                        </div>
                        <div className="flex flex-shrink-0 flex-row items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={ArrowUp}
                            className="h-8 w-8 px-0"
                            disabled={isSaving || index === 0}
                            aria-label={t('clubdesk.priceList.moveItemUp')}
                            onClick={() =>
                              void reorderPriceListItems(viewItem, group.category, index, -1)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={ArrowDown}
                            className="h-8 w-8 px-0"
                            disabled={isSaving || index === group.items.length - 1}
                            aria-label={t('clubdesk.priceList.moveItemDown')}
                            onClick={() =>
                              void reorderPriceListItems(viewItem, group.category, index, 1)
                            }
                          />
                        </div>
                      </div>
                      {item.description ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <RichTextContent content={item.description} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DetailSection>
    </Card>
  );

  const currencyCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.priceList.tabs.currency')}
        icon={Banknote}
        iconPlugin="clubdesk"
        subtleTitle
        className="p-6"
      >
        <div className={DETAIL_INFO_ROW_CLASS}>
          <span className="font-mono font-extrabold text-foreground">
            {viewItem.currency || 'SEK'}
          </span>
        </div>
      </DetailSection>
    </Card>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <PriceListDetailHeaderMenus priceList={viewItem} leading={titleLeading} />
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'items' ? itemsCard : null}
      {activeTab === 'currency' ? currencyCard : null}
    </DetailLayout>
  );
}
