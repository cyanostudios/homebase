import { syncInvoicePreviewPageBreakGuides } from './invoicePreviewPageBreaks';

/**
 * Open invoice document HTML in a new browser tab/window (shared-style full preview).
 * Call `window.open` synchronously from the click handler, then write HTML when ready.
 */
export function openInvoicePreviewWindow(): Window | null {
  const win = window.open('about:blank', '_blank');
  if (!win) {
    return null;
  }
  try {
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faktura</title></head>' +
        '<body style="margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#64748b;">' +
        'Laddar förhandsvisning…</body></html>',
    );
    win.document.close();
  } catch {
    /* cross-origin / closed */
  }
  return win;
}

export function writeInvoicePreviewWindow(
  win: Window,
  html: string,
  title?: string,
  options?: { pageBreakLabel?: string },
): void {
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    if (title) {
      win.document.title = title;
    }

    const applyGuides = () => {
      syncInvoicePreviewPageBreakGuides(win.document, {
        label: options?.pageBreakLabel,
      });
    };
    // Layout + images settle asynchronously in the popup document.
    win.requestAnimationFrame(() => {
      applyGuides();
      win.setTimeout(applyGuides, 50);
      win.setTimeout(applyGuides, 250);
    });
  } catch {
    try {
      win.close();
    } catch {
      /* ignore */
    }
  }
}
