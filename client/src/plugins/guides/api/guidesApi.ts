import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';
import i18n from '@/i18n';

import type {
  Guide,
  GuidePayload,
  GuidePresentation,
  GuidePresentationUpdatePayload,
  GuideValidationError,
  ContentSourceSetting,
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

  getPresentations(placeId: string) {
    return apiRequest<GuidePresentation[]>(`/${placeId}/presentations`);
  }

  getPresentation(placeId: string, language: string) {
    return apiRequest<GuidePresentation>(
      `/${placeId}/presentations/${encodeURIComponent(language)}`,
    );
  }

  updatePresentation(placeId: string, language: string, payload: GuidePresentationUpdatePayload) {
    return apiRequest<GuidePresentation>(
      `/${placeId}/presentations/${encodeURIComponent(language)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
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

  getContentSources() {
    return apiRequest<{ sources: ContentSourceSetting[] }>('/content-sources');
  }

  updateContentSource(sourceKey: string, payload: { enabled: boolean }) {
    return apiRequest<ContentSourceSetting>(`/content-sources/${encodeURIComponent(sourceKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

export const guidesApi = new GuidesApi();
