import { createApiClient, type ApiRequestError } from '@/core/api/createApiClient';

import type {
  SiteAudit,
  SiteAuditPayload,
  SiteAuditRun,
  StartSiteAuditRunOptions,
  StartSiteAuditRunResponse,
  ValidationError,
} from '../types/site-audits';

const request = createApiClient('/site-audits');

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

class SiteAuditsApi {
  getSiteAudits() {
    return apiRequest<SiteAudit[]>('');
  }

  createSiteAudit(payload: SiteAuditPayload) {
    return apiRequest<SiteAudit>('', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateSiteAudit(id: string, payload: SiteAuditPayload) {
    return apiRequest<SiteAudit>(`/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteSiteAudit(id: string) {
    return apiRequest<{ message: string }>(`/${id}`, { method: 'DELETE' });
  }

  deleteSiteAuditsBatch(ids: string[]) {
    return apiRequest<{ ok: boolean; requested: number; deleted: number; deletedIds: string[] }>(
      '/batch',
      {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      },
    );
  }

  startRun(id: string, options: StartSiteAuditRunOptions = {}) {
    const mode = options.mode === 'quick' ? 'quick' : undefined;
    return apiRequest<StartSiteAuditRunResponse>(`/${id}/runs`, {
      method: 'POST',
      body: JSON.stringify(mode ? { mode } : {}),
    });
  }

  getRuns(id: string, limit?: number) {
    const query = typeof limit === 'number' ? `?limit=${limit}` : '';
    return apiRequest<SiteAuditRun[]>(`/${id}/runs${query}`);
  }

  getRun(id: string, runId: string) {
    return apiRequest<SiteAuditRun>(`/${id}/runs/${runId}`);
  }

  cancelRun(id: string, runId: string) {
    return apiRequest<{ run: SiteAuditRun; cancelled: boolean; runs: SiteAuditRun[] }>(
      `/${id}/runs/${runId}/cancel`,
      { method: 'POST' },
    );
  }
}

export const siteAuditsApi = new SiteAuditsApi();
