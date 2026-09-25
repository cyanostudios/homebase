// client/src/core/ui/ImageLightbox.tsx
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export type ImageLightboxProps = {
  src: string;
  /** Lightbox image alt; thumbnail uses empty alt when decorative. */
  alt?: string;
  /** Close when this value changes (selected entity / tab). */
  resetKey?: string | number | null;
  openAriaLabel?: string;
  dialogAriaLabel?: string;
  /** Classes on the zoom-in trigger button. */
  triggerClassName?: string;
  /** Classes on the thumbnail <img>. */
  imageClassName?: string;
  /** Optional thumbnail content; defaults to <img src={src}>. */
  children?: React.ReactNode;
  /** Thumbnail img onError (ignored when children provided). */
  onThumbnailError?: React.ReactEventHandler<HTMLImageElement>;
};

/**
 * Shared image thumbnail + fullscreen lightbox (Files / SportAdmin parity).
 */
export function ImageLightbox({
  src,
  alt = '',
  resetKey = null,
  openAriaLabel,
  dialogAriaLabel,
  triggerClassName,
  imageClassName,
  children,
  onThumbnailError,
}: ImageLightboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const openLabel = openAriaLabel || t('common.openImageLightbox');
  const dialogLabel = dialogAriaLabel || t('common.imagePreview');

  useEffect(() => {
    setOpen(false);
  }, [resetKey, src]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      // Capture phase so detail-panel Escape does not also dismiss the host view.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const lightbox =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <button
              type="button"
              aria-label={t('common.close')}
              className="absolute inset-0 cursor-default border-0 bg-black/80 p-0"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={dialogLabel}
              className="relative z-10 max-h-[90vh] max-w-[90vw]"
            >
              <button
                type="button"
                className="fixed right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border-0 bg-white/15 text-white hover:bg-white/25"
                aria-label={t('common.close')}
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <img
                src={src}
                alt={alt || 'image'}
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={cn('cursor-zoom-in border-0 bg-transparent p-0', triggerClassName)}
        aria-label={openLabel}
        onClick={() => setOpen(true)}
      >
        {children ?? (
          <img
            src={src}
            alt=""
            className={imageClassName}
            loading="lazy"
            onError={onThumbnailError}
          />
        )}
      </button>
      {lightbox}
    </>
  );
}
