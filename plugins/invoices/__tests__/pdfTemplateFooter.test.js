const { facioDocumentStyles } = require('../pdfTemplate');

describe('invoice PDF document footer', () => {
  test('page fills A4 content box and footer uses margin-top auto (sticky bottom)', () => {
    const css = facioDocumentStyles();
    expect(css).toContain('min-height: 271mm');
    expect(css).toMatch(/\.page\s*\{[\s\S]*?display:\s*flex/);
    expect(css).toMatch(/\.page\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(css).toMatch(/\.footer\s*\{[\s\S]*?margin-top:\s*auto/);
  });
});
