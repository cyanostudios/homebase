import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type {
  Guide,
  GuidePayload,
  GuideStop,
  GuideStopPayload,
  GuideVariantCreatePayload,
  GuideVariantPresentation,
  GuideVariantUpdatePayload,
  GuideValidationError,
} from '../types/guides';

const request = createApiClient('/guides');

type ApiError = ApiRequestError & { errors?: GuideValidationError[] };

function mapValidationDetails(err: ApiError): ApiError {
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

class GuidesApi {
  getGuides() {
    return apiRequest<Guide[]>('');
  }

  getGuide(id: string) {
    return apiRequest<Guide>(`/${id}`);
  }

  createGuide(payload: GuidePayload) {
    return apiRequest<Guide>('', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateGuide(id: string, payload: GuidePayload) {
    return apiRequest<Guide>(`/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteGuide(id: string) {
    return apiRequest<{ deleted: boolean }>(`/${id}`, { method: 'DELETE' });
  }

  getStops(placeId: string) {
    return apiRequest<GuideStop[]>(`/${placeId}/stops`);
  }

  getStop(placeId: string, stopId: string) {
    return apiRequest<GuideStop>(`/${placeId}/stops/${stopId}`);
  }

  createStop(placeId: string, payload: GuideStopPayload) {
    return apiRequest<GuideStop>(`/${placeId}/stops`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateStop(placeId: string, stopId: string, payload: Partial<GuideStopPayload>) {
    return apiRequest<GuideStop>(`/${placeId}/stops/${stopId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteStop(placeId: string, stopId: string) {
    return apiRequest<{ deleted: boolean }>(`/${placeId}/stops/${stopId}`, {
      method: 'DELETE',
    });
  }

  reorderStops(placeId: string, stopIds: string[]) {
    return apiRequest<GuideStop[]>(`/${placeId}/stops/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ stopIds }),
    });
  }

  getVariants(placeId: string, stopId: string) {
    return apiRequest<GuideVariantPresentation[]>(`/${placeId}/stops/${stopId}/variants`);
  }

  getVariant(placeId: string, stopId: string, variantId: string) {
    return apiRequest<GuideVariantPresentation>(
      `/${placeId}/stops/${stopId}/variants/${variantId}`,
    );
  }

  createVariant(placeId: string, stopId: string, payload: GuideVariantCreatePayload) {
    return apiRequest<GuideVariantPresentation>(`/${placeId}/stops/${stopId}/variants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateVariant(
    placeId: string,
    stopId: string,
    variantId: string,
    payload: GuideVariantUpdatePayload,
  ) {
    return apiRequest<GuideVariantPresentation>(
      `/${placeId}/stops/${stopId}/variants/${variantId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
  }

  deleteVariant(placeId: string, stopId: string, variantId: string) {
    return apiRequest<{ deleted: boolean }>(`/${placeId}/stops/${stopId}/variants/${variantId}`, {
      method: 'DELETE',
    });
  }
}

export const guidesApi = new GuidesApi();
