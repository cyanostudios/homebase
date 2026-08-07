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
}

export const clubdeskApi = new ClubdeskApi();
