/** Public share URL for an invoice token (same path as Share dialog / ShareBlock). */
export function buildInvoiceShareUrl(
  shareToken: string,
  origin: string = window.location.origin,
): string {
  return `${origin}/public/invoice/${shareToken}`;
}

/** Plain-text block appended to the email body via BulkEmailDialog.additionalText. */
export function formatInvoiceShareEmailText(shareUrl: string, label: string): string {
  return `---\n${label}:\n${shareUrl}`;
}

/** HTML block appended to the email body via BulkEmailDialog.additionalHtml. */
export function formatInvoiceShareEmailHtml(shareUrl: string, label: string): string {
  const safeUrl = escapeHtmlAttr(shareUrl);
  const safeLabel = escapeHtmlText(label);
  return `
<hr style="margin:24px 0;border:none;border-top:1px solid #ddd;">
<p style="margin:0 0 8px;font-size:13px;color:#666;">${safeLabel}</p>
<p style="margin:0;"><a href="${safeUrl}" style="color:#2563eb;word-break:break-all;">${safeUrl}</a></p>
`.trim();
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replace(/'/g, '&#39;');
}
