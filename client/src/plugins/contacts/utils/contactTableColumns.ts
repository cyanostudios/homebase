/** Canonical table column ids for Contacts list table (settings + SortableListTable). */
export const CONTACT_TABLE_COLUMN_IDS = [
  'name',
  'type',
  'tags',
  'assignable',
  'time',
  'email',
  'phone',
  'createdAt',
  'updatedAt',
] as const;

export type ContactTableColumnId = (typeof CONTACT_TABLE_COLUMN_IDS)[number];

export type ContactTableColumnsPref = {
  order: ContactTableColumnId[];
  hidden: ContactTableColumnId[];
};

/** Default ON: name, type, tags, assignable, time. Default OFF: email, phone, createdAt, updatedAt. */
export const DEFAULT_CONTACT_TABLE_COLUMNS: ContactTableColumnsPref = {
  order: [...CONTACT_TABLE_COLUMN_IDS],
  hidden: ['email', 'phone', 'createdAt', 'updatedAt'],
};

const KNOWN_IDS = new Set<string>(CONTACT_TABLE_COLUMN_IDS);

export function isContactTableColumnId(value: unknown): value is ContactTableColumnId {
  return typeof value === 'string' && KNOWN_IDS.has(value);
}

function filterKnownIds(raw: unknown): ContactTableColumnId[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<ContactTableColumnId>();
  const result: ContactTableColumnId[] = [];
  for (const item of raw) {
    if (!isContactTableColumnId(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

/**
 * Normalize stored `tableColumns` into a full order + hidden set.
 * - Unknown ids stripped; missing known ids appended in default order.
 * - `name` is always in order and never in hidden.
 * - Corrupt / missing input → defaults.
 */
export function normalizeContactTableColumns(raw: unknown): ContactTableColumnsPref {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      order: [...DEFAULT_CONTACT_TABLE_COLUMNS.order],
      hidden: [...DEFAULT_CONTACT_TABLE_COLUMNS.hidden],
    };
  }

  const record = raw as { order?: unknown; hidden?: unknown };
  let order = filterKnownIds(record.order);

  if (!order.includes('name')) {
    order = ['name', ...order];
  }

  for (const id of CONTACT_TABLE_COLUMN_IDS) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  const hidden: ContactTableColumnId[] = filterKnownIds(record.hidden).filter(
    (id) => id !== 'name',
  );

  const visible = order.filter((id) => !hidden.includes(id));
  if (visible.length === 0) {
    return {
      order: [...DEFAULT_CONTACT_TABLE_COLUMNS.order],
      hidden: [...DEFAULT_CONTACT_TABLE_COLUMNS.hidden],
    };
  }

  return { order, hidden };
}

/** Ordered list of visible column ids for the table. */
export function resolveVisibleContactTableColumns(
  settings: { tableColumns?: unknown } | null | undefined,
): ContactTableColumnId[] {
  const normalized = normalizeContactTableColumns(settings?.tableColumns);
  return normalized.order.filter((id) => !normalized.hidden.includes(id));
}

export function contactTableColumnsEqual(
  a: ContactTableColumnsPref,
  b: ContactTableColumnsPref,
): boolean {
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

export function reorderContactTableColumns(
  order: ContactTableColumnId[],
  sourceId: ContactTableColumnId,
  targetId: ContactTableColumnId,
): ContactTableColumnId[] {
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

export function setContactTableColumnHidden(
  pref: ContactTableColumnsPref,
  columnId: ContactTableColumnId,
  hidden: boolean,
): ContactTableColumnsPref {
  if (columnId === 'name') {
    return pref;
  }
  const without = pref.hidden.filter((id) => id !== columnId);
  return {
    order: pref.order,
    hidden: hidden ? [...without, columnId] : without,
  };
}
