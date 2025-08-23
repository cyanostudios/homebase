// client/src/plugins/channels/api/channelsApi.ts
// Kopierad från neutral TemplateApi – endast basvägen är satt till /api/channels.

export type ApiFieldError = { field: string; message: string };

export class TemplateApi {
  constructor(private basePath: string) {}

  private async request(path: string, options: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetch(`${this.basePath}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        credentials: 'include',
        ...options,
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    if (!response.ok) {
      let payload: any = null;
      try { payload = await response.json(); } catch {}

      const err: any = new Error(
        response.status === 409 && payload?.errors?.[0]?.message
          ? payload.errors[0].message
          : (payload?.error || response.statusText || 'Request failed')
      );
      err.status = response.status;
      if (payload?.errors) err.errors = payload.errors as ApiFieldError[];
      throw err;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // Listar kanaler
  getChannels() {
    return this.request('/');
  }
}

export const channelsApi = new TemplateApi('/api/channels');
