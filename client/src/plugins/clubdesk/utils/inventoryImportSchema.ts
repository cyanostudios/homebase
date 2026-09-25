import type { ImportSchema } from '@/core/utils/importUtils';

/** English labels for auto-mapping (platform convention). Aliases cover common SV/EN food exports. */
export function getClubdeskInventoryImportSchema(): ImportSchema {
  return {
    fields: [
      {
        key: 'articleName',
        label: 'Product',
        required: true,
        aliases: ['Artikel', 'artikel', 'Produkt', 'Product', 'Item', 'Namn', 'Varunamn'],
      },
      {
        key: 'brand',
        label: 'Brand / supplier',
        required: false,
        aliases: ['Varumärke', 'varumärke', 'Märke', 'Leverantör', 'Brand', 'Supplier'],
      },
      { key: 'description', label: 'Description', required: false, aliases: ['Beskrivning'] },
      {
        key: 'material',
        label: 'Packaging',
        required: false,
        aliases: ['Förpackning', 'Material', 'Packaging'],
      },
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
      {
        key: 'comment',
        label: 'Internal note',
        required: false,
        aliases: ['Kommentar', 'Intern anteckning', 'Note'],
      },
      {
        key: 'sku',
        label: 'Article no.',
        required: false,
        aliases: ['Artikelnr', 'Artikel nr', 'Art.nr', 'Art nr', 'SKU'],
      },
      {
        key: 'audience',
        label: 'Category',
        required: false,
        aliases: [
          'Kategori',
          'Category',
          'Linje',
          'Line',
          'Audience',
          'Målgrupp',
          'Malgrupp',
          'Sortiment',
        ],
      },
      {
        key: 'color',
        label: 'Flavour / variety',
        required: false,
        aliases: ['Smak', 'Sort', 'Flavour', 'Flavor', 'Variety', 'Färg', 'Farg', 'Color'],
      },
      {
        key: 'size',
        label: 'Pack size',
        required: false,
        aliases: [
          'Förpackningsstorlek',
          'Forpackningsstorlek',
          'Pack size',
          'Packsize',
          'Storlek',
          'Size',
          'Vikt',
          'Volym',
        ],
      },
      {
        key: 'quantity',
        label: 'Quantity',
        required: false,
        aliases: ['Antal', 'Qty', 'Lagerantal'],
      },
    ],
  };
}

const SHARED_ITEM_FIELDS = {
  articleName: 'Milk',
  brand: 'Arla',
  description: 'Pasteurised milk',
  material: 'Carton',
  purchasePrice: '8.50',
  recommendedPrice: '14.90',
  salePrice: '12.90',
  currency: 'SEK',
  comment: 'Sample product',
} as const;

/** Two rows — same product+brand, different pack sizes (for CSV template download). */
export const CLUBDESK_INVENTORY_IMPORT_EXAMPLE_ROWS: Record<string, string>[] = [
  {
    ...SHARED_ITEM_FIELDS,
    sku: 'ARLA-MILK-1L',
    audience: 'Dairy',
    color: 'Natural',
    size: '1 L',
    quantity: '48',
  },
  {
    ...SHARED_ITEM_FIELDS,
    sku: 'ARLA-MILK-1.5L',
    audience: 'Dairy',
    color: 'Natural',
    size: '1.5 L',
    quantity: '24',
  },
];
