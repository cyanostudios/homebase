import type { Cup } from '../types/cups';

export type CupSortField =
  | 'name'
  | 'start_date'
  | 'location'
  | 'updatedAt'
  | 'ingest'
  | 'featured'
  | 'ratings_count'
  | 'visible';

export type CupSortOrder = 'asc' | 'desc';

type CupSortable = Pick<
  Cup,
  | 'name'
  | 'location'
  | 'start_date'
  | 'updated_at'
  | 'ingest_source_id'
  | 'featured'
  | 'ratings_count'
  | 'visible'
>;

const DATE_SORT_FIELDS: CupSortField[] = ['start_date', 'updatedAt'];

/** Default asc for name/location/start_date/ingest/visible; desc for updatedAt/ratings_count/featured. */
export function isCupAscDefaultField(field: CupSortField): boolean {
  return (
    field === 'name' ||
    field === 'location' ||
    field === 'start_date' ||
    field === 'ingest' ||
    field === 'visible'
  );
}

export function isCupDateSortField(field: CupSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: string | null | undefined,
  bValue: string | null | undefined,
  order: CupSortOrder,
  toTime: (value: string) => number,
): number {
  if (!aValue && !bValue) {
    return 0;
  }
  if (!aValue) {
    return order === 'asc' ? 1 : -1;
  }
  if (!bValue) {
    return order === 'asc' ? -1 : 1;
  }
  const aTime = toTime(aValue);
  const bTime = toTime(bValue);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

function getCupDateValue(cup: CupSortable, field: 'start_date' | 'updatedAt'): string | null {
  if (field === 'start_date') {
    return cup.start_date || null;
  }
  return cup.updated_at || null;
}

/**
 * Compare two cups by a single field.
 * Pass an optional `ingestTitle` resolver for the 'ingest' field.
 */
export function compareCupsByField(
  a: CupSortable,
  b: CupSortable,
  field: CupSortField,
  order: CupSortOrder,
  ingestTitle?: (id: string | null | undefined) => string,
): number {
  if (field === 'start_date' || field === 'updatedAt') {
    return compareNullableTimes(
      getCupDateValue(a, field),
      getCupDateValue(b, field),
      order,
      toSortTime,
    );
  }

  if (field === 'featured') {
    const av = a.featured === true ? 1 : 0;
    const bv = b.featured === true ? 1 : 0;
    return order === 'asc' ? av - bv : bv - av;
  }

  if (field === 'visible') {
    const av = a.visible === true ? 1 : 0;
    const bv = b.visible === true ? 1 : 0;
    return order === 'asc' ? av - bv : bv - av;
  }

  if (field === 'ratings_count') {
    const av = a.ratings_count ?? 0;
    const bv = b.ratings_count ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }

  let aVal: string;
  let bVal: string;

  if (field === 'ingest') {
    const resolver = ingestTitle ?? (() => '');
    const ta = resolver(a.ingest_source_id);
    const tb = resolver(b.ingest_source_id);
    const emptyA = !a.ingest_source_id || ta === '';
    const emptyB = !b.ingest_source_id || tb === '';
    if (emptyA !== emptyB) {
      return order === 'asc' ? (emptyA ? 1 : -1) : emptyA ? -1 : 1;
    }
    aVal = ta.toLowerCase();
    bVal = tb.toLowerCase();
  } else if (field === 'location') {
    aVal = (a.location ?? '').toLowerCase();
    bVal = (b.location ?? '').toLowerCase();
  } else {
    // name
    aVal = (a.name || '').toLowerCase();
    bVal = (b.name || '').toLowerCase();
  }

  const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
  return order === 'asc' ? cmp : -cmp;
}
