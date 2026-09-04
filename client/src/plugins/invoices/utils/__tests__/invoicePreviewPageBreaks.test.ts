import {
  INVOICE_PDF_A4_HEIGHT_PX,
  INVOICE_PDF_PAGE_CONTENT_HEIGHT_PX,
} from '../invoicePreviewPageBreaks';

describe('invoicePreviewPageBreaks', () => {
  test('page content height is A4 minus PDF margins (~271mm)', () => {
    expect(INVOICE_PDF_A4_HEIGHT_PX).toBeGreaterThan(1100);
    expect(INVOICE_PDF_PAGE_CONTENT_HEIGHT_PX).toBeGreaterThan(1000);
    expect(INVOICE_PDF_PAGE_CONTENT_HEIGHT_PX).toBeLessThan(INVOICE_PDF_A4_HEIGHT_PX);
  });
});
