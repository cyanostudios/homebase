import type { ImportSchema } from '@/core/utils/importUtils';

/** English labels for auto-mapping (platform convention). Aliases cover common SV/EN exports. */
export function getGarmentInventoryImportSchema(): ImportSchema {
  return {
    fields: [
      {
        key: 'articleName',
        label: 'Article',
        required: true,
        aliases: ['Artikel', 'artikel', 'Product', 'Item', 'Namn'],
      },
      {
        key: 'brand',
        label: 'Brand',
        required: false,
        aliases: ['Varumärke', 'varumärke', 'Märke'],
      },
      { key: 'description', label: 'Description', required: false, aliases: ['Beskrivning'] },
      { key: 'material', label: 'Material', required: false },
      {
        key: 'purchasePrice',
        label: 'Purchase Price',
        required: false,
        aliases: ['Inköpspris', 'Inkopspris'],
      },
      {
        key: 'recommendedPrice',
        label: 'Recommended Price',
        required: false,
        aliases: ['Rekommenderat pris', 'Rek pris'],
      },
      {
        key: 'salePrice',
        label: 'Sale Price',
        required: false,
        aliases: ['Försäljningspris', 'Forsaljningspris'],
      },
      { key: 'currency', label: 'Currency', required: false, aliases: ['Valuta'] },
      { key: 'comment', label: 'Comment', required: false, aliases: ['Kommentar'] },
      {
        key: 'sku',
        label: 'Article no.',
        required: false,
        aliases: ['Artikelnr', 'Artikel nr', 'Art.nr', 'Art nr', 'SKU'],
      },
      { key: 'audience', label: 'Audience', required: false, aliases: ['Målgrupp', 'Malgrupp'] },
      { key: 'color', label: 'Color', required: false, aliases: ['Färg', 'Farg'] },
      { key: 'size', label: 'Size', required: false, aliases: ['Storlek'] },
      { key: 'quantity', label: 'Quantity', required: false, aliases: ['Antal', 'Qty'] },
    ],
  };
}

const SHARED_ITEM_FIELDS = {
  articleName: 'Match Jersey',
  brand: 'Nike',
  description: 'Home kit',
  material: 'Polyester',
  purchasePrice: '150',
  recommendedPrice: '299',
  salePrice: '249',
  currency: 'SEK',
  comment: 'Sample item',
} as const;

/** Two rows — same article+brand, different variants (for CSV template download). */
export const GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS: Record<string, string>[] = [
  {
    ...SHARED_ITEM_FIELDS,
    sku: 'NJ-RED-M',
    audience: 'Men',
    color: 'Red',
    size: 'M',
    quantity: '10',
  },
  {
    ...SHARED_ITEM_FIELDS,
    sku: 'NJ-RED-L',
    audience: 'Men',
    color: 'Red',
    size: 'L',
    quantity: '5',
  },
];
