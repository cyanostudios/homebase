// Organization API — shared account (tenant) identity for Settings → Profile.

import { apiFetch } from '@/core/api/apiFetch';

export interface OrganizationAddress {
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface OrganizationBilling {
  organizationNumber: string;
  vatNumber: string;
  bankgiro: string;
  plusgiro: string;
  iban: string;
  bic: string;
  invoiceEmail: string;
  phone: string;
}

export interface OrganizationProfile {
  name: string;
  logoUrl: string;
  website: string;
  email: string;
  address: OrganizationAddress;
  billing: OrganizationBilling;
}

export const EMPTY_ORGANIZATION: OrganizationProfile = {
  name: '',
  logoUrl: '',
  website: '',
  email: '',
  address: {
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: '',
  },
  billing: {
    organizationNumber: '',
    vatNumber: '',
    bankgiro: '',
    plusgiro: '',
    iban: '',
    bic: '',
    invoiceEmail: '',
    phone: '',
  },
};

class OrganizationApi {
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

  async getOrganization(): Promise<OrganizationProfile> {
    const data = await this.request<{ organization: OrganizationProfile }>('/api/organization', {
      method: 'GET',
    });
    return data.organization ?? { ...EMPTY_ORGANIZATION };
  }

  async updateOrganization(organization: OrganizationProfile): Promise<OrganizationProfile> {
    const data = await this.request<{ organization: OrganizationProfile }>('/api/organization', {
      method: 'PUT',
      body: JSON.stringify({ organization }),
    });
    return data.organization;
  }
}

export const organizationApi = new OrganizationApi();
