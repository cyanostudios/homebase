import type { InventoryItemPayload, InventoryVariantPayload } from '../types/garments';

function parseOptionalPrice(raw: string | undefined): number | null {
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  const num = parseFloat(String(raw).replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

function parseOptionalQuantity(raw: string | undefined): number {
  if (raw == null || String(raw).trim() === '') {
    return 0;
  }
  const num = Number(String(raw).replace(',', '.'));
  if (Number.isNaN(num) || num < 0) {
    return 0;
  }
  return Math.floor(num);
}

function resolveArticleName(row: Record<string, string>): string {
  return String(
    row.articleName ?? row.article ?? row.artikel ?? row.product ?? row.item ?? row.name ?? '',
  ).trim();
}

function rowHasArticleField(row: Record<string, string>): boolean {
  return (
    'articleName' in row ||
    'article' in row ||
    'artikel' in row ||
    'product' in row ||
    'item' in row ||
    'name' in row
  );
}

function resolveBrand(row: Record<string, string>): string {
  return String(row.brand ?? '').trim();
}

function inventoryGroupKey(articleName: string, brand: string): string {
  return `${articleName.trim().toLowerCase()}\0${brand.trim().toLowerCase()}`;
}

function rowToVariant(row: Record<string, string>, sortOrder: number): InventoryVariantPayload {
  return {
    sku: String(row.sku ?? row.articleNo ?? '').trim(),
    audience: String(row.audience ?? '').trim(),
    color: String(row.color ?? '').trim(),
    size: String(row.size ?? '').trim(),
    quantity: parseOptionalQuantity(row.quantity),
    sortOrder,
  };
}

function buildItemPayloadFromFirstRow(
  firstRow: Record<string, string>,
  variantRows: Record<string, string>[],
): InventoryItemPayload {
  const descriptionRaw = String(firstRow.description ?? '').trim();
  const commentRaw = String(firstRow.comment ?? '').trim();
  return {
    articleName: resolveArticleName(firstRow),
    brand: resolveBrand(firstRow),
    description: descriptionRaw ? descriptionRaw : null,
    material: String(firstRow.material ?? '').trim(),
    purchasePrice: parseOptionalPrice(firstRow.purchasePrice),
    recommendedPrice: parseOptionalPrice(firstRow.recommendedPrice),
    salePrice: parseOptionalPrice(firstRow.salePrice),
    currency: String(firstRow.currency ?? 'SEK').trim() || 'SEK',
    comment: commentRaw ? commentRaw : null,
    variants: variantRows.map((row, index) => rowToVariant(row, index)),
  };
}

export type GroupInventoryImportRowsResult = {
  payloads: InventoryItemPayload[];
  /** Rows skipped because article name was missing. */
  skippedRowCount: number;
  /** Mapped Article column exists but cell was blank. */
  skippedEmptyArticle: number;
  /** Article was not present on the row (column missing / row too short). */
  skippedArticleUnmapped: number;
};

/**
 * Flat import rows (one row = one variant) → grouped inventory create payloads.
 * Rows with the same article + brand (case-insensitive) merge into one item.
 */
export function groupInventoryImportRows(
  rows: Record<string, string>[],
): GroupInventoryImportRowsResult {
  const groups = new Map<string, Record<string, string>[]>();
  let skippedEmptyArticle = 0;
  let skippedArticleUnmapped = 0;

  for (const row of rows) {
    const articleName = resolveArticleName(row);
    if (!articleName) {
      if (rowHasArticleField(row)) {
        skippedEmptyArticle += 1;
      } else {
        skippedArticleUnmapped += 1;
      }
      continue;
    }
    const brand = resolveBrand(row);
    const key = inventoryGroupKey(articleName, brand);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const payloads = [...groups.values()].map((groupRows) =>
    buildItemPayloadFromFirstRow(groupRows[0], groupRows),
  );

  return {
    payloads,
    skippedRowCount: skippedEmptyArticle + skippedArticleUnmapped,
    skippedEmptyArticle,
    skippedArticleUnmapped,
  };
}
