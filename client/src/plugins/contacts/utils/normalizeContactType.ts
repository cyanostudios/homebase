export type ContactTypeValue = 'company' | 'private';

/**
 * Map free-text / CSV type labels to DB-allowed contact_type values.
 * Empty or unknown values default to `company` (schema default).
 */
export function normalizeContactType(raw: unknown): ContactTypeValue {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!value) return 'company';

  if (
    value === 'private' ||
    value === 'privat' ||
    value === 'person' ||
    value === 'individual' ||
    value === 'privatperson'
  ) {
    return 'private';
  }

  if (value === 'company' || value === 'företag' || value === 'foretag' || value === 'business') {
    return 'company';
  }

  return 'company';
}
