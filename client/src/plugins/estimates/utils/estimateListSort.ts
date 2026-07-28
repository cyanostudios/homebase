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
