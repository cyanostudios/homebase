// Default texts API — shared account mail body defaults for Settings → Default texts.

import { apiFetch } from '@/core/api/apiFetch';

export interface DefaultTexts {
  invoiceMail: string;
  estimateMail: string;
}

export const EMPTY_DEFAULT_TEXTS: DefaultTexts = Object.freeze({
  invoiceMail: '',
  estimateMail: '',
}) as DefaultTexts;

const MAX_MAIL_TEXT = 8000;

function asMailText(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.length > MAX_MAIL_TEXT ? raw.slice(0, MAX_MAIL_TEXT) : raw;
}

/** Normalize default texts payloads from API or form state. */
export function normalizeDefaultTexts(raw: unknown): DefaultTexts {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    invoiceMail: asMailText(source.invoiceMail),
    estimateMail: asMailText(source.estimateMail),
  };
}

/** Alias used by forms/context for explicit clone semantics. */
export function cloneDefaultTexts(value: DefaultTexts | unknown): DefaultTexts {
  return normalizeDefaultTexts(value);
}

class DefaultTextsApi {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await apiFetch(endpoint, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getDefaultTexts(): Promise<DefaultTexts> {
    const data = await this.request<{ defaultTexts: DefaultTexts }>('/api/default-texts', {
      method: 'GET',
    });
    return normalizeDefaultTexts(data.defaultTexts);
  }

  async updateDefaultTexts(defaultTexts: DefaultTexts): Promise<DefaultTexts> {
    const data = await this.request<{ defaultTexts: DefaultTexts }>('/api/default-texts', {
      method: 'PUT',
      body: JSON.stringify({ defaultTexts: normalizeDefaultTexts(defaultTexts) }),
    });
    return normalizeDefaultTexts(data.defaultTexts);
  }
}

export const defaultTextsApi = new DefaultTextsApi();
