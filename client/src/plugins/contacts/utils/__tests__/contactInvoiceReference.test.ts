import {
  buildContactPersonsInvoiceReferenceSavePayload,
  isContactPersonInvoiceReference,
  pickInvoiceReferencePersonName,
  withContactPersonInvoiceReference,
} from '../contactInvoiceReference';

describe('pickInvoiceReferencePersonName', () => {
  it('prefers the flagged invoice reference person', () => {
    expect(
      pickInvoiceReferencePersonName([
        { id: '1', name: 'Anna' },
        { id: '2', name: 'Bertil', invoiceReference: true },
      ]),
    ).toBe('Bertil');
  });

  it('falls back to first non-empty name when none flagged', () => {
    expect(
      pickInvoiceReferencePersonName([
        { id: '1', name: '  ' },
        { id: '2', name: 'Anna Andersson' },
      ]),
    ).toBe('Anna Andersson');
  });
});

describe('isContactPersonInvoiceReference', () => {
  it('is false when none are flagged', () => {
    const persons = [
      { id: '1', name: 'Anna' },
      { id: '2', name: 'Bertil' },
    ];
    expect(isContactPersonInvoiceReference(persons, '1')).toBe(false);
    expect(isContactPersonInvoiceReference(persons, '2')).toBe(false);
  });

  it('uses explicit flag when present', () => {
    const persons = [
      { id: '1', name: 'Anna' },
      { id: '2', name: 'Bertil', invoiceReference: true },
    ];
    expect(isContactPersonInvoiceReference(persons, '1')).toBe(false);
    expect(isContactPersonInvoiceReference(persons, '2')).toBe(true);
  });
});

describe('withContactPersonInvoiceReference', () => {
  it('sets only the selected person', () => {
    expect(
      withContactPersonInvoiceReference(
        [
          { id: '1', name: 'Anna', invoiceReference: true },
          { id: '2', name: 'Bertil' },
        ],
        '2',
        true,
      ),
    ).toEqual([
      { id: '1', name: 'Anna', invoiceReference: false },
      { id: '2', name: 'Bertil', invoiceReference: true },
    ]);
  });

  it('clears the flag when unselected', () => {
    expect(
      withContactPersonInvoiceReference(
        [{ id: '1', name: 'Anna', invoiceReference: true }],
        '1',
        false,
      ),
    ).toEqual([{ id: '1', name: 'Anna', invoiceReference: false }]);
  });
});

describe('buildContactPersonsInvoiceReferenceSavePayload', () => {
  it('patches contactPersons on the contact payload', () => {
    const contact = {
      id: '9',
      companyName: 'Acme',
      contactPersons: [
        { id: '1', name: 'Anna' },
        { id: '2', name: 'Bertil' },
      ],
    };
    expect(
      buildContactPersonsInvoiceReferenceSavePayload(contact, '2', true).contactPersons,
    ).toEqual([
      { id: '1', name: 'Anna', invoiceReference: false },
      { id: '2', name: 'Bertil', invoiceReference: true },
    ]);
  });
});
