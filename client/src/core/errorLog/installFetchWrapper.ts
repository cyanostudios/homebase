/**
 * Wraps window.fetch to log failed API responses to the error store.
 * Only logs requests to /api/ paths.
 * Must be called once when app initializes (e.g. from ErrorLogProvider).
 */

import { addApiError } from './apiErrorStore';

const ORIG_FETCH = window.fetch;

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function installApiErrorCapture(): void {
  if ((window as any).__homebaseFetchWrapperInstalled) return;
  (window as any).__homebaseFetchWrapperInstalled = true;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = getUrl(input);
    const res = await ORIG_FETCH.call(window, input, init);

    if (res.ok) return res;
    if (!url.includes('/api/')) return res;

    let message = res.statusText || `HTTP ${res.status}`;
    let body: string | undefined;
    try {
      body = await res.clone().text();
      const parsed = body ? JSON.parse(body) : null;
      if (parsed?.message) message = String(parsed.message);
      else if (parsed?.error) message = String(parsed.error);
      else if (Array.isArray(parsed?.errors) && parsed.errors[0]?.message)
        message = String(parsed.errors[0].message);
    } catch {
      // use default message
    }

    addApiError({
      message,
      url,
      status: res.status,
      statusText: res.statusText,
      method: typeof init?.method === 'string' ? init.method : 'GET',
      body: body && body.length < 2000 ? body : body ? body.slice(0, 2000) + '…' : undefined,
    });

    return res;
  };
}
