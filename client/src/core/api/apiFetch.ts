/**
 * Cookie-session API calls: adds X-CSRF-Token for mutating methods when the server
 * returns a real token from GET /api/csrf-token (ENABLE_CSRF=true).
 */

let csrfTokenCache: string | null = null;

export function invalidateCsrfToken(): void {
  csrfTokenCache = null;
}

async function fetchCsrfToken(): Promise<string | null> {
  const response = await fetch('/api/csrf-token', { credentials: 'include' });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json().catch(() => ({}))) as { csrfToken?: string };
  const t = data.csrfToken;
  if (!t || t === 'csrf-disabled') {
    return null;
  }
  return t;
}

function methodNeedsCsrf(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

/**
 * Same as fetch() but credentials default to include and CSRF header is set when needed.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (methodNeedsCsrf(method)) {
    let token = csrfTokenCache;
    if (!token) {
      token = await fetchCsrfToken();
      if (token) {
        csrfTokenCache = token;
      }
    }
    if (token) {
      headers.set('X-CSRF-Token', token);
    }
  }

  return fetch(input, {
    ...init,
    method,
    headers,
    credentials: init.credentials ?? 'include',
  });
}
