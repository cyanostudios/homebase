import {
  buildEstimateShareUrl,
  formatEstimateShareEmailHtml,
  formatEstimateShareEmailText,
} from '../estimateShareEmail';

describe('estimateShareEmail', () => {
  test('buildEstimateShareUrl uses public estimate path', () => {
    expect(buildEstimateShareUrl('tok123', 'https://app.example')).toBe(
      'https://app.example/public/estimate/tok123',
    );
  });

  test('formatEstimateShareEmailText includes label and url', () => {
    const text = formatEstimateShareEmailText(
      'https://app.example/public/estimate/abc',
      'Estimate link',
    );
    expect(text).toContain('Estimate link');
    expect(text).toContain('https://app.example/public/estimate/abc');
  });

  test('formatEstimateShareEmailHtml escapes and links the url', () => {
    const html = formatEstimateShareEmailHtml(
      'https://app.example/public/estimate/a&b',
      'Estimate <link>',
    );
    expect(html).toContain('Estimate &lt;link&gt;');
    expect(html).toContain('href="https://app.example/public/estimate/a&amp;b"');
    expect(html).not.toContain('Estimate <link>');
  });
});
