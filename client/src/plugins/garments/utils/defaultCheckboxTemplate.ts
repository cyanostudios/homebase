import type { GarmentCheckboxColumn } from '../types/garments';

const BASE_LABELS = ['Betalt', 'SvFF-blankett', 'FOGIS-reg.'] as const;
const GARMENT_KINDS = ['Tröja', 'Shorts', 'Strumpor'] as const;
const GARMENT_STATES = ['Beställt', 'Levererat', 'Utdelat'] as const;

function newColumnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Default checkbox columns for a new garment list (Swedish Excel-inspired template). */
export function createDefaultCheckboxColumns(): GarmentCheckboxColumn[] {
  const labels: string[] = [
    ...BASE_LABELS,
    ...GARMENT_KINDS.flatMap((kind) => GARMENT_STATES.map((state) => `${kind} ${state}`)),
  ];
  return labels.map((label, index) => ({
    id: newColumnId(),
    label,
    sortOrder: index,
  }));
}
