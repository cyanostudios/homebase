import type { GarmentCheckboxColumn } from '../types/garments';

/** Fixed category groups for garment status columns (stable across all lists). */
export const GARMENT_COLUMN_GROUPS = ['Shorts', 'Shirt', 'Socks'] as const;

/** Person-level statuses (one checkbox per person, not per garment). */
export const PERSON_COLUMN_STATUSES = [
  { id: 'person_betalt', label: 'Paid' },
  { id: 'person_blankett_fogis', label: 'Fogis form' },
] as const;

/** Garment statuses within each Shorts / Shirt / Socks group. */
export const GARMENT_COLUMN_STATUSES = [
  { idSuffix: 'bestallt', label: 'Ordered' },
  { idSuffix: 'levererat', label: 'Delivered' },
  { idSuffix: 'utdelat', label: 'Handed out' },
] as const;

const GROUP_ID_PREFIX: Record<(typeof GARMENT_COLUMN_GROUPS)[number], string> = {
  Shorts: 'shorts',
  Shirt: 'troja',
  Socks: 'strumpor',
};

/**
 * Default checkbox columns for a new garment list:
 * Paid + Fogis form (person-level) + Ordered/Delivered/Handed out per garment group.
 * Labels are English (working language); UI may re-translate via column id.
 */
export function createDefaultCheckboxColumns(): GarmentCheckboxColumn[] {
  const columns: GarmentCheckboxColumn[] = [];
  let sortOrder = 0;

  for (const status of PERSON_COLUMN_STATUSES) {
    columns.push({
      id: status.id,
      label: status.label,
      sortOrder,
    });
    sortOrder += 1;
  }

  for (const group of GARMENT_COLUMN_GROUPS) {
    const prefix = GROUP_ID_PREFIX[group];
    for (const status of GARMENT_COLUMN_STATUSES) {
      columns.push({
        id: `${prefix}_${status.idSuffix}`,
        label: status.label,
        group,
        sortOrder,
      });
      sortOrder += 1;
    }
  }

  return columns;
}
