import type { ClubdeskInventoryItem } from '@/plugins/clubdesk/types/inventory';
import { isInventoryItemLinkable } from '@/plugins/clubdesk/utils/inventoryListFilter';
import { inventoryMatchesPickerSearch } from '@/plugins/clubdesk/utils/inventoryKioskDisplay';
import type { InventoryItem } from '@/plugins/garments/types/garments';
import {
  inventoryItemMatchesSearch,
  isInventoryItemArchived,
} from '@/plugins/garments/utils/garmentListFilter';

import {
  DEFAULT_INVOICE_LINE_ITEM_UNIT,
  calculateInvoiceLineItem,
  type InvoiceLineItem,
} from '../types/invoices';

export const INVOICE_INVENTORY_PICKER_LIMIT = 40;

export function isGarmentsArticleInvoicable(item: InventoryItem): boolean {
  return !isInventoryItemArchived(item);
}

export function isClubdeskArticleInvoicable(item: ClubdeskInventoryItem): boolean {
  return isInventoryItemLinkable(item);
}

export function filterGarmentsArticlesForInvoicePicker(items: InventoryItem[]): InventoryItem[] {
  return items.filter(isGarmentsArticleInvoicable);
}

export function filterClubdeskArticlesForInvoicePicker(
  items: ClubdeskInventoryItem[],
): ClubdeskInventoryItem[] {
  return items.filter(isClubdeskArticleInvoicable);
}

export function filterGarmentsPickerSuggestions(
  items: InventoryItem[],
  search: string,
): InventoryItem[] {
  const eligible = filterGarmentsArticlesForInvoicePicker(items);
  const filtered = !search.trim()
    ? eligible
    : eligible.filter((row) => inventoryItemMatchesSearch(row, search));
  return filtered.slice(0, INVOICE_INVENTORY_PICKER_LIMIT);
}

export function filterClubdeskPickerSuggestions(
  items: ClubdeskInventoryItem[],
  search: string,
): ClubdeskInventoryItem[] {
  const eligible = filterClubdeskArticlesForInvoicePicker(items);
  const filtered = !search.trim()
    ? eligible
    : eligible.filter((row) => inventoryMatchesPickerSearch(row, search));
  return filtered.slice(0, INVOICE_INVENTORY_PICKER_LIMIT);
}

export function formatGarmentsPickerSecondaryMeta(
  item: Pick<InventoryItem, 'brand' | 'material'>,
): string {
  return [item.brand, item.material]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

export function mapInventoryArticleToLineItem(
  article: Pick<ClubdeskInventoryItem | InventoryItem, 'articleName' | 'salePrice'>,
  options: { defaultVatRate: number; sortOrder: number; id?: string },
): InvoiceLineItem {
  return calculateInvoiceLineItem({
    id: options.id ?? `${Date.now()}`,
    kind: 'item',
    description: article.articleName,
    quantity: 1,
    unit: DEFAULT_INVOICE_LINE_ITEM_UNIT,
    unitPrice: article.salePrice ?? 0,
    discount: 0,
    vatRate: options.defaultVatRate,
    sortOrder: options.sortOrder,
  });
}
