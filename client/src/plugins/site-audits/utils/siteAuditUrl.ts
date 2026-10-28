/** External link target. Credentials and non-http(s) schemes stay plain text. */
export function isSafeSiteAuditHttpUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Best-effort hostname extraction for list/meta display — never throws on invalid input. */
export function getSiteAuditHostname(url: string | null | undefined): string {
  if (!url) {
    return '—';
  }
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}
