const { decodeHtmlEntities } = require('../../../server/core/utils/htmlEscape');
const ContactModel = require('../model');

describe('ContactModel companyName HTML entities', () => {
  const model = new ContactModel();

  it('transformRow decodes legacy &amp; in companyName for titles', () => {
    const dto = model.transformRow({
      id: 1,
      contact_number: '1',
      contact_type: 'company',
      company_name: 'Wahlbeck &amp; Hammarström AB',
      company_type: '',
      organization_number: '',
      vat_number: '',
      personal_number: '',
      contact_persons: '[]',
      addresses: '[]',
      email: '',
      phone: '',
      phone2: '',
      website: 'https://ex.com?a=1&amp;b=2',
      tax_rate: null,
      payment_terms: null,
      currency: '',
      f_tax: '',
      notes: 'A &amp; B',
      tags: '[]',
      is_assignable: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    expect(dto.companyName).toBe('Wahlbeck & Hammarström AB');
    expect(dto.website).toBe('https://ex.com?a=1&b=2');
    expect(dto.notes).toBe('A & B');
  });

  it('decodeHtmlEntities undoes stacked amp escaping', () => {
    expect(decodeHtmlEntities('A &amp;amp; B')).toBe('A & B');
  });

  it('transformRow preserves tax_rate and payment_terms of 0', () => {
    const dto = model.transformRow({
      id: 2,
      contact_number: '2',
      contact_type: 'company',
      company_name: 'Zero VAT AB',
      tax_rate: 0,
      payment_terms: 0,
      contact_persons: '[]',
      addresses: '[]',
      tags: '[]',
    });
    expect(dto.taxRate).toBe('0');
    expect(dto.paymentTerms).toBe('0');
  });
});
