import type { Request } from '../types/requests';

export type RequestSortField =
  | 'title'
  | 'status'
  | 'priority'
  | 'type'
  | 'source'
  | 'updated_at'
  | 'created_at';
export type RequestSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: RequestSortField[] = ['title', 'status', 'priority', 'type', 'source'];

const PRIORITY_ORDER: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function isRequestStringSortField(field: RequestSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

type RequestSortable = Pick<
  Request,
  'title' | 'status' | 'priority' | 'requestType' | 'source' | 'updated_at' | 'created_at'
>;

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: RequestSortOrder,
  toTime: (value: Date | string) => number,
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

function getRequestDateValue(
  request: Pick<Request, 'updated_at' | 'created_at'>,
  field: 'updated_at' | 'created_at',
): string {
  if (field === 'created_at') {
    return request.created_at;
  }
  return request.updated_at || request.created_at;
}

export function compareRequestsByField(
  a: RequestSortable,
  b: RequestSortable,
  field: RequestSortField,
  order: RequestSortOrder,
): number {
  if (field === 'priority') {
    const aValue = PRIORITY_ORDER[a.priority] ?? 0;
    const bValue = PRIORITY_ORDER[b.priority] ?? 0;
    return order === 'asc' ? aValue - bValue : bValue - aValue;
  }
  if (field === 'updated_at' || field === 'created_at') {
    return compareNullableTimes(
      getRequestDateValue(a, field),
      getRequestDateValue(b, field),
      order,
      toSortTime,
    );
  }

  let aValue: string;
  let bValue: string;
  if (field === 'title') {
    aValue = a.title?.toLowerCase() || '';
    bValue = b.title?.toLowerCase() || '';
  } else if (field === 'status') {
    aValue = a.status;
    bValue = b.status;
  } else if (field === 'source') {
    aValue = a.source;
    bValue = b.source;
  } else {
    aValue = a.requestType;
    bValue = b.requestType;
  }
  return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
}
