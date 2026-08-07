import QRCode from 'qrcode';
import type { GenerateQrOptions } from './types';
import { QR_MAX_PAYLOAD_LENGTH } from './types';

function assertPayload(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    throw new Error('QR payload must be a non-empty string');
  }
  if (trimmed.length > QR_MAX_PAYLOAD_LENGTH) {
    throw new Error(`QR payload exceeds maximum length (${QR_MAX_PAYLOAD_LENGTH})`);
  }
  return trimmed;
}

function toQrOptions(options?: GenerateQrOptions) {
  return {
    width: options?.width ?? 256,
    margin: options?.margin ?? 2,
    errorCorrectionLevel: options?.errorCorrectionLevel ?? ('M' as const),
  };
}

/** Encode any string/URL as a PNG data URL (`data:image/png;base64,…`). */
export async function generateQrDataUrl(
  value: string,
  options?: GenerateQrOptions,
): Promise<string> {
  const payload = assertPayload(value);
  return QRCode.toDataURL(payload, toQrOptions(options));
}

/**
 * Encode as an SVG markup string. Prefer `generateQrDataUrl` for rendering —
 * do not inject SVG via dangerouslySetInnerHTML without Security review.
 */
export async function generateQrSvg(value: string, options?: GenerateQrOptions): Promise<string> {
  const payload = assertPayload(value);
  return QRCode.toString(payload, { ...toQrOptions(options), type: 'svg' });
}
