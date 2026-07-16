import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';
import i18n from '@/i18n';

import type {
  Guide,
  GuideAudio,
  GuidePayload,
  GuideStop,
  GuideStopPayload,
  GuideVariantCreatePayload,
  GuideVariantPresentation,
  GuideVariantUpdatePayload,
  GuideValidationError,
  ProductionJob,
  ProductionJobDetail,
  StartProductionJobPayload,
} from '../types/guides';

const request = createApiClient('/guides');

type ApiError = ApiRequestError & { errors?: GuideValidationError[] };

function mapValidationDetails(err: ApiError): ApiError {
  if (Array.isArray(err.details)) {
    err.errors = err.details.map(
      (d: { path?: string; msg?: string; field?: string; message?: string }) => ({
        field: d.path ?? d.field ?? 'general',
        message: d.msg ?? d.message ?? i18n.t('guides.validation.invalidField'),
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

  getAudio(placeId: string, stopId: string, variantId: string) {
    return apiRequest<GuideAudio>(`/${placeId}/stops/${stopId}/variants/${variantId}/audio`);
  }

  async getAudioOrNull(placeId: string, stopId: string, variantId: string) {
    try {
      return await this.getAudio(placeId, stopId, variantId);
    } catch (err) {
      if ((err as ApiError).status === 404) {
        return null;
      }
      throw err;
    }
  }

  generateAudio(placeId: string, stopId: string, variantId: string) {
    return apiRequest<GuideAudio>(
      `/${placeId}/stops/${stopId}/variants/${variantId}/audio/generate`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  cancelAudio(placeId: string, stopId: string, variantId: string) {
    return apiRequest<GuideAudio>(
      `/${placeId}/stops/${stopId}/variants/${variantId}/audio/cancel`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  deleteAudio(placeId: string, stopId: string, variantId: string) {
    return apiRequest<{ id: string }>(`/${placeId}/stops/${stopId}/variants/${variantId}/audio`, {
      method: 'DELETE',
    });
  }

  getAudioPreviewUrl(placeId: string, stopId: string, variantId: string) {
    return `/api/guides/${placeId}/stops/${stopId}/variants/${variantId}/audio/preview`;
  }

  listProductionJobs(placeId: string) {
    return apiRequest<ProductionJob[]>(`/${placeId}/production-jobs`);
  }

  getProductionJob(placeId: string, jobId: string) {
    return apiRequest<ProductionJobDetail>(`/${placeId}/production-jobs/${jobId}`);
  }

  startProductionJob(placeId: string, payload: StartProductionJobPayload) {
    return apiRequest<ProductionJobDetail>(`/${placeId}/production-jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  approveProductionJobItem(placeId: string, jobId: string, itemId: string) {
    return apiRequest<ProductionJobDetail>(
      `/${placeId}/production-jobs/${jobId}/items/${itemId}/approve`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  rejectProductionJobItem(placeId: string, jobId: string, itemId: string, reason?: string) {
    return apiRequest<ProductionJobDetail>(
      `/${placeId}/production-jobs/${jobId}/items/${itemId}/reject`,
      { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
    );
  }

  regenerateProductionJobItem(placeId: string, jobId: string, itemId: string) {
    return apiRequest<ProductionJobDetail>(
      `/${placeId}/production-jobs/${jobId}/items/${itemId}/regenerate`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  approveProductionJobPhase(placeId: string, jobId: string, options: { continue?: boolean } = {}) {
    return apiRequest<ProductionJobDetail>(`/${placeId}/production-jobs/${jobId}/approve-phase`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  cancelProductionJob(placeId: string, jobId: string) {
    return apiRequest<ProductionJobDetail>(`/${placeId}/production-jobs/${jobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  retryProductionJob(placeId: string, jobId: string) {
    return apiRequest<ProductionJobDetail>(`/${placeId}/production-jobs/${jobId}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

export const guidesApi = new GuidesApi();
