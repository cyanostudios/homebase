import type { ImportSchema } from '@/core/utils/importUtils';

/** Name-only import schema for persons on a garment list. */
export function getGarmentPersonImportSchema(t: (key: string) => string): ImportSchema {
  return {
    fields: [{ key: 'name', label: t('garments.personName'), required: true }],
  };
}
