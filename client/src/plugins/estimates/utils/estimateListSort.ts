import type { Estimate } from '../types/estimate';

export type EstimateSortField =
  | 'estimateNumber'
  | 'contactName'
  | 'status'
  | 'total'
  | 'createdAt'
  | 'updatedAt'
  | 'validTo';

export type EstimateSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: EstimateSortField[] = ['estimateNumber', 'contactName', 'status'];
const NUMBER_SORT_FIELDS: EstimateSortField[] = ['total'];
const DATE_SORT_FIELDS: EstimateSortField[] = ['createdAt', 'updatedAt', 'validTo'];

export function isEstimateStringSortField(field: EstimateSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isEstimateNumberSortField(field: EstimateSortField): boolean {
  return NUMBER_SORT_FIELDS.includes(field);
}

export function isEstimateDateSortField(field: EstimateSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

type EstimateSortPick = Pick<
  Estimate,
  'estimateNumber' | 'contactName' | 'status' | 'total' | 'createdAt' | 'updatedAt' | 'validTo'
>;

export function getEstimateSortValue(
  estimate: EstimateSortPick,
  field: EstimateSortField,
): string | number | Date | null {
  if (field === 'estimateNumber') {
    return estimate.estimateNumber.toLowerCase();
  }
  if (field === 'contactName') {
    return estimate.contactName.toLowerCase();
  }
  if (field === 'status') {
    return estimate.status;
  }
  if (field === 'total') {
    return typeof estimate.total === 'number' ? estimate.total : Number(estimate.total ?? 0);
  }
  if (field === 'createdAt') {
    return estimate.createdAt;
  }
  if (field === 'updatedAt') {
    return estimate.updatedAt;
  }
  // validTo
  return estimate.validTo;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Calendar day in local time — secondary sort can reorder same-day items. */
function toSortDay(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: EstimateSortOrder,
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

export function compareEstimatesByField(
  a: EstimateSortPick,
  b: EstimateSortPick,
  field: EstimateSortField,
  order: EstimateSortOrder,
): number {
  const aValue = getEstimateSortValue(a, field);
  const bValue = getEstimateSortValue(b, field);

  if (isEstimateStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  if (isEstimateNumberSortField(field)) {
    const aNum = aValue as number;
    const bNum = bValue as number;
    return order === 'asc' ? aNum - bNum : bNum - aNum;
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}

/**
 * Primary then optional secondary; shared order for both levels.
 * When primary is a date field and secondary is set, primary is compared by
 * calendar day so secondary can reorder items on the same day.
 */
export function compareEstimatesTwoLevel(
  a: EstimateSortPick,
  b: EstimateSortPick,
  primary: EstimateSortField,
  secondary: EstimateSortField | '',
  order: EstimateSortOrder,
): number {
  if (secondary && isEstimateDateSortField(primary)) {
    const aPrimary = getEstimateSortValue(a, primary) as Date | null;
    const bPrimary = getEstimateSortValue(b, primary) as Date | null;
    const dayResult = compareNullableTimes(aPrimary, bPrimary, order, toSortDay);
    if (dayResult !== 0) {
      return dayResult;
    }
    const secondaryResult = compareEstimatesByField(a, b, secondary, order);
    if (secondaryResult !== 0) {
      return secondaryResult;
    }
    return compareNullableTimes(aPrimary, bPrimary, order, toSortTime);
  }

  const primaryResult = compareEstimatesByField(a, b, primary, order);
  if (primaryResult !== 0) {
    return primaryResult;
  }
  if (secondary) {
    return compareEstimatesByField(a, b, secondary, order);
  }
  return 0;
}
