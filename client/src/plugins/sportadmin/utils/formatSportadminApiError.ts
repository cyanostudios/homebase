// client/src/plugins/sportadmin/utils/formatSportadminApiError.ts
import type { ApiRequestError } from '@/core/api/createApiClient';

/** Prefer express-validator `details[].msg` over generic "Validation failed". */
export function formatSportadminApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) {
    return fallback;
  }
  const apiErr = err as ApiRequestError;
  const details = apiErr.details;
  if (Array.isArray(details) && details.length > 0) {
    const first = details[0] as { msg?: string; message?: string };
    const detailMsg = first?.msg || first?.message;
    if (detailMsg && typeof detailMsg === 'string') {
      return detailMsg;
    }
  }
  if (apiErr.message && apiErr.message !== 'Validation failed') {
    return apiErr.message;
  }
  if (apiErr.message === 'Validation failed') {
    return fallback;
  }
  return apiErr.message || fallback;
}
