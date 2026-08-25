// Organization API — shared account (tenant) identity for Settings → Account profile.

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
  swishNumber: string;
  /** 'yes' | 'no' — approved for F-tax (Swedish invoicing). */
  fTax: string;
  /** Default late-payment interest percent shown on invoices (e.g. "12"). */
  latePaymentInterest: string;
}

export interface OrganizationProfile {
  name: string;
  logoUrl: string;
  website: string;
  email: string;
  phone: string;
  address: OrganizationAddress;
  billing: OrganizationBilling;
}

export const EMPTY_ORGANIZATION: OrganizationProfile = Object.freeze({
  name: '',
  logoUrl: '',
  website: '',
  email: '',
  phone: '',
  address: Object.freeze({
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: '',
  }),
  billing: Object.freeze({
    organizationNumber: '',
    vatNumber: '',
    bankgiro: '',
    plusgiro: '',
    iban: '',
    bic: '',
    invoiceEmail: '',
    swishNumber: '',
    fTax: 'yes',
    latePaymentInterest: '12',
  }),
}) as OrganizationProfile;

function asFTax(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'no' || raw === 'false' || raw === '0') {
    return 'no';
  }
  return 'yes';
}

function asLatePaymentInterest(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.min(100, Math.max(0, value)));
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return '12';
  }
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n)) {
    return '12';
  }
  return String(Math.min(100, Math.max(0, n)));
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Deep-clone + normalize organization payloads from API or form state.
 * Fills missing nested address/billing fields and migrates legacy billing.phone.
 */
export function normalizeOrganizationProfile(raw: unknown): OrganizationProfile {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const addressRaw =
    source.address && typeof source.address === 'object' && !Array.isArray(source.address)
      ? (source.address as Record<string, unknown>)
      : {};
  const billingRaw =
    source.billing && typeof source.billing === 'object' && !Array.isArray(source.billing)
      ? (source.billing as Record<string, unknown>)
      : {};

  return {
    name: asString(source.name),
    logoUrl: asString(source.logoUrl),
    website: asString(source.website),
    email: asString(source.email),
    phone: asString(source.phone) || asString(billingRaw.phone),
    address: {
      line1: asString(addressRaw.line1),
      line2: asString(addressRaw.line2),
      postalCode: asString(addressRaw.postalCode),
      city: asString(addressRaw.city),
      country: asString(addressRaw.country),
    },
    billing: {
      organizationNumber: asString(billingRaw.organizationNumber),
      vatNumber: asString(billingRaw.vatNumber),
      bankgiro: asString(billingRaw.bankgiro),
      plusgiro: asString(billingRaw.plusgiro),
      iban: asString(billingRaw.iban),
      bic: asString(billingRaw.bic),
      invoiceEmail: asString(billingRaw.invoiceEmail),
      swishNumber: asString(billingRaw.swishNumber),
      fTax: asFTax(billingRaw.fTax),
      latePaymentInterest: asLatePaymentInterest(billingRaw.latePaymentInterest),
    },
  };
}

/** Alias used by forms/context for explicit clone semantics. */
export function cloneOrganizationProfile(
  value: OrganizationProfile | unknown,
): OrganizationProfile {
  return normalizeOrganizationProfile(value);
}

export type SidebarOrganizationLines = {
  orgNumber: string;
  addressLines: string[];
  websiteHref: string | null;
  websiteLabel: string;
  email: string;
  swish: string;
  hasContent: boolean;
};

function formatWebsiteHref(raw: string): string | null {
  if (!raw) {
    return null;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function formatWebsiteLabel(raw: string): string {
  return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** Pure mapping used by sidebar footer (and covered by unit tests). */
export function getSidebarOrganizationLines(
  profile: OrganizationProfile | unknown,
): SidebarOrganizationLines {
  const org = normalizeOrganizationProfile(profile);
  const addressLines = [
    org.address.line1,
    org.address.line2,
    [org.address.postalCode, org.address.city].filter(Boolean).join(' '),
    org.address.country,
  ].filter(Boolean);

  const websiteHref = formatWebsiteHref(org.website);
  const websiteLabel = websiteHref ? formatWebsiteLabel(org.website) : '';
  const orgNumber = org.billing.organizationNumber;
  const email = org.email;
  const swish = org.billing.swishNumber;

  return {
    orgNumber,
    addressLines,
    websiteHref,
    websiteLabel,
    email,
    swish,
    hasContent: Boolean(orgNumber || addressLines.length || websiteHref || email || swish),
  };
}

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
    return normalizeOrganizationProfile(data.organization);
  }

  async updateOrganization(organization: OrganizationProfile): Promise<OrganizationProfile> {
    const data = await this.request<{ organization: OrganizationProfile }>('/api/organization', {
      method: 'PUT',
      body: JSON.stringify({ organization: normalizeOrganizationProfile(organization) }),
    });
    return normalizeOrganizationProfile(data.organization);
  }
}

export const organizationApi = new OrganizationApi();
