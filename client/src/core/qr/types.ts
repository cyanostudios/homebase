export type SwishNumberKind = 'mobile' | 'corporate';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Bitmask: true bit = field editable in Swish app. */
export const SWISH_LOCK = {
  PAYEE: 1,
  AMOUNT: 2,
  MESSAGE: 4,
} as const;

export type GenerateQrOptions = {
  /** Pixel width; default 256. */
  width?: number;
  /** Quiet-zone modules; default 2. */
  margin?: number;
  /** Default 'M'. */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
};

export type BuildSwishTypeCInput = {
  payee: string;
  /** Omit / null / undefined → empty amount field. When set, must be > 0. */
  amount?: number | null;
  message?: string | null;
  /** Default 0 (all fields locked). */
  lockMask?: number;
};

/** Soft max length for any QR payload string (keeps codes scannable). */
export const QR_MAX_PAYLOAD_LENGTH = 500;

/** Swish message max length *before* URL-encoding. */
export const SWISH_MESSAGE_MAX_LENGTH = 50;
