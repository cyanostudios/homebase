import { Circle, CircleCheck, CircleDashed, LayoutGrid } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { garmentsApi } from '../api/garmentsApi';
import { useGarments } from '../hooks/useGarments';
import type { GarmentPerson, InventoryItem } from '../types/garments';
import {
  collectFitSummaryOrderLines,
  type FitSummaryOrderLine,
  type FitSummaryOrderStatus,
} from '../utils/fitSummaryOrderStatus';

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

const ORDER_SECTIONS: Array<{
  status: FitSummaryOrderStatus;
  titleKey: string;
  icon: typeof CircleCheck;
}> = [
  {
    status: 'finished',
    titleKey: 'garments.statistics.finishedOrders',
    icon: CircleCheck,
  },
  {
    status: 'incomplete',
    titleKey: 'garments.statistics.incompleteOrders',
    icon: CircleDashed,
  },
  {
    status: 'not_ordered',
    titleKey: 'garments.statistics.notOrdered',
    icon: Circle,
  },
];

function OrderLineList({
  lines,
  inventoryItems,
  emptyLabel,
}: {
  lines: FitSummaryOrderLine[];
  inventoryItems: InventoryItem[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const next: Array<{ listId: string; listName: string; lines: FitSummaryOrderLine[] }> = [];
    const indexByList = new Map<string, number>();
    for (const line of lines) {
      const existing = indexByList.get(line.listId);
      if (existing == null) {
        indexByList.set(line.listId, next.length);
        next.push({ listId: line.listId, listName: line.listName, lines: [line] });
      } else {
        next[existing].lines.push(line);
      }
    }
    return next;
  }, [lines]);
  const archivedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of inventoryItems) {
      if (item.archivedAt) {
        ids.add(String(item.id));
      }
    }
    return ids;
  }, [inventoryItems]);

  if (groups.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="mt-3 space-y-4">
      {groups.map((group) => (
        <section key={group.listId}>
          <h4 className="text-sm font-extrabold text-foreground">{group.listName}</h4>
          <ul className="mt-1 divide-y divide-border/50">
            {group.lines.map((line) => {
              const fit = [line.audience.trim(), line.size.trim()].filter(Boolean).join(' ');
              return (
                <li
                  key={`${line.itemId}:${line.audience}:${line.size}`}
                  className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 text-foreground">
                    {line.articleName}
                    {archivedItemIds.has(line.itemId) ? (
                      <span
                        className={cn(
                          'ml-1.5 text-[10px] font-extrabold',
                          QC_STATUS_BADGE_COLORS.muted,
                        )}
                      >
                        {t('garments.archived')}
                      </span>
                    ) : null}
                    {fit ? <span className="text-muted-foreground"> · {fit}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t('garments.statistics.orderProgress', {
                      qty: line.qtyOrdered,
                      needed: line.needed,
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function GarmentsStatisticsView() {
  const { t } = useTranslation();
  const { garmentLists, inventoryItems } = useGarments();
  const [personsByListId, setPersonsByListId] = useState<Record<string, GarmentPerson[]>>({});
  const [loadError, setLoadError] = useState(false);

  const missingKey = garmentLists
    .filter((list) => !list.persons)
    .map((list) => `${list.id}:${list.personCount ?? 0}`)
    .join('|');

  useEffect(() => {
    const missing = garmentLists.filter((list) => !list.persons);
    if (missing.length === 0) {
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setLoadError(false);
    Promise.all(
      missing.map(async (list) => {
        const persons = await garmentsApi.getPersons(list.id);
        return { id: String(list.id), persons };
      }),
    )
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setPersonsByListId((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            next[row.id] = row.persons;
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [garmentLists, missingKey]);

  const personsReady = garmentLists.every(
    (list) => Boolean(list.persons) || personsByListId[String(list.id)] != null,
  );

  const listsForSummary = useMemo(
    () =>
      garmentLists.map((list) => ({
        ...list,
        persons: list.persons ?? personsByListId[String(list.id)] ?? [],
      })),
    [garmentLists, personsByListId],
  );

  const orderLines = useMemo(
    () => (personsReady ? collectFitSummaryOrderLines(listsForSummary, inventoryItems) : []),
    [inventoryItems, listsForSummary, personsReady],
  );

  const stats = useMemo(
    () => ({
      listCount: garmentLists.length,
      inventoryCount: inventoryItems.length,
      assignedInventory: inventoryItems.filter((item) => (item.assignedListIds?.length ?? 0) > 0)
        .length,
      totalPersons: garmentLists.reduce(
        (sum, list) => sum + (list.personCount ?? list.persons?.length ?? 0),
        0,
      ),
    }),
    [garmentLists, inventoryItems],
  );

  const linesByStatus = (status: FitSummaryOrderStatus) =>
    orderLines.filter((line) => line.status === status);

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('garments.statistics.title', { defaultValue: 'Garment statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('garments.statistics.description', {
          defaultValue: 'Overview of lists, inventory, and assignments.',
        })}
      </p>

      <DetailSection
        title={t('garments.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          <StatKpiTile
            label={t('garments.statistics.listCount', { defaultValue: 'Lists' })}
            value={stats.listCount}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('garments.statistics.inventoryCount', { defaultValue: 'Inventory items' })}
            value={stats.inventoryCount}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('garments.statistics.assignedInventory', {
              defaultValue: 'Assigned to lists',
            })}
            value={stats.assignedInventory}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('garments.statistics.totalPersons', { defaultValue: 'Total persons' })}
            value={stats.totalPersons}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <p className="text-sm text-muted-foreground">
        {t('garments.statistics.ordersFromSummaries')}
      </p>

      {loadError ? (
        <p role="status" className="text-sm text-destructive">
          {t('garments.statistics.ordersLoadFailed')}
        </p>
      ) : null}

      {!personsReady && !loadError ? (
        <p className="text-sm text-muted-foreground">{t('garments.statistics.ordersLoading')}</p>
      ) : null}

      {personsReady
        ? ORDER_SECTIONS.map((section) => {
            const lines = linesByStatus(section.status);
            return (
              <DetailSection
                key={section.status}
                title={`${t(section.titleKey)} (${lines.length})`}
                icon={section.icon}
                subtleTitle
                collapsible
              >
                <OrderLineList
                  lines={lines}
                  inventoryItems={inventoryItems}
                  emptyLabel={t('garments.statistics.ordersEmpty')}
                />
              </DetailSection>
            );
          })
        : null}
    </div>
  );
}
