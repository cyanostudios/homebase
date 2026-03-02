import type {
  AnalyticsChannelItem,
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsTimeSeriesItem,
  AnalyticsTopProductItem,
  AnalyticsDrilldownOrderItem,
} from '../types/analytics';

class AnalyticsApi {
  private basePath = '/api/analytics';

  private async request(path: string) {
    let response: Response;
    try {
      response = await fetch(`${this.basePath}${path}`, {
        credentials: 'include',
      });
    } catch {
      const err: any = new Error('Network unreachable');
      err.status = 0;
      throw err;
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const err: any = new Error(payload?.error || payload?.message || response.statusText);
      err.status = response.status;
      throw err;
    }

    return payload ?? {};
  }

  private toQueryString(filters: AnalyticsFilters) {
    const qs = new URLSearchParams();
    if (filters.from) {
      qs.set('from', filters.from);
    }
    if (filters.to) {
      qs.set('to', filters.to);
    }
    if (filters.status) {
      qs.set('status', filters.status);
    }
    if (filters.channel) {
      qs.set('channel', filters.channel);
    }
    if (filters.channelInstanceId !== null && filters.channelInstanceId !== undefined) {
      qs.set('channelInstanceId', String(filters.channelInstanceId));
    }
    if (filters.granularity) {
      qs.set('granularity', filters.granularity);
    }
    const raw = qs.toString();
    return raw ? `?${raw}` : '';
  }

  async getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
    return (await this.request(`/overview${this.toQueryString(filters)}`)) as AnalyticsOverview;
  }

  async getTimeSeries(filters: AnalyticsFilters): Promise<AnalyticsTimeSeriesItem[]> {
    const data = (await this.request(`/timeseries${this.toQueryString(filters)}`)) as {
      items?: AnalyticsTimeSeriesItem[];
    };
    return Array.isArray(data.items) ? data.items : [];
  }

  async getChannels(filters: AnalyticsFilters): Promise<AnalyticsChannelItem[]> {
    const data = (await this.request(`/channels${this.toQueryString(filters)}`)) as {
      items?: AnalyticsChannelItem[];
    };
    return Array.isArray(data.items) ? data.items : [];
  }

  async getTopProducts(filters: AnalyticsFilters, limit = 20): Promise<AnalyticsTopProductItem[]> {
    const qs = this.toQueryString(filters);
    const suffix = qs ? `${qs}&limit=${limit}` : `?limit=${limit}`;
    const data = (await this.request(`/top-products${suffix}`)) as {
      items?: AnalyticsTopProductItem[];
    };
    return Array.isArray(data.items) ? data.items : [];
  }

  async getDrilldownOrders(
    filters: AnalyticsFilters,
    opts: { sku?: string; limit?: number; offset?: number } = {},
  ): Promise<AnalyticsDrilldownOrderItem[]> {
    const qs = new URLSearchParams(this.toQueryString(filters).replace(/^\?/, ''));
    if (opts.sku) {
      qs.set('sku', opts.sku);
    }
    if (opts.limit !== null && opts.limit !== undefined) {
      qs.set('limit', String(opts.limit));
    }
    if (opts.offset !== null && opts.offset !== undefined) {
      qs.set('offset', String(opts.offset));
    }
    const raw = qs.toString();
    const suffix = raw ? `?${raw}` : '';
    const data = (await this.request(`/drilldown/orders${suffix}`)) as {
      items?: AnalyticsDrilldownOrderItem[];
    };
    return Array.isArray(data.items) ? data.items : [];
  }

  async downloadTopProductsCsv(filters: AnalyticsFilters, limit = 200): Promise<Blob> {
    const qs = new URLSearchParams(this.toQueryString(filters).replace(/^\?/, ''));
    qs.set('limit', String(limit));
    const response = await fetch(`${this.basePath}/export/top-products.csv?${qs.toString()}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const text = await response.text();
      const err: any = new Error(text || 'Failed to export CSV');
      err.status = response.status;
      throw err;
    }
    return response.blob();
  }
}

export const analyticsApi = new AnalyticsApi();
