let sharedCsrfToken: string | null = null;
let sharedCsrfPromise: Promise<string> | null = null;

export async function getSharedCsrfToken(): Promise<string> {
  if (sharedCsrfToken) {
    return sharedCsrfToken;
  }
  if (sharedCsrfPromise) {
    return sharedCsrfPromise;
  }

  sharedCsrfPromise = fetch('/api/csrf-token', {
    credentials: 'include',
  })
    .then(async (response) => {
      const data = await response.json();
      const token = String(data?.csrfToken || '').trim();
      if (!token) {
        throw new Error('CSRF token not returned by server');
      }
      sharedCsrfToken = token;
      return token;
    })
    .finally(() => {
      sharedCsrfPromise = null;
    });

  return sharedCsrfPromise;
}

export function clearSharedCsrfToken() {
  sharedCsrfToken = null;
  sharedCsrfPromise = null;
}
