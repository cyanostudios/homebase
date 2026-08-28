import type { GarmentCheckboxColumn } from '../types/garments';

/**
 * Default checkbox columns for a new garment list: Paid only.
 * Garment groups (Ordered/Delivered/Handed out) are added when inventory is assigned in Settings.
 */
export function createDefaultCheckboxColumns(): GarmentCheckboxColumn[] {
  return [{ id: 'person_betalt', label: 'Paid', sortOrder: 0 }];
}
