const { generatePDFHTML } = require('../pdfTemplate');

describe('estimate pdfTemplate', () => {
  test('uses Facio Offert layout and skips text rows in totals', () => {
    const html = generatePDFHTML({
      estimateNumber: '2026-001',
      status: 'sent',
      currency: 'SEK',
      createdAt: '2026-01-01',
      validTo: '2026-02-01',
      orderNumber: 'O-1',
      deliveryMethod: 'Hämtning',
      lineItems: [
        {
          kind: 'item',
          description: 'Item',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          vatRate: 25,
        },
        { kind: 'text', description: 'Not priced' },
      ],
      estimateDiscount: 0,
    });

    expect(html).toMatch(/Offert/);
    expect(html).toMatch(/class="page"/);
    expect(html).toMatch(/doc-header/);
    expect(html).not.toMatch(/cdn\.tailwindcss/);
    expect(html).not.toMatch(/<h1 class="title">ESTIMATE/);
    expect(html).toMatch(/Giltig t\.o\.m\./);
    expect(html).toMatch(/Offertsumma/);
    expect(html).toMatch(/Offertedatum/);
    expect(html).not.toMatch(/Summa att betala/);
    expect(html).not.toMatch(/Förfallodatum/);
    expect(html).not.toMatch(/Betalningsvillkor/);
    expect(html).not.toMatch(/Dröjsmålsränta/);
    expect(html).toMatch(/Ordernummer/);
    expect(html).toMatch(/Leveranssätt/);
    expect(html).toMatch(/Not priced/);
    expect(html).not.toMatch(/Godkänd för F-skatt/);
  });

  test('footer shows issuer profile and F-skatt when organization is provided', () => {
    const html = generatePDFHTML(
      {
        estimateNumber: '2026-010',
        createdAt: '2026-01-01',
        validTo: '2026-02-01',
        lineItems: [
          {
            kind: 'item',
            description: 'Item',
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            vatRate: 25,
          },
        ],
        estimateDiscount: 0,
      },
      {
        name: 'Homebase AB',
        address: { line1: 'Gatan 1', postalCode: '11122', city: 'Stockholm' },
        email: 'info@example.com',
        phone: '08-123',
        website: 'example.com',
        billing: {
          organizationNumber: '556677-8899',
          vatNumber: 'SE556677889901',
          bankgiro: '123-4567',
          fTax: 'yes',
        },
      },
      { name: 'Kund AB' },
    );

    expect(html).toMatch(/Homebase AB/);
    expect(html).toMatch(/Godkänd för F-skatt/);
    expect(html).toMatch(/Org\.nr/);
    expect(html).toMatch(/556677-8899/);
    expect(html).toMatch(/Bankgiro/);
    expect(html).toMatch(/123-4567/);
    expect(html).toMatch(/class="footer"/);
  });

  test('renders Offertrabatt when estimate discount is set', () => {
    const html = generatePDFHTML({
      estimateNumber: '2026-002',
      createdAt: '2026-01-01',
      validTo: '2026-02-01',
      lineItems: [
        {
          kind: 'item',
          description: 'Item',
          quantity: 1,
          unitPrice: 1000,
          discount: 0,
          vatRate: 25,
        },
      ],
      estimateDiscount: 10,
    });

    expect(html).toMatch(/Offertrabatt/);
    expect(html).not.toMatch(/Fakturarabatt/);
  });
});
