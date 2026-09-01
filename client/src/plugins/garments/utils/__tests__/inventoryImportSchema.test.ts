import {
  buildAutoMapping,
  buildImportCsvTemplateContent,
  parseCSV,
} from '@/core/utils/importUtils';

import {
  GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS,
  getGarmentInventoryImportSchema,
} from '../inventoryImportSchema';

describe('inventoryImportSchema', () => {
  it('template headers auto-map to schema keys', () => {
    const schema = getGarmentInventoryImportSchema();
    const csv = buildImportCsvTemplateContent(schema, {}, GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS);
    const grid = parseCSV(csv);
    const mapping = buildAutoMapping(grid[0], schema);
    expect(mapping.articleName).toBe(0);
    expect(mapping.sku).toBe(9);
    expect(mapping.quantity).toBe(13);
    expect(grid).toHaveLength(3);
  });
});
