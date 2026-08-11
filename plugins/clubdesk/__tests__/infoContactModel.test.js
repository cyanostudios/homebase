// plugins/clubdesk/__tests__/infoContactModel.test.js
const InfoContactModel = require('../infoContactModel');

describe('InfoContactModel', () => {
  let model;

  beforeEach(() => {
    model = new InfoContactModel();
  });

  test('normalizeBlurb strips tags and truncates', () => {
    expect(model.normalizeBlurb('<b>Hej</b>')).toBe('Hej');
    expect(model.normalizeBlurb('x'.repeat(600)).length).toBe(500);
    expect(model.normalizeBlurb(null)).toBe('');
  });

  test('normalizeContactId rejects invalid ids', () => {
    expect(() => model.normalizeContactId(0)).toThrow(/contactId/);
    expect(() => model.normalizeContactId('abc')).toThrow(/contactId/);
    expect(model.normalizeContactId('12')).toBe(12);
  });

  test('contactDisplayName prefers company name', () => {
    expect(
      model.contactDisplayName({
        company_name: 'FC Example',
        contact_persons: [{ name: 'Anna' }],
        contact_id: 9,
      }),
    ).toBe('FC Example');
  });

  test('transformPublicRow whitelists fields', () => {
    expect(
      model.transformPublicRow({
        id: 1,
        contact_id: 9,
        blurb: ' Ordförande ',
        company_name: 'FC Example',
        email: 'a@example.se',
        phone: '0701112233',
        contact_persons: [],
        notes: 'secret',
      }),
    ).toEqual({
      id: '1',
      name: 'FC Example',
      phone: '0701112233',
      email: 'a@example.se',
      blurb: 'Ordförande',
    });
  });
});
