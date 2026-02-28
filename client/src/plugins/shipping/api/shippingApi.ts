import type {
  BookPostnordResponse,
  LabelFormatMode,
  ShippingSender,
  ShippingServicePreset,
  ShippingSettings,
} from '../types/shipping';

class ShippingApi {
  private csrfToken: string | null = null;
  private basePath = '/api/shipping';

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await response.json();
    this.csrfToken = data.csrfToken ?? null;
    if (this.csrfToken == null) throw new Error('CSRF token not returned by server');
    return this.csrfToken;
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(((options.headers as Record<string, string>) || {}) as Record<string, string>),
    };
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers['X-CSRF-Token'] = await this.getCsrfToken();
    }

    const response = await fetch(`${this.basePath}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const err: any = new Error(payload?.error || payload?.message || response.statusText);
      err.status = response.status;
      err.details = payload?.details;
      throw err;
    }
    return payload ?? {};
  }

  async getSettings(): Promise<ShippingSettings | null> {
    return (await this.request('/settings')) as ShippingSettings | null;
  }

  async upsertSettings(data: Partial<ShippingSettings>): Promise<ShippingSettings> {
    return (await this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })) as ShippingSettings;
  }

  async listSenders(): Promise<ShippingSender[]> {
    return (await this.request('/senders')) as ShippingSender[];
  }

  async createSender(data: Partial<ShippingSender>): Promise<ShippingSender> {
    return (await this.request('/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    })) as ShippingSender;
  }

  async updateSender(id: string, data: Partial<ShippingSender>): Promise<ShippingSender> {
    return (await this.request(`/senders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })) as ShippingSender;
  }

  async deleteSender(id: string): Promise<void> {
    await this.request(`/senders/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async listServices(): Promise<ShippingServicePreset[]> {
    return (await this.request('/services')) as ShippingServicePreset[];
  }

  async createService(data: Partial<ShippingServicePreset>): Promise<ShippingServicePreset> {
    return (await this.request('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    })) as ShippingServicePreset;
  }

  async updateService(id: string, data: Partial<ShippingServicePreset>): Promise<ShippingServicePreset> {
    return (await this.request(`/services/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })) as ShippingServicePreset;
  }

  async deleteService(id: string): Promise<void> {
    await this.request(`/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async bookPostnord(payload: {
    orderIds: string[];
    senderId: string;
    serviceId: string;
    labelFormat?: LabelFormatMode;
    weightsKgByOrder: Record<string, number>;
  }): Promise<BookPostnordResponse> {
    return (await this.request('/postnord/book', {
      method: 'POST',
      body: JSON.stringify(payload),
    })) as BookPostnordResponse;
  }
}

export const shippingApi = new ShippingApi();
