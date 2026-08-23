import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type {
  CreateGarmentShareRequest,
  GarmentList,
  GarmentListPayload,
  GarmentPerson,
  GarmentPersonPayload,
  GarmentShare,
  InventoryItem,
  InventoryItemPayload,
  InventoryVariant,
  PublicGarmentList,
  ValidationError,
} from '../types/garments';

const request = createApiClient('/garments');

type ApiError = ApiRequestError & { errors?: ValidationError[] };

function mapValidationDetails(err: ApiError): ApiError {
  if (Array.isArray(err.details)) {
    err.errors = err.details.map(
      (d: { path?: string; msg?: string; field?: string; message?: string }) => ({
        field: d.path ?? d.field ?? 'general',
        message: d.msg ?? d.message ?? 'Invalid',
      }),
    );
  } else if (err.status === 409 && !err.errors?.length) {
    err.errors = [
      {
        field: 'articleName',
        message: err.message || 'An inventory item with this article and brand already exists',
      },
    ];
  }
  return err;
}

function mapShareDates(share: {
  id: string;
  listId: string;
  shareToken: string;
  validUntil: string;
  createdAt: string;
  accessedCount: number;
  lastAccessedAt?: string;
}): GarmentShare {
  return {
    id: share.id,
    listId: share.listId,
    shareToken: share.shareToken,
    accessedCount: share.accessedCount,
    validUntil: new Date(share.validUntil),
    createdAt: new Date(share.createdAt),
    lastAccessedAt: share.lastAccessedAt ? new Date(share.lastAccessedAt) : undefined,
  };
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return (await request(path, options)) as T;
  } catch (err) {
    throw mapValidationDetails(err as ApiError);
  }
}

class GarmentsApi {
  getLists(teamId?: string | null) {
    const qs =
      teamId != null && String(teamId).trim() !== ''
        ? `?team_id=${encodeURIComponent(String(teamId))}`
        : '';
    return apiRequest<GarmentList[]>(`/lists${qs}`);
  }

  getList(id: string) {
    return apiRequest<GarmentList>(`/lists/${id}`);
  }

  createList(payload: GarmentListPayload) {
    return apiRequest<GarmentList>('/lists', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateList(id: string, payload: GarmentListPayload) {
    return apiRequest<GarmentList>(`/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteList(id: string) {
    return apiRequest<{ deleted: boolean }>(`/lists/${id}`, { method: 'DELETE' });
  }

  getPersons(listId: string) {
    return apiRequest<GarmentPerson[]>(`/lists/${listId}/persons`);
  }

  createPerson(listId: string, payload: GarmentPersonPayload) {
    return apiRequest<GarmentPerson>(`/lists/${listId}/persons`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updatePerson(listId: string, personId: string, payload: GarmentPersonPayload) {
    return apiRequest<GarmentPerson>(`/lists/${listId}/persons/${personId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deletePerson(listId: string, personId: string) {
    return apiRequest<{ deleted: boolean }>(`/lists/${listId}/persons/${personId}`, {
      method: 'DELETE',
    });
  }

  createShare(req: CreateGarmentShareRequest): Promise<GarmentShare> {
    return apiRequest<{
      id: string;
      listId: string;
      shareToken: string;
      validUntil: string;
      createdAt: string;
      accessedCount: number;
      lastAccessedAt?: string;
    }>(`/shares`, {
      method: 'POST',
      body: JSON.stringify({
        listId: req.listId,
        validUntil: req.validUntil.toISOString(),
      }),
    }).then(mapShareDates);
  }

  getShares(listId: string): Promise<GarmentShare[]> {
    return apiRequest<
      Array<{
        id: string;
        listId: string;
        shareToken: string;
        validUntil: string;
        createdAt: string;
        accessedCount: number;
        lastAccessedAt?: string;
      }>
    >(`/lists/${listId}/shares`).then((shares) => shares.map(mapShareDates));
  }

  revokeShare(shareId: string) {
    return apiRequest<{ message: string }>(`/shares/${shareId}`, { method: 'DELETE' });
  }

  getPublicList(token: string) {
    return apiRequest<PublicGarmentList>(`/public/${token}`);
  }

  getInventory() {
    return apiRequest<InventoryItem[]>('/inventory');
  }

  createInventoryItem(payload: InventoryItemPayload) {
    return apiRequest<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateInventoryItem(id: string, payload: InventoryItemPayload) {
    return apiRequest<InventoryItem>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteInventoryItem(id: string) {
    return apiRequest<{ deleted: boolean }>(`/inventory/${id}`, { method: 'DELETE' });
  }

  updateInventoryVariantQuantity(itemId: string, variantId: string, quantity: number) {
    return apiRequest<InventoryVariant>(`/inventory/${itemId}/variants/${variantId}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }
}

export const garmentsApi = new GarmentsApi();

export const garmentShareApi = {
  createShare(request: CreateGarmentShareRequest) {
    return garmentsApi.createShare(request);
  },
  getShares(listId: string) {
    return garmentsApi.getShares(listId);
  },
  revokeShare(shareId: string) {
    return garmentsApi.revokeShare(shareId);
  },
  getPublicList(token: string) {
    return garmentsApi.getPublicList(token);
  },
  generateShareUrl(token: string): string {
    return `${window.location.origin}/public/garment-list/${token}`;
  },
};
