import { DEFAULT_REQUEST_TYPES } from '../types/requests';

export interface PublicBranding {
  name: string;
  logoUrl: string;
  website: string;
  email: string;
  requestTypes: string[];
}

/**
 * Normalize `/public/branding` JSON into a safe client shape.
 * Empty/missing `requestTypes` stays empty here; UI applies DEFAULT_REQUEST_TYPES separately.
 */
export function normalizePublicBranding(row: unknown): PublicBranding {
  const source =
    row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const rawTypes = source.requestTypes;
  const requestTypes = Array.isArray(rawTypes)
    ? rawTypes
        .filter((t: unknown): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter((t) => t !== '')
    : [];

  return {
    name: typeof source.name === 'string' ? source.name : '',
    logoUrl: typeof source.logoUrl === 'string' ? source.logoUrl : '',
    website: typeof source.website === 'string' ? source.website : '',
    email: typeof source.email === 'string' ? source.email : '',
    requestTypes,
  };
}

/** Prefer settings types when present; otherwise built-in defaults. */
export function resolvePublicRequestTypes(requestTypes: string[]): string[] {
  return requestTypes.length > 0 ? requestTypes : [...DEFAULT_REQUEST_TYPES];
}

/** Ensure website href is absolute for <a href>. */
export function resolvePublicWebsiteHref(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
