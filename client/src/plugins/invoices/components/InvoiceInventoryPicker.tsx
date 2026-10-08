import { Package2, Search } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { clubdeskApi } from '@/plugins/clubdesk/api/clubdeskApi';
import type { ClubdeskInventoryItem } from '@/plugins/clubdesk/types/inventory';
import { formatInventoryPickerSecondaryMeta } from '@/plugins/clubdesk/utils/inventoryKioskDisplay';
import { garmentsApi } from '@/plugins/garments/api/garmentsApi';
import type { InventoryItem } from '@/plugins/garments/types/garments';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { InvoiceInventorySource } from '../hooks/useInvoiceInventorySources';
import type { InvoiceLineItem } from '../types/invoices';
import {
  filterClubdeskPickerSuggestions,
  filterGarmentsPickerSuggestions,
  formatGarmentsPickerSecondaryMeta,
  mapInventoryArticleToLineItem,
} from '../utils/invoicableInventory';
import { LINE_ITEM_COMPACT_INPUT_CLASS } from '../utils/invoiceLineItemStyles';

type LoadState = 'idle' | 'loading' | 'error' | 'ready';

export function InvoiceInventoryPicker({
  sources,
  defaultVatRate,
  nextSortOrder,
  onSelect,
}: {
  sources: InvoiceInventorySource[];
  defaultVatRate: number;
  nextSortOrder: number;
  onSelect: (item: InvoiceLineItem) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [garmentsItems, setGarmentsItems] = useState<InventoryItem[]>([]);
  const [clubdeskItems, setClubdeskItems] = useState<ClubdeskInventoryItem[]>([]);

  const showGarments = sources.includes('garments');
  const showClubdesk = sources.includes('clubdesk');

  const garmentsSuggestions = useMemo(
    () => (showGarments ? filterGarmentsPickerSuggestions(garmentsItems, search) : []),
    [garmentsItems, search, showGarments],
  );

  const clubdeskSuggestions = useMemo(
    () => (showClubdesk ? filterClubdeskPickerSuggestions(clubdeskItems, search) : []),
    [clubdeskItems, search, showClubdesk],
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setSearch('');
    setLoadState('idle');
    setGarmentsItems([]);
    setClubdeskItems([]);
  }, []);

  const loadInventory = useCallback(async () => {
    setLoadState('loading');
    try {
      const fetches: Promise<void>[] = [];
      if (showGarments) {
        fetches.push(
          garmentsApi.getInventory().then((rows) => {
            setGarmentsItems(rows);
          }),
        );
      }
      if (showClubdesk) {
        fetches.push(
          clubdeskApi.getInventoryItems().then((rows) => {
            setClubdeskItems(rows);
          }),
        );
      }
      await Promise.all(fetches);
      setLoadState('ready');
    } catch (error) {
      console.error('Failed to load inventory for invoice picker', error);
      setLoadState('error');
    }
  }, [showClubdesk, showGarments]);

  const openPicker = () => {
    setPickerOpen(true);
    void loadInventory();
  };

  const pickArticle = (article: InventoryItem | ClubdeskInventoryItem) => {
    const line = mapInventoryArticleToLineItem(article, {
      defaultVatRate,
      sortOrder: nextSortOrder,
      id: `${Date.now()}`,
    });
    onSelect(line);
    closePicker();
  };

  const hasAnyCatalog =
    loadState === 'ready' && (garmentsItems.length > 0 || clubdeskItems.length > 0);
  const noMatches =
    loadState === 'ready' &&
    hasAnyCatalog &&
    garmentsSuggestions.length === 0 &&
    clubdeskSuggestions.length === 0;

  return (
    <Popover
      open={pickerOpen}
      onOpenChange={(open) => {
        if (!open) {
          closePicker();
        } else {
          openPicker();
        }
      }}
    >
      <PopoverAnchor asChild>
        <div>
          <RoundIconLabelButton
            type="button"
            icon={Package2}
            label={t('invoices.addFromInventory')}
            variant="secondary"
            size="xs"
            alwaysExpanded
            onClick={openPicker}
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
          <div className="relative px-1 pt-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('invoices.inventoryPicker.searchPlaceholder')}
              className={cn(LINE_ITEM_COMPACT_INPUT_CLASS, 'pl-8')}
              autoFocus
              disabled={loadState === 'loading'}
            />
          </div>

          {loadState === 'loading' ? (
            <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'px-2 py-3 text-left text-xs')}>
              {t('invoices.inventoryPicker.loading')}
            </p>
          ) : null}

          {loadState === 'error' ? (
            <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'px-2 py-3 text-left text-xs')}>
              {t('invoices.inventoryPicker.loadError')}
            </p>
          ) : null}

          {loadState === 'ready' && !hasAnyCatalog ? (
            <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'px-2 py-3 text-left text-xs')}>
              {t('invoices.inventoryPicker.emptyCatalog')}
            </p>
          ) : null}

          {noMatches ? (
            <p className={cn(DETAIL_EMPTY_STATE_CLASS, 'px-2 py-3 text-left text-xs')}>
              {t('invoices.inventoryPicker.noMatches')}
            </p>
          ) : null}

          {loadState === 'ready' && garmentsSuggestions.length > 0 ? (
            <div className="max-h-52 overflow-y-auto">
              <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t('invoices.inventoryPicker.sectionGarments')}
              </p>
              {garmentsSuggestions.map((row) => {
                const pickerMeta = formatGarmentsPickerSecondaryMeta(row);
                return (
                  <button
                    key={`g-${row.id}`}
                    type="button"
                    className={cn(
                      'flex w-full items-start rounded-lg px-2.5 py-2 text-left',
                      DETAIL_LIST_ITEM_HOVER_CLASS,
                    )}
                    onClick={() => pickArticle(row)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold">
                        {row.articleName}
                      </span>
                      {pickerMeta ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {pickerMeta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {loadState === 'ready' && clubdeskSuggestions.length > 0 ? (
            <div className="max-h-52 overflow-y-auto">
              <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t('invoices.inventoryPicker.sectionClubdesk')}
              </p>
              {clubdeskSuggestions.map((row) => {
                const pickerMeta = formatInventoryPickerSecondaryMeta(row);
                return (
                  <button
                    key={`c-${row.id}`}
                    type="button"
                    className={cn(
                      'flex w-full items-start rounded-lg px-2.5 py-2 text-left',
                      DETAIL_LIST_ITEM_HOVER_CLASS,
                    )}
                    onClick={() => pickArticle(row)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold">
                        {row.articleName}
                      </span>
                      {pickerMeta ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {pickerMeta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
