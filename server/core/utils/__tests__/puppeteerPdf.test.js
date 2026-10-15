const { pdfGenerationHttpError } = require('../puppeteerPdf');

describe('pdfGenerationHttpError', () => {
  test('maps missing Chrome to 503 with install hint', () => {
    const mapped = pdfGenerationHttpError(
      new Error('Could not find Chrome (ver. 138.0.7204.168).'),
    );
    expect(mapped.status).toBe(503);
    expect(mapped.error).toMatch(/puppeteer:install-chrome/);
  });

  test('maps other failures to generic 500', () => {
    expect(pdfGenerationHttpError(new Error('timeout'))).toEqual({
      status: 500,
      error: 'Failed to generate PDF',
    });
  });
});
