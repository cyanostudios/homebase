import {
  buildInvoiceShareUrl,
  formatInvoiceShareEmailHtml,
  formatInvoiceShareEmailText,
} from '../invoiceShareEmail';

describe('invoiceShareEmail', () => {
  test('buildInvoiceShareUrl uses public invoice path', () => {
    expect(buildInvoiceShareUrl('tok123', 'https://app.example')).toBe(
      'https://app.example/public/invoice/tok123',
    );
  });

  test('formatInvoiceShareEmailText includes label and url', () => {
    const text = formatInvoiceShareEmailText(
      'https://app.example/public/invoice/abc',
      'Invoice link',
    );
    expect(text).toContain('Invoice link');
    expect(text).toContain('https://app.example/public/invoice/abc');
  });

  test('formatInvoiceShareEmailHtml escapes and links the url', () => {
    const html = formatInvoiceShareEmailHtml(
      'https://app.example/public/invoice/a&b',
      'Invoice <link>',
    );
    expect(html).toContain('Invoice &lt;link&gt;');
    expect(html).toContain('href="https://app.example/public/invoice/a&amp;b"');
    expect(html).not.toContain('Invoice <link>');
  });
});
