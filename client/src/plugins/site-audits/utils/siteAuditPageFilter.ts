import type { SiteAuditPageResult } from '../types/site-audits';

/**
 * Normalize free-text into filter terms (trim, lowercase, dedupe).
 * Used when committing a typed draft into a tag chip.
 */
export function normalizeSiteAuditPageFilterTerm(raw: string): string | null {
  const term = String(raw ?? '')
    .trim()
    .toLowerCase();
  return term || null;
}

/**
 * Split a draft string into terms. Comma and whitespace are separators.
 */
export function parseSiteAuditPageFilterTerms(raw: string): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const term = normalizeSiteAuditPageFilterTerm(part);
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

/** @deprecated Use parseSiteAuditPageFilterTerms */
export const parseSiteAuditPageExcludeTerms = parseSiteAuditPageFilterTerms;

function pageUrlForFilter(page: SiteAuditPageResult): string {
  const finalUrl = typeof page.finalUrl === 'string' ? page.finalUrl : '';
  const url = typeof page.url === 'string' ? page.url : '';
  return `${url} ${finalUrl}`.toLowerCase();
}

function normalizeTermList(terms: readonly string[] | string | undefined): string[] {
  if (Array.isArray(terms)) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of terms) {
      const term = normalizeSiteAuditPageFilterTerm(raw);
      if (!term || seen.has(term)) continue;
      seen.add(term);
      out.push(term);
    }
    return out;
  }
  if (typeof terms === 'string') return parseSiteAuditPageFilterTerms(terms);
  return [];
}

/**
 * Filter pages by include ∩ ¬exclude (case-insensitive URL substring).
 * - Include empty → all pages (then exclude applies).
 * - Include non-empty → URL must contain at least one include term.
 * - Exclude non-empty → URL must not contain any exclude term.
 *
 * Example: pages /x /y /z, include [/x,/z], exclude [/y] → /x and /z.
 */
export function filterSiteAuditPages(
  pages: readonly SiteAuditPageResult[],
  options: { include?: readonly string[] | string; exclude?: readonly string[] | string } = {},
): SiteAuditPageResult[] {
  const include = normalizeTermList(options.include);
  const exclude = normalizeTermList(options.exclude);
  return pages.filter((page) => {
    const haystack = pageUrlForFilter(page);
    if (include.length > 0 && !include.some((term) => haystack.includes(term))) {
      return false;
    }
    if (exclude.length > 0 && exclude.some((term) => haystack.includes(term))) {
      return false;
    }
    return true;
  });
}

/**
 * Drop pages whose URL contains any exclude term.
 * Prefer {@link filterSiteAuditPages} when include is also needed.
 */
export function filterSiteAuditPagesByExclude(
  pages: readonly SiteAuditPageResult[],
  excludeRaw: string | readonly string[],
): SiteAuditPageResult[] {
  return filterSiteAuditPages(pages, { exclude: excludeRaw });
}
