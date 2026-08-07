import { generateQrDataUrl, generateQrSvg } from '../generateQr';
import { QR_MAX_PAYLOAD_LENGTH } from '../types';

describe('generateQrDataUrl', () => {
  it('returns a PNG data URL for non-empty payload', async () => {
    const url = await generateQrDataUrl('https://example.com');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });

  it('encodes a Swish Type C payload', async () => {
    const url = await generateQrDataUrl('C0701234567;100,00;Test;0');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rejects empty / whitespace', async () => {
    await expect(generateQrDataUrl('')).rejects.toThrow(/non-empty/i);
    await expect(generateQrDataUrl('   ')).rejects.toThrow(/non-empty/i);
  });

  it('rejects oversized payload', async () => {
    const huge = 'a'.repeat(QR_MAX_PAYLOAD_LENGTH + 1);
    await expect(generateQrDataUrl(huge)).rejects.toThrow(/maximum length/i);
  });
});

describe('generateQrSvg', () => {
  it('returns SVG markup', async () => {
    const svg = await generateQrSvg('hello');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
