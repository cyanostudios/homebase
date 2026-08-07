export type { BuildSwishTypeCInput, GenerateQrOptions, Result, SwishNumberKind } from './types';
export { QR_MAX_PAYLOAD_LENGTH, SWISH_LOCK, SWISH_MESSAGE_MAX_LENGTH } from './types';

export {
  classifySwishNumber,
  isValidSwishNumber,
  normalizeSwishNumber,
  parseSwishNumber,
} from './swishNumber';

export { buildSwishTypeCPayload, formatSwishAmount } from './swishPayload';

export { generateQrDataUrl, generateQrSvg } from './generateQr';

export { QrCode } from './QrCode';
export type { QrCodeProps } from './QrCode';
