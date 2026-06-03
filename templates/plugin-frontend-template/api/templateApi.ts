import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type { ValidationError, YourItem, YourItemPayload, YourItemsSettings } from '../types/your-items';

const request = createApiClient('/your-items');

type ApiError = ApiRequestError & { errors?: ValidationError[] };

function mapValidationDetails(err: ApiError): ApiError {
  if (Array.isArray(err.details)) {
    err.errors = err.details.map((d: { path?: string; msg?: string; field?: string; message?: string }) => ({
      field: d.path ?? d.field ?? 'general',
      message: d.msg ?? d.message ?? 'Invalid',
    }));
  }
  return err;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return (await request(path, options)) as T;
  } catch (err) {
    throw mapValidationDetails(err as ApiError);
  }
}

class TemplateApi {
  getItems() {
    return apiRequest<YourItem[]>('');
  }

  createItem(payload: YourItemPayload) {
    return apiRequest<YourItem>('', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateItem(id: string, payload: YourItemPayload) {
    return apiRequest<YourItem>(`/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteItem(id: string) {
    return apiRequest<{ deleted: boolean }>(`/${id}`, { method: 'DELETE' });
  }

  getSettings() {
    return apiRequest<YourItemsSettings>('/settings');
  }

  saveSettings(payload: YourItemsSettings) {
    return apiRequest<YourItemsSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

export const templateApi = new TemplateApi();
