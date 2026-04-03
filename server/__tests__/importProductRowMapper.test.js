const {
  deepMergeChannelSpecific,
  buildFlatIncomingFromRow,
  applyTextsAndChannelSpecific,
  parseChannelSpecificJsonColumn,
  buildTextsExtendedPatchFromImportRow,
} = require('../../plugins/products/importProductRowMapper');

describe('importProductRowMapper', () => {
  it('deepMergeChannelSpecific merges nested objects', () => {
    const a = { cdon: { se: { price: 1 } }, textsExtended: { se: { name: 'A' } } };
    const b = { cdon: { se: { active: true } }, textsExtended: { se: { titleSeo: 'T' } } };
    const m = deepMergeChannelSpecific(a, b);
    expect(m.cdon.se).toEqual({ price: 1, active: true });
    expect(m.textsExtended.se).toEqual({ name: 'A', titleSeo: 'T' });
  });

  it('buildFlatIncomingFromRow maps normalized keys', () => {
    const r = {
      title: 'X',
      privatename: 'pn',
      purchaseprice: '12.5',
      lengthcm: '10',
      brandid: '3',
      mainimage: 'https://a/b.jpg',
      images: 'https://a/1.jpg, https://a/2.jpg',
    };
    const inc = buildFlatIncomingFromRow(r, false);
    expect(inc.title).toBe('X');
    expect(inc.privateName).toBe('pn');
    expect(inc.purchasePrice).toBe(12.5);
    expect(inc.lengthCm).toBe(10);
    expect(inc.brandId).toBe(3);
    expect(inc.mainImage).toBe('https://a/b.jpg');
    expect(inc.images).toEqual(['https://a/1.jpg', 'https://a/2.jpg']);
  });

  it('parseChannelSpecificJsonColumn rejects unknown root keys', () => {
    const r = { channelspecificjson: JSON.stringify({ textsExtended: {}, foo: 1 }) };
    const p = parseChannelSpecificJsonColumn(r);
    expect(p.ok).toBe(false);
    expect(p.code).toBe('invalid_channelspecificjson');
  });

  it('buildTextsExtendedPatchFromImportRow includes SEO and bulletpoints (comma-separated)', () => {
    const r = {
      'titleseo.se': 'seo',
      'metadesc.se': 'meta',
      'bulletpoints.se': 'a, b, c',
    };
    const patch = buildTextsExtendedPatchFromImportRow(r);
    expect(patch.se.titleSeo).toBe('seo');
    expect(patch.se.metaDesc).toBe('meta');
    expect(patch.se.bulletpoints).toEqual(['a', 'b', 'c']);
  });

  it('single bullet without comma is one item', () => {
    const r = { 'bulletpoints.se': 'En enda punkt' };
    const patch = buildTextsExtendedPatchFromImportRow(r);
    expect(patch.se.bulletpoints).toEqual(['En enda punkt']);
  });

  it('applyTextsAndChannelSpecific resolves standard market from texts', () => {
    const r = {
      'title.se': 'N',
      'description.se': '<p>Hello</p>',
    };
    const ch = applyTextsAndChannelSpecific(r, null, false);
    expect(ch.ok).toBe(true);
    expect(ch.usedTextsExtended).toBe(true);
    expect(ch.title).toBe('N');
    expect(ch.channelSpecific.textsStandard).toBe('se');
  });
});
