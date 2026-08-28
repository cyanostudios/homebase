import type { TFunction } from 'i18next';

import type { GarmentCheckboxColumn } from '../types/garments';

/** Map stable column id → status i18n key suffix. */
const STATUS_BY_COLUMN_ID: Record<string, string> = {
  person_betalt: 'betalt',
  person_blankett_fogis: 'blankett_fogis',
  shorts_bestallt: 'bestallt',
  shorts_levererat: 'levererat',
  shorts_utdelat: 'utdelat',
  troja_bestallt: 'bestallt',
  troja_levererat: 'levererat',
  troja_utdelat: 'utdelat',
  strumpor_bestallt: 'bestallt',
  strumpor_levererat: 'levererat',
  strumpor_utdelat: 'utdelat',
};

/** Map stored labels (EN or legacy SV) → status i18n key. */
const STATUS_BY_LABEL: Record<string, string> = {
  Paid: 'betalt',
  Betalt: 'betalt',
  'Fogis form': 'blankett_fogis',
  'Blankett Fogis': 'blankett_fogis',
  Ordered: 'bestallt',
  Beställt: 'bestallt',
  Delivered: 'levererat',
  Levererat: 'levererat',
  'Handed out': 'utdelat',
  Utdelat: 'utdelat',
};

/** Map stored group labels (EN or legacy SV) → i18n group key. */
export const GROUP_I18N_KEY: Record<string, string> = {
  Shorts: 'shorts',
  Shirt: 'shirt',
  Socks: 'socks',
  Tröja: 'shirt',
  Strumpor: 'socks',
};

/** Person size field for a garment group label (Shorts / Shirt / Socks). */
export type GarmentSizeField = 'shirtSize' | 'shortsSize' | 'socksSize';

const SIZE_FIELD_BY_GROUP_KEY: Record<string, GarmentSizeField> = {
  shorts: 'shortsSize',
  shirt: 'shirtSize',
  socks: 'socksSize',
};

export function sizeFieldForGroup(group: string): GarmentSizeField | null {
  const key = GROUP_I18N_KEY[group.trim()] ?? group.trim().toLowerCase();
  return SIZE_FIELD_BY_GROUP_KEY[key] ?? null;
}

export function translateCheckboxColumnLabel(
  t: TFunction,
  column: Pick<GarmentCheckboxColumn, 'id' | 'label'>,
): string {
  const invMatch = column.id.match(/^inv_\d+_(ordered|delivered|handed_out)$/);
  if (invMatch) {
    const suffixMap: Record<string, string> = {
      ordered: 'bestallt',
      delivered: 'levererat',
      handed_out: 'utdelat',
    };
    const statusKey = suffixMap[invMatch[1]];
    if (statusKey) {
      return t(`garments.columnStatus.${statusKey}`);
    }
  }
  const statusKey = STATUS_BY_COLUMN_ID[column.id] ?? STATUS_BY_LABEL[column.label];
  if (statusKey) {
    return t(`garments.columnStatus.${statusKey}`);
  }
  return column.label;
}

export function translateCheckboxStatusLabel(t: TFunction, label: string): string {
  const statusKey = STATUS_BY_LABEL[label];
  if (statusKey) {
    return t(`garments.columnStatus.${statusKey}`);
  }
  return label;
}

export function translateCheckboxGroupLabel(t: TFunction, group: string): string {
  const key = GROUP_I18N_KEY[group.trim()];
  if (key) {
    return t(`garments.columnGroups.${key}`);
  }
  return group;
}
