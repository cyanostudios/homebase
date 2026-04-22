import type { ProductCatalogFilterRule } from '../api/productsApi';

export type ProductCatalogFilterRow = ProductCatalogFilterRule & { id: string };

export function newFilterRowId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `f-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function makeFilterRow(
  rule: ProductCatalogFilterRule & { id?: string },
): ProductCatalogFilterRow {
  return { id: rule.id ?? newFilterRowId(), type: rule.type, op: rule.op, value: rule.value };
}

export function rulesForApi(rows: ProductCatalogFilterRow[]): ProductCatalogFilterRule[] {
  return rows.map(({ type, op, value }) => ({ type, op, value }));
}

export function rowsFromSavedRules(rules: ProductCatalogFilterRule[] | undefined | null) {
  return (rules || []).map((r) => makeFilterRow(r));
}
