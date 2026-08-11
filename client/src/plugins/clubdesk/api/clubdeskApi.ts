import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type {
  Clubdesk,
  ClubdeskCategory,
  ClubdeskPayload,
  ValidationError,
} from '../types/clubdesk';
import type {
  ClubdeskPriceList,
  ClubdeskPriceListItemCategory,
  ClubdeskPriceListPayload,
} from '../types/priceList';
import type {
  ClubdeskSiteCardKey,
  ClubdeskSiteContentCard,
  ClubdeskSiteContentMap,
} from '../types/siteContent';
import type { ClubdeskSwishProfile, ClubdeskSwishProfilePayload } from '../types/swishProfile';
import type { ClubdeskInfoContact, ClubdeskInfoContactPayload } from '../types/infoContact';

const request = createApiClient('/clubdesk');

type ApiError = ApiRequestError & { errors?: ValidationError[] };

function mapValidationDetails(err: ApiError): ApiError {
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return err;
  }
  if (Array.isArray(err.details)) {
    err.errors = err.details.map(
      (d: { path?: string; msg?: string; field?: string; message?: string }) => ({
        field: d.path ?? d.field ?? 'general',
        message: d.msg ?? d.message ?? 'Invalid',
      }),
    );
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

function normalizeClubdesk(row: Clubdesk): Clubdesk {
  return {
    ...row,
    id: String(row.id),
    steps: Array.isArray(row.steps)
      ? row.steps.map((step, index) => ({
          ...step,
          id: step.id != null ? String(step.id) : undefined,
          sequenceOrder: step.sequenceOrder ?? index + 1,
          description: step.description ?? null,
          imageUrl: step.imageUrl ?? null,
        }))
      : row.steps,
  };
}

function normalizeCategory(row: ClubdeskCategory): ClubdeskCategory {
  return {
    ...row,
    id: String(row.id),
    name: row.name ?? '',
    sortOrder: row.sortOrder ?? 1,
  };
}

function normalizePriceList(row: ClubdeskPriceList): ClubdeskPriceList {
  return {
    ...row,
    id: String(row.id),
    currency: row.currency || 'SEK',
    items: Array.isArray(row.items)
      ? row.items.map((item, index) => ({
          ...item,
          id: item.id != null ? String(item.id) : undefined,
          priceListId: item.priceListId != null ? String(item.priceListId) : undefined,
          sequenceOrder: item.sequenceOrder ?? index + 1,
          description: item.description ?? null,
          price: Number(item.price) || 0,
          category: item.category ?? null,
        }))
      : row.items,
  };
}

function normalizePriceListCategory(
  row: ClubdeskPriceListItemCategory,
): ClubdeskPriceListItemCategory {
  return {
    ...row,
    id: String(row.id),
    name: row.name ?? '',
    sortOrder: row.sortOrder ?? 1,
  };
}

class ClubdeskApi {
  async getClubdesks(): Promise<Clubdesk[]> {
    const rows = await apiRequest<Clubdesk[]>('');
    return (rows || []).map(normalizeClubdesk);
  }

  async getClubdesk(id: string): Promise<Clubdesk> {
    const row = await apiRequest<Clubdesk>(`/${id}`);
    return normalizeClubdesk(row);
  }

  createClubdesk(payload: ClubdeskPayload) {
    return apiRequest<Clubdesk>('', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeClubdesk);
  }

  updateClubdesk(id: string, payload: ClubdeskPayload) {
    return apiRequest<Clubdesk>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then(normalizeClubdesk);
  }

  deleteClubdesk(id: string) {
    return apiRequest<{ deleted: boolean }>(`/${id}`, { method: 'DELETE' });
  }

  deleteClubdesksBatch(ids: string[]) {
    return apiRequest<{ deleted: number }>('/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids: ids.map((id) => Number(id) || id) }),
    });
  }

  reorderClubdesks(category: string | null, orderedIds: string[]) {
    return apiRequest<Clubdesk[]>('/reorder', {
      method: 'PUT',
      body: JSON.stringify({ category, orderedIds }),
    }).then((rows) => (rows || []).map(normalizeClubdesk));
  }

  async getCategories(): Promise<ClubdeskCategory[]> {
    const rows = await apiRequest<ClubdeskCategory[]>('/categories');
    return (rows || []).map(normalizeCategory);
  }

  createCategory(name: string) {
    return apiRequest<ClubdeskCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then(normalizeCategory);
  }

  reorderCategories(orderedIds: string[]) {
    return apiRequest<ClubdeskCategory[]>('/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }).then((rows) => (rows || []).map(normalizeCategory));
  }

  deleteCategory(id: string, options?: { moveToCategory: string | null }) {
    const body =
      options && Object.prototype.hasOwnProperty.call(options, 'moveToCategory')
        ? JSON.stringify({ moveToCategory: options.moveToCategory })
        : undefined;
    return apiRequest<{
      message: string;
      id: string;
      movedItemCount?: number;
      moveToCategory?: string | null;
    }>(`/categories/${id}`, {
      method: 'DELETE',
      ...(body ? { body } : {}),
    });
  }

  async getPriceLists(): Promise<ClubdeskPriceList[]> {
    const rows = await apiRequest<ClubdeskPriceList[]>('/price-lists');
    return (rows || []).map(normalizePriceList);
  }

  async getPriceList(id: string): Promise<ClubdeskPriceList> {
    const row = await apiRequest<ClubdeskPriceList>(`/price-lists/${id}`);
    return normalizePriceList(row);
  }

  createPriceList(payload: ClubdeskPriceListPayload) {
    return apiRequest<ClubdeskPriceList>('/price-lists', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizePriceList);
  }

  updatePriceList(id: string, payload: ClubdeskPriceListPayload) {
    return apiRequest<ClubdeskPriceList>(`/price-lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then(normalizePriceList);
  }

  deletePriceList(id: string) {
    return apiRequest<{ deleted: boolean }>(`/price-lists/${id}`, { method: 'DELETE' });
  }

  deletePriceListsBatch(ids: string[]) {
    return apiRequest<{ deleted: number }>('/price-lists/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids: ids.map((id) => Number(id) || id) }),
    });
  }

  reorderPriceLists(orderedIds: string[]) {
    return apiRequest<ClubdeskPriceList[]>('/price-lists/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }).then((rows) => (rows || []).map(normalizePriceList));
  }

  async getPriceListCategories(priceListId: string): Promise<ClubdeskPriceListItemCategory[]> {
    const rows = await apiRequest<ClubdeskPriceListItemCategory[]>(
      `/price-lists/${priceListId}/categories`,
    );
    return (rows || []).map(normalizePriceListCategory);
  }

  createPriceListCategory(priceListId: string, name: string) {
    return apiRequest<ClubdeskPriceListItemCategory>(`/price-lists/${priceListId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then(normalizePriceListCategory);
  }

  reorderPriceListCategories(priceListId: string, orderedIds: string[]) {
    return apiRequest<ClubdeskPriceListItemCategory[]>(
      `/price-lists/${priceListId}/categories/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      },
    ).then((rows) => (rows || []).map(normalizePriceListCategory));
  }

  deletePriceListCategory(
    priceListId: string,
    categoryId: string,
    options?: { moveToCategory: string | null },
  ) {
    const body =
      options && Object.prototype.hasOwnProperty.call(options, 'moveToCategory')
        ? JSON.stringify({ moveToCategory: options.moveToCategory })
        : undefined;
    return apiRequest<{
      message: string;
      id: string;
      movedItemCount?: number;
      moveToCategory?: string | null;
    }>(`/price-lists/${priceListId}/categories/${categoryId}`, {
      method: 'DELETE',
      ...(body ? { body } : {}),
    });
  }

  reorderPriceListItems(priceListId: string, category: string | null, orderedIds: string[]) {
    return apiRequest<ClubdeskPriceList>(`/price-lists/${priceListId}/items/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ category, orderedIds }),
    }).then(normalizePriceList);
  }

  async getSiteContent(): Promise<ClubdeskSiteContentMap> {
    const rows = await apiRequest<ClubdeskSiteContentMap>('/site-content');
    return normalizeSiteContentMap(rows);
  }

  saveSiteContent(
    cards: Array<{ cardKey: ClubdeskSiteCardKey; content: string; meta?: Record<string, unknown> }>,
  ): Promise<ClubdeskSiteContentMap> {
    return apiRequest<ClubdeskSiteContentMap>('/site-content', {
      method: 'PUT',
      body: JSON.stringify({ cards }),
    }).then(normalizeSiteContentMap);
  }

  async getSwishProfiles(): Promise<ClubdeskSwishProfile[]> {
    const rows = await apiRequest<ClubdeskSwishProfile[]>('/swish-profiles');
    return (rows || []).map(normalizeSwishProfile);
  }

  async getSwishProfile(id: string): Promise<ClubdeskSwishProfile> {
    const row = await apiRequest<ClubdeskSwishProfile>(`/swish-profiles/${id}`);
    return normalizeSwishProfile(row);
  }

  createSwishProfile(payload: ClubdeskSwishProfilePayload) {
    return apiRequest<ClubdeskSwishProfile>('/swish-profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(normalizeSwishProfile);
  }

  updateSwishProfile(id: string, payload: Partial<ClubdeskSwishProfilePayload>) {
    return apiRequest<ClubdeskSwishProfile>(`/swish-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then(normalizeSwishProfile);
  }

  deleteSwishProfile(id: string) {
    return apiRequest<{ id: string }>(`/swish-profiles/${id}`, { method: 'DELETE' });
  }

  async getInfoContacts(): Promise<ClubdeskInfoContact[]> {
    const rows = await apiRequest<ClubdeskInfoContact[]>('/info-contacts');
    return (rows || []).map(normalizeInfoContact);
  }

  createInfoContact(payload: ClubdeskInfoContactPayload) {
    return apiRequest<ClubdeskInfoContact>('/info-contacts', {
      method: 'POST',
      body: JSON.stringify({
        contactId: Number(payload.contactId),
        blurb: payload.blurb ?? '',
      }),
    }).then(normalizeInfoContact);
  }

  updateInfoContact(id: string, payload: Partial<ClubdeskInfoContactPayload>) {
    const body: Record<string, unknown> = {};
    if (payload.contactId !== undefined) body.contactId = Number(payload.contactId);
    if (payload.blurb !== undefined) body.blurb = payload.blurb;
    return apiRequest<ClubdeskInfoContact>(`/info-contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }).then(normalizeInfoContact);
  }

  deleteInfoContact(id: string) {
    return apiRequest<{ id: string }>(`/info-contacts/${id}`, { method: 'DELETE' });
  }

  reorderInfoContacts(orderedIds: string[]) {
    return apiRequest<ClubdeskInfoContact[]>('/info-contacts/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: orderedIds.map((id) => Number(id)) }),
    }).then((rows) => (rows || []).map(normalizeInfoContact));
  }
}

