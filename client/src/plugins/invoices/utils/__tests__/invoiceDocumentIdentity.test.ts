import { buildInvoiceCustomerBlock, displayNameFromEmail } from '../invoiceDocumentIdentity';

describe('displayNameFromEmail', () => {
  it('formats local-part with dots/underscores', () => {
    expect(displayNameFromEmail('mario.nasr@homebase.se')).toBe('Mario Nasr');
    expect(displayNameFromEmail('richard_kanebo@example.com')).toBe('Richard Kanebo');
  });

  it('returns empty for missing email', () => {
    expect(displayNameFromEmail('')).toBe('');
    expect(displayNameFromEmail(null)).toBe('');
    expect(displayNameFromEmail(undefined)).toBe('');
  });
});

describe('buildInvoiceCustomerBlock', () => {
  it('prefers billing address and fills name / org / street / post / city / country', () => {
    const block = buildInvoiceCustomerBlock({
      contactName: 'Fallback AB',
      organizationNumber: '000',
      contact: {
        companyName: 'Acme AB',
        organizationNumber: '556677-8899',
        addresses: [
          {
            type: 'Office',
            addressLine1: 'Other St 1',
            postalCode: '111 11',
            city: 'Other',
            country: 'Sweden',
          },
          {
            type: 'Billing',
            addressLine1: 'Main St 12',
            addressLine2: 'Floor 3',
            postalCode: '123 45',
            city: 'Stockholm',
            country: 'Sweden',
          },
        ],
      },
    });

    expect(block).toEqual({
      name: 'Acme AB',
      organizationNumber: '556677-8899',
      line1: 'Main St 12',
      line2: 'Floor 3',
      postalCode: '123 45',
      city: 'Stockholm',
      country: 'Sweden',
      reference: '',
      customerNumber: '',
    });
  });

  it('uses the first contact person name as kundreferens', () => {
    const block = buildInvoiceCustomerBlock({
      contact: {
        companyName: 'Acme AB',
        contactPersons: [
          { id: '1', name: '  ', title: 'Skip empty' },
          { id: '2', name: 'Anna Andersson', title: 'Buyer' },
          { id: '3', name: 'Bertil Berg', title: 'Other' },
        ],
      },
    });

    expect(block.reference).toBe('Anna Andersson');
  });

  it('uses contactNumber as kundnummer', () => {
    const block = buildInvoiceCustomerBlock({
      contact: {
        companyName: 'Acme AB',
        contactNumber: '42',
      },
    });

    expect(block.customerNumber).toBe('42');
  });
});
