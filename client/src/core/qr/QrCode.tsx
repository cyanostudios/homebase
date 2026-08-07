import { useEffect, useState } from 'react';
import { generateQrDataUrl } from './generateQr';

export type QrCodeProps = {
  value: string;
  /** Pixel size (width/height); default 256. */
  size?: number;
  alt?: string;
  className?: string;
  title?: string;
};

/**
 * Presentational QR renderer. Uses PNG data URL + `<img>` (safe default).
 * Consumers own layout/branding; this component has no admin chrome.
 */
export function QrCode({
  value,
  size = 256,
  alt = 'QR code',
  className,
  title,
}: QrCodeProps): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      setFailed(true);
      return;
    }

    generateQrDataUrl(trimmed, { width: size })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed || !src) {
    return (
      <span
        className={className}
        title={title}
        role="img"
        aria-label={failed ? `${alt} (unavailable)` : alt}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          background: failed ? 'transparent' : 'var(--muted, #f3f4f6)',
        }}
      />
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      title={title}
      className={className}
      decoding="async"
    />
  );
}
