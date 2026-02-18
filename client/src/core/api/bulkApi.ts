// client/src/core/api/bulkApi.ts
// Generic bulk API helper for all plugins

export interface BulkDeleteResponse {
  ok: true;
  requested: number;
  deleted: number;
  deletedIds: string[];
}

export interface BulkApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

class BulkApi {
  async bulkDelete(pluginName: string, ids: string[]): Promise<BulkDeleteResponse> {
    if (!Array.isArray(ids)) {
      throw new Error('ids must be an array');
    }
    const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return { ok: true, requested: 0, deleted: 0, deletedIds: [] };
    }
    const response = await fetch(`/api/${pluginName}/batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: uniqueIds }),
    });
    if (!response.ok) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        // ignore
      }
      const err: BulkApiError = new Error(
        payload?.error || payload?.message || response.statusText || 'Bulk delete failed',
      ) as BulkApiError;
      err.status = response.status;
      err.code = payload?.code;
      err.details = payload?.details;
      throw err;
    }
    const result = await response.json();
    return {
      ok: true,
      requested: result.requested ?? uniqueIds.length,
      deleted: result.deleted ?? result.deletedCount ?? 0,
      deletedIds: result.deletedIds ?? [],
    };
  }
}

export const bulkApi = new BulkApi();
