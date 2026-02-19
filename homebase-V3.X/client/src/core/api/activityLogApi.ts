// Activity Log API - Fetch activity logs

export interface ActivityLogEntry {
  id: number;
  userId: number;
  action: 'create' | 'update' | 'delete' | 'export' | 'settings';
  entityType: 'contact' | 'note' | 'task' | 'estimate' | 'invoice' | 'file' | 'settings';
  entityId: number | null;
  entityName: string | null;
  metadata: {
    ip?: string;
    userAgent?: string;
    exportFormat?: string;
    [key: string]: any;
  };
  createdAt: string;
}

export interface ActivityLogParams {
  limit?: number;
  offset?: number;
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export interface ActivityLogResponse {
  logs: ActivityLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

class ActivityLogApi {
  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get activity logs with filtering and pagination
   */
  async getActivityLogs(params: ActivityLogParams = {}): Promise<ActivityLogResponse> {
    const queryParams = new URLSearchParams();

    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }
    if (params.entityType) {
      queryParams.append('entity_type', params.entityType);
    }
    if (params.action) {
      queryParams.append('action', params.action);
    }
    if (params.startDate) {
      queryParams.append('start_date', params.startDate);
    }
    if (params.endDate) {
      queryParams.append('end_date', params.endDate);
    }

    const queryString = queryParams.toString();
    const endpoint = `/api/settings/activity-log${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint, {
      method: 'GET',
    });
  }
}

export const activityLogApi = new ActivityLogApi();
