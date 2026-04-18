// client/src/core/api/bulkApi.ts
// Generic bulk API helper for all plugins

import { apiFetch } from '@/core/api/apiFetch';

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

/**
 * Generic bulk API helper
 * Provides standardized bulk operations for all plugins
 */
class BulkApi {
  async bulkDelete(pluginName: string, ids: string[]): Promise<BulkDeleteResponse> {
    if (!Array.isArray(ids)) {
      throw new Error('ids must be an array');
    }

    const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));

    if (uniqueIds.length === 0) {
      return {
        ok: true,
        requested: 0,
        deleted: 0,
        deletedIds: [],
      };
    }

    try {
      const response = await apiFetch(`/api/${pluginName}/batch`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: uniqueIds }),
      });

      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          // Response is not JSON
        }

        console.error('Bulk delete API error:', {
          status: response.status,
          statusText: response.statusText,
          payload,
          requestBody: { ids: uniqueIds },
        });

        const errorMessage =
          payload?.error || payload?.message || response.statusText || 'Bulk delete failed';
        const errorCode = payload?.code;

        const err: BulkApiError = new Error(errorMessage) as BulkApiError;
        err.status = response.status;
        err.code = errorCode;
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
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      if (error instanceof Error && 'status' in error) {
        throw error;
      }
      throw new Error(error?.message || 'Bulk delete failed');
    }
  }
}

export const bulkApi = new BulkApi();
