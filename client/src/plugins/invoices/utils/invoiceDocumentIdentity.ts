/** Derive display name from email local-part (users have no name column). */
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return '';
  }
  const local = trimmed.split('@')[0] || '';
  const name = local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return name || trimmed;
}

/** Customer block for Facio invoice documents (mirrors server `loadCustomerForInvoice`). */
export type InvoiceCustomerBlock = {
  name: string;
  organizationNumber: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  /** First contact person name on the linked contact card (kundreferens). */
  reference: string;
  /** Contact card number (kundnummer). */
  customerNumber: string;
};

type ContactLike = {
  id?: string | number;
  companyName?: string;
  organizationNumber?: string;
  contactNumber?: string | number;
  addresses?: unknown;
  contactPersons?: unknown;
} | null;

function pickContactAddress(addresses: unknown): {
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
} | null {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return null;
  }
  const preferred =
    addresses.find((a) => /billing|faktura|invoice/i.test(String(a?.type || ''))) ||
    addresses.find((a) => /main|huvud|office/i.test(String(a?.type || ''))) ||
    addresses[0];
  if (!preferred || typeof preferred !== 'object') {
    return null;
  }
  const row = preferred as Record<string, unknown>;
  return {
    line1: String(row.addressLine1 || row.line1 || ''),
    line2: String(row.addressLine2 || row.line2 || ''),
    postalCode: String(row.postalCode || ''),
    city: String(row.city || ''),
    country: String(row.country || ''),
  };
}

/** First non-empty contact person name on a contact card. */
function pickFirstContactPersonName(contactPersons: unknown): string {
  if (!Array.isArray(contactPersons) || contactPersons.length === 0) {
    return '';
  }
  for (const person of contactPersons) {
    if (!person || typeof person !== 'object') {
      continue;
    }
    const name = String((person as Record<string, unknown>).name || '').trim();
    if (name) {
      return name;
    }
  }
  return '';
}

/**
 * Resolve customer name + address for invoice preview/PDF-style HTML.
 * Prefers linked contact addresses (billing → main → first).
 * Kundreferens = first contact person name on the contact card.
 */
export function buildInvoiceCustomerBlock(input: {
  contactName?: string | null;
  organizationNumber?: string | null;
  contactId?: string | number | null;
  contact?: ContactLike;
}): InvoiceCustomerBlock {
  const contact = input.contact;
  const addr = pickContactAddress(contact?.addresses) || {
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: '',
  };

  return {
    name: String(contact?.companyName || input.contactName || '').trim(),
    organizationNumber: String(
      contact?.organizationNumber || input.organizationNumber || '',
    ).trim(),
    line1: addr.line1.trim(),
    line2: addr.line2.trim(),
    postalCode: addr.postalCode.trim(),
    city: addr.city.trim(),
    country: addr.country.trim(),
    reference: pickFirstContactPersonName(contact?.contactPersons),
    customerNumber: String(contact?.contactNumber ?? '').trim(),
  };
}

/** Embed image URL as data URI so iframe srcDoc can render logos. */
export async function fetchLogoAsDataUrl(logoUrl: string): Promise<string> {
  const url = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  if (!url) {
    return '';
  }
  if (url.startsWith('data:')) {
    return url;
  }
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      return url;
    }
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && !url.match(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i)) {
      return url;
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}
