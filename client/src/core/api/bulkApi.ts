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

/**
 * Generic bulk API helper
 * Provides standardized bulk operations for all plugins
 */
class BulkApi {
  private csrfToken: string | null = null;

  /**
   * Get CSRF token (cached)
   */
  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CSRF token fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });

        if (response.status === 401) {
          throw new Error('Session required. Please log in again.');
        } else if (response.status === 503) {
          throw new Error('CSRF protection not configured on server');
        } else {
          throw new Error(`Failed to get CSRF token: ${errorData.error || response.statusText}`);
        }
      }

      const data = await response.json();
      if (!data.csrfToken) {
        throw new Error('CSRF token not found in response');
      }

      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error: any) {
      console.error('CSRF token fetch failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get CSRF token');
    }
  }

  /**
   * Bulk delete items for a plugin
   * @param pluginName - Plugin name (e.g., 'files', 'contacts')
   * @param ids - Array of item IDs to delete
   * @returns Promise with delete result
   */
  async bulkDelete(pluginName: string, ids: string[]): Promise<BulkDeleteResponse> {
    // Validate input
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

    // Get CSRF token for mutation
    // CSRF temporarily disabled: const csrfToken = await this.getCsrfToken();

    try {
      const response = await fetch(`/api/${pluginName}/batch`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // CSRF temporarily disabled: 'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ ids: uniqueIds }),
      });

      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          // Response is not JSON
        }

        // Log detailed error for debugging
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
