import { DEFAULT_REQUEST_TYPES } from '../types/requests';

import { coercePublicRequestType, type PublicRequestType } from './requestTypeConfig';

export interface PublicBranding {
  name: string;
  logoUrl: string;
  website: string;
  email: string;
  requestTypes: PublicRequestType[];
}

/**
 * Normalize `/public/branding` JSON into a safe client shape.
 * Empty/missing `requestTypes` stays empty here; UI applies DEFAULT_REQUEST_TYPES separately.
 * Accepts legacy string[] or `{ key, plugin?, intakeSchema? }[]` — never keeps targetListId.
 */
export function normalizePublicBranding(row: unknown): PublicBranding {
  const source =
    row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const rawTypes = source.requestTypes;
  const requestTypes = Array.isArray(rawTypes)
    ? rawTypes.map(coercePublicRequestType).filter((t): t is PublicRequestType => t !== null)
    : [];

  return {
    name: typeof source.name === 'string' ? source.name : '',
    logoUrl: typeof source.logoUrl === 'string' ? source.logoUrl : '',
    website: typeof source.website === 'string' ? source.website : '',
    email: typeof source.email === 'string' ? source.email : '',
    requestTypes,
  };
}

/** Prefer settings types when present; otherwise built-in defaults as plain keys. */
export function resolvePublicRequestTypes(requestTypes: PublicRequestType[]): PublicRequestType[] {
  return requestTypes.length > 0 ? requestTypes : DEFAULT_REQUEST_TYPES.map((key) => ({ key }));
}

/** Ensure website href is absolute for <a href>. */
export function resolvePublicWebsiteHref(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
