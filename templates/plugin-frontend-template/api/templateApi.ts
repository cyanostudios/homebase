import type { ValidationError, YourItem, YourItemPayload, YourItemsSettings } from '../types/your-items';

type ApiError = Error & {
  status?: number;
  code?: string;
  errors?: ValidationError[];
};

class TemplateApi {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/your-items${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        code?: string;
        errors?: ValidationError[];
      };
      const err: ApiError = new Error(payload.error ?? payload.message ?? 'Request failed');
      err.status = response.status;
      err.code = payload.code;
      err.errors = payload.errors;
      throw err;
    }

    return (await response.json()) as T;
  }

  getItems() {
    return this.request<YourItem[]>('');
  }

  createItem(payload: YourItemPayload) {
    return this.request<YourItem>('', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateItem(id: string, payload: YourItemPayload) {
    return this.request<YourItem>(`/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteItem(id: string) {
    return this.request<{ deleted: boolean }>(`/${id}`, { method: 'DELETE' });
  }

  getSettings() {
    return this.request<YourItemsSettings>('/settings');
  }

  saveSettings(payload: YourItemsSettings) {
    return this.request<YourItemsSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

export const templateApi = new TemplateApi();
