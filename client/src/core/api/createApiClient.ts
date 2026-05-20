import { apiFetch } from '@/core/api/apiFetch';

export type ApiRequestError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

export type CreateApiClientOptions = {
  /** Set Content-Type only on POST/PUT/DELETE (ingest plugin). */
  jsonOnMutationsOnly?: boolean;
  /** Return null for 204 No Content responses. */
  emptyBodyAsNull?: boolean;
};

/**
 * JSON API client for plugin routes under `/api{basePath}`.
 * @param basePath e.g. `/contacts` — request paths are suffixes like ``, `/${id}`, `/shares`.
 */
export function createApiClient(basePath: string, clientOptions: CreateApiClientOptions = {}) {
  const prefix = `/api${basePath.startsWith('/') ? basePath : `/${basePath}`}`;

  return async function request(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    const isMutation =
      options.method !== undefined && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method);

    if (clientOptions.jsonOnMutationsOnly) {
      if (isMutation) {
        headers['Content-Type'] = 'application/json';
      }
    } else {
      headers['Content-Type'] = 'application/json';
    }

    const url = path ? `${prefix}${path.startsWith('/') ? path : `/${path}`}` : prefix;

    const response = await apiFetch(url, {
      headers,
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));

      const errorMessage =
        (error as { error?: string; message?: string }).error ||
        (error as { error?: string; message?: string }).message ||
        'Request failed';
      const errorCode = (error as { code?: string }).code;
      const errorDetails = (error as { details?: unknown }).details;

      const err = new Error(errorMessage) as ApiRequestError;
      err.status = response.status;
      err.code = errorCode;
      err.details = errorDetails;

      throw err;
    }

    if (clientOptions.emptyBodyAsNull && response.status === 204) {
      return null;
    }

    return response.json();
  };
}
