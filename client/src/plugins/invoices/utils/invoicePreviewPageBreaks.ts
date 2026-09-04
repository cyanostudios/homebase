/**
 * Approximate PDF page-break positions for invoice document previews.
 * Matches Puppeteer A4 margins in `server/core/utils/puppeteerPdf.js`.
 * Actual Chromium breaks may differ slightly (e.g. table row keep-together).
 */

const MM_TO_PX = 96 / 25.4;

/** A4 height at CSS 96dpi. */
export const INVOICE_PDF_A4_HEIGHT_PX = Math.round(297 * MM_TO_PX);

/** Usable content height per PDF page (A4 minus top/bottom print margins). */
export const INVOICE_PDF_PAGE_CONTENT_HEIGHT_PX = Math.round((297 - 14 - 12) * MM_TO_PX);

const GUIDE_ATTR = 'data-pdf-page-break-guide';

function resolvePreviewDocument(
  target: HTMLIFrameElement | Document | null | undefined,
): Document | null {
  if (!target) {
    return null;
  }
  if ('contentDocument' in target) {
    return target.contentDocument;
  }
  return target;
}

/**
 * Draw dashed guides at each expected PDF page break inside a preview document/iframe.
 */
export function syncInvoicePreviewPageBreakGuides(
  target: HTMLIFrameElement | Document | null | undefined,
  options?: { label?: string },
): void {
  try {
    const doc = resolvePreviewDocument(target);
    const page = doc?.querySelector('.page') as HTMLElement | null;
    if (!doc || !page) {
      return;
    }

    page.style.position = page.style.position || 'relative';
    page.querySelectorAll(`[${GUIDE_ATTR}]`).forEach((node) => node.remove());

    const contentHeight = Math.max(page.scrollHeight, page.offsetHeight);
    const pageHeight = INVOICE_PDF_PAGE_CONTENT_HEIGHT_PX;
    if (contentHeight <= pageHeight + 8) {
      return;
    }

    const labelPrefix = options?.label?.trim() || 'Page break';
    let pageIndex = 2;
    for (let y = pageHeight; y < contentHeight - 4; y += pageHeight) {
      const guide = doc.createElement('div');
      guide.setAttribute(GUIDE_ATTR, 'true');
      guide.setAttribute('aria-hidden', 'true');
      guide.style.cssText = [
        'position:absolute',
        'left:0',
        'right:0',
        `top:${Math.round(y)}px`,
        'z-index:20',
        'pointer-events:none',
        'border-top:1px dashed #94a3b8',
        'transform:translateY(-0.5px)',
      ].join(';');

      const label = doc.createElement('span');
      label.textContent = `${labelPrefix} · ${pageIndex}`;
      label.style.cssText = [
        'position:absolute',
        'right:0',
        'top:-14px',
        'padding:0 6px',
        'font-size:9px',
        'font-weight:600',
        'letter-spacing:0.06em',
        'text-transform:uppercase',
        'color:#64748b',
        'background:#fff',
        'font-family:Helvetica,Arial,sans-serif',
      ].join(';');
      guide.appendChild(label);
      page.appendChild(guide);
      pageIndex += 1;
    }
  } catch {
    // Cross-origin or detached document — ignore.
  }
}
