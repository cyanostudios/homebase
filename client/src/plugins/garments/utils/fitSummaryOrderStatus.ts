import type { GarmentCheckboxColumn, GarmentList, InventoryItem } from '../types/garments';

import {
  buildGarmentListFitSummary,
  mergeFitSummaryProcurement,
  resolveMatrixColumns,
  type GarmentFitSummaryBreakdown,
} from './inventoryListColumns';

export type FitSummaryOrderStatus = 'finished' | 'incomplete' | 'not_ordered';

function orderedQty(row: Pick<GarmentFitSummaryBreakdown, 'qtyOrdered'>): number | null {
  if (row.qtyOrdered == null || !Number.isFinite(Number(row.qtyOrdered))) {
    return null;
  }
  return Math.trunc(Number(row.qtyOrdered));
}

/**
 * One size-summary row:
 * - finished: Ordered is checked and qty covers the needed count
 * - incomplete: Ordered is checked but qty is short (for example 1 of 2)
 * - not_ordered: needed count exists and Ordered is not checked
 */
export function classifyFitSummaryBreakdown(
  row: Pick<GarmentFitSummaryBreakdown, 'count' | 'ordered' | 'qtyOrdered'>,
): FitSummaryOrderStatus {
  if (!row.ordered) {
    return 'not_ordered';
  }
  const qty = orderedQty(row) ?? 0;
  if (qty >= row.count) {
    return 'finished';
  }
  return 'incomplete';
}

function garmentGroupsFromColumns(
  columns: GarmentCheckboxColumn[],
): Array<{ group: string; columns: GarmentCheckboxColumn[] }> {
  const groups: Array<{ group: string; columns: GarmentCheckboxColumn[] }> = [];
  const indexByGroup = new Map<string, number>();
  for (const col of columns) {
    const group = col.group?.trim() || '';
    if (!group) {
      continue;
    }
    const existing = indexByGroup.get(group);
    if (existing == null) {
      indexByGroup.set(group, groups.length);
      groups.push({ group, columns: [col] });
    } else {
      groups[existing].columns.push(col);
    }
  }
  return groups;
}

export type FitSummaryOrderLine = {
  listId: string;
  listName: string;
  itemId: string;
  articleName: string;
  audience: string;
  size: string;
  needed: number;
  /** Qty that counts toward the order. 0 when Ordered is unchecked. */
  qtyOrdered: number;
  status: FitSummaryOrderStatus;
};

export function collectFitSummaryOrderLines(
  lists: GarmentList[],
  inventoryItems: InventoryItem[],
): FitSummaryOrderLine[] {
  const lines: FitSummaryOrderLine[] = [];

  for (const list of lists) {
    const columns = resolveMatrixColumns(list, inventoryItems);
    const entries = mergeFitSummaryProcurement(
      buildGarmentListFitSummary(
        list.persons ?? [],
        garmentGroupsFromColumns(columns),
        inventoryItems,
      ),
      list.fitSummaryProcurement,
    );
    for (const entry of entries) {
      for (const row of entry.fitBreakdowns) {
        const status = classifyFitSummaryBreakdown(row);
        const qty = orderedQty(row);
        lines.push({
          listId: String(list.id),
          listName: list.name?.trim() || String(list.id),
          itemId: entry.itemId,
          articleName: entry.articleName,
          audience: row.audience,
          size: row.size,
          needed: row.count,
          qtyOrdered: status === 'not_ordered' ? 0 : (qty ?? 0),
          status,
        });
      }
    }
  }

  lines.sort((a, b) => {
    const byList = a.listName.localeCompare(b.listName, undefined, { sensitivity: 'base' });
    if (byList !== 0) {
      return byList;
    }
    const byArticle = a.articleName.localeCompare(b.articleName, undefined, {
      sensitivity: 'base',
    });
    if (byArticle !== 0) {
      return byArticle;
    }
    const byAudience = a.audience.localeCompare(b.audience, undefined, { sensitivity: 'base' });
    if (byAudience !== 0) {
      return byAudience;
    }
    return a.size.localeCompare(b.size, undefined, { numeric: true, sensitivity: 'base' });
  });

  return lines;
}
