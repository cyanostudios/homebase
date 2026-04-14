const {
  getExportGeneralColumnIdsSet,
  buildExportColumnReferencePayload,
} = require('../../plugins/products/exportColumnReference');
const {
  parseChannelHeaderKey,
  getGeneralCell,
} = require('../../plugins/products/productExportBuilder');

describe('product export', () => {
  test('general column whitelist includes core ids', () => {
    const s = getExportGeneralColumnIdsSet();
    expect(s.has('sku')).toBe(true);
    expect(s.has('bogus')).toBe(false);
  });

  test('parseChannelHeaderKey parses woo instance columns', () => {
    expect(parseChannelHeaderKey('woocommerce.11.price')).toEqual({
      channel: 'woocommerce',
      segment: '11',
      field: 'price',
    });
    expect(parseChannelHeaderKey('cdon.se.active')).toEqual({
      channel: 'cdon',
      segment: 'se',
      field: 'active',
    });
    expect(parseChannelHeaderKey('not-a-column')).toBeNull();
    expect(parseChannelHeaderKey('woocommerce.11.categories')).toBeNull();
  });

  test('buildExportColumnReferencePayload builds woocommerce numeric instance headers', () => {
    const p = buildExportColumnReferencePayload([
      {
        id: '5',
        channel: 'woocommerce',
        instanceKey: 'shop',
        market: null,
        label: 'A',
        enabled: true,
      },
    ]);
    expect(p.channelColumns.length).toBe(1);
    const keys = p.channelColumns[0].fields.map((f) => f.headerKey);
    expect(keys).toContain('woocommerce.5.price');
    expect(keys).toContain('woocommerce.5.active');
  });

  test('getGeneralCell reads sku', () => {
    expect(getGeneralCell({ sku: 'ABC-1' }, 'sku')).toBe('ABC-1');
  });
});