function emptySiteCard(cardKey: ClubdeskSiteCardKey): ClubdeskSiteContentCard {
  return { cardKey, content: '', meta: {}, updatedAt: null };
}

function normalizeSiteCard(
  cardKey: ClubdeskSiteCardKey,
  row?: Partial<ClubdeskSiteContentCard> | null,
): ClubdeskSiteContentCard {
  return {
    cardKey,
    content: row?.content ?? '',
    meta: row?.meta && typeof row.meta === 'object' && !Array.isArray(row.meta) ? row.meta : {},
    updatedAt: row?.updatedAt ?? null,
  };
}

function normalizeSiteContentMap(
  rows?: Partial<ClubdeskSiteContentMap> | null,
): ClubdeskSiteContentMap {
  return {
    home: normalizeSiteCard('home', rows?.home),
    info: normalizeSiteCard('info', rows?.info),
    swish: normalizeSiteCard('swish', rows?.swish ?? emptySiteCard('swish')),
  };
}

function normalizeSwishProfile(row: ClubdeskSwishProfile): ClubdeskSwishProfile {
  return {
    id: String(row.id),
    payee: row.payee ?? '',
    message: row.message ?? '',
    sortOrder: Number(row.sortOrder) || 1,
    priceListIds: Array.isArray(row.priceListIds) ? row.priceListIds.map((id) => String(id)) : [],
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function normalizeInfoContact(row: ClubdeskInfoContact): ClubdeskInfoContact {
  const contact = row.contact || ({} as ClubdeskInfoContact['contact']);
  return {
    id: String(row.id),
    contactId: String(row.contactId),
    blurb: row.blurb ?? '',
    sortOrder: Number(row.sortOrder) || 1,
    contact: {
      id: String(contact.id || row.contactId),
      companyName: contact.companyName ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      displayName: contact.displayName || contact.companyName || `Kontakt ${row.contactId}`,
    },
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export const clubdeskApi = new ClubdeskApi();
