/** Shared helpers for per-plugin list table column visibility + order prefs. */

export type TableColumnsPref<TColumnId extends string> = {
  order: TColumnId[];
  hidden: TColumnId[];
};

export type TableColumnsHelpers<TColumnId extends string> = {
  columnIds: readonly TColumnId[];
  requiredColumnId: TColumnId;
  DEFAULT: TableColumnsPref<TColumnId>;
  isColumnId: (value: unknown) => value is TColumnId;
  normalize: (raw: unknown) => TableColumnsPref<TColumnId>;
  resolveVisible: (settings: { tableColumns?: unknown } | null | undefined) => TColumnId[];
  equal: (a: TableColumnsPref<TColumnId>, b: TableColumnsPref<TColumnId>) => boolean;
  reorder: (order: TColumnId[], sourceId: TColumnId, targetId: TColumnId) => TColumnId[];
  setHidden: (
    pref: TableColumnsPref<TColumnId>,
    columnId: TColumnId,
    hidden: boolean,
  ) => TableColumnsPref<TColumnId>;
};

export function createTableColumnsHelpers<TColumnId extends string>(options: {
  columnIds: readonly TColumnId[];
  requiredColumnId: TColumnId;
  defaultHidden: readonly TColumnId[];
}): TableColumnsHelpers<TColumnId> {
  const { columnIds, requiredColumnId, defaultHidden } = options;
  const known = new Set<string>(columnIds);
  const DEFAULT: TableColumnsPref<TColumnId> = {
    order: [...columnIds],
    hidden: [...defaultHidden],
  };

  function isColumnId(value: unknown): value is TColumnId {
    return typeof value === 'string' && known.has(value);
  }

  function filterKnownIds(raw: unknown): TColumnId[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const seen = new Set<TColumnId>();
    const result: TColumnId[] = [];
    for (const item of raw) {
      if (!isColumnId(item) || seen.has(item)) {
        continue;
      }
      seen.add(item);
      result.push(item);
    }
    return result;
  }

  function normalize(raw: unknown): TableColumnsPref<TColumnId> {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return { order: [...DEFAULT.order], hidden: [...DEFAULT.hidden] };
    }

    const record = raw as { order?: unknown; hidden?: unknown };
    let order = filterKnownIds(record.order);

    if (!order.includes(requiredColumnId)) {
      order = [requiredColumnId, ...order];
    }

    for (const id of columnIds) {
      if (!order.includes(id)) {
        order.push(id);
      }
    }

    const hidden: TColumnId[] = filterKnownIds(record.hidden).filter(
      (id) => id !== requiredColumnId,
    );

    const visible = order.filter((id) => !hidden.includes(id));
    if (visible.length === 0) {
      return { order: [...DEFAULT.order], hidden: [...DEFAULT.hidden] };
    }

    return { order, hidden };
  }

  function resolveVisible(settings: { tableColumns?: unknown } | null | undefined): TColumnId[] {
    const normalized = normalize(settings?.tableColumns);
    return normalized.order.filter((id) => !normalized.hidden.includes(id));
  }

  function equal(a: TableColumnsPref<TColumnId>, b: TableColumnsPref<TColumnId>): boolean {
    if (a.order.length !== b.order.length || a.hidden.length !== b.hidden.length) {
      return false;
    }
    if (a.order.some((id, i) => id !== b.order[i])) {
      return false;
    }
    const hiddenA = [...a.hidden].sort();
    const hiddenB = [...b.hidden].sort();
    return hiddenA.every((id, i) => id === hiddenB[i]);
  }

  function reorder(order: TColumnId[], sourceId: TColumnId, targetId: TColumnId): TColumnId[] {
    if (sourceId === targetId) {
      return order;
    }
    const next = [...order];
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) {
      return order;
    }
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    return next;
  }

  function setHidden(
    pref: TableColumnsPref<TColumnId>,
    columnId: TColumnId,
    hidden: boolean,
  ): TableColumnsPref<TColumnId> {
    if (columnId === requiredColumnId) {
      return pref;
    }
    const without = pref.hidden.filter((id) => id !== columnId);
    return {
      order: pref.order,
      hidden: hidden ? [...without, columnId] : without,
    };
  }

  return {
    columnIds,
    requiredColumnId,
    DEFAULT,
    isColumnId,
    normalize,
    resolveVisible,
    equal,
    reorder,
    setHidden,
  };
}
