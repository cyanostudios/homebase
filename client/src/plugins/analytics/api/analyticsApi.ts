import type {
  AnalyticsChannelItem,
  AnalyticsCustomerSegments,
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsSummary,
  AnalyticsStatusDistributionItem,
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

  private toQueryParams(filters: AnalyticsFilters): URLSearchParams {
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
    if (filters.channelInstanceId !== undefined && filters.channelInstanceId !== null) {
      qs.set('channelInstanceId', String(filters.channelInstanceId));
    }
    if (filters.granularity) {
      qs.set('granularity', filters.granularity);
    }
    return qs;
  }

  private toQueryString(filters: AnalyticsFilters): string {
    const raw = this.toQueryParams(filters).toString();
    return raw ? `?${raw}` : '';
  }

  private unwrapItems<T>(data: { items?: T[] } | null | undefined): T[] {
    return Array.isArray(data?.items) ? data.items : [];
  }

  async getOverview(filters: AnalyticsFilters): Promise<AnalyticsOverview> {
    return (await this.request(`/overview${this.toQueryString(filters)}`)) as AnalyticsOverview;
  }

  async getSummary(filters: AnalyticsFilters): Promise<AnalyticsSummary> {
    return (await this.request(`/summary${this.toQueryString(filters)}`)) as AnalyticsSummary;
  }

  async getTimeSeries(filters: AnalyticsFilters): Promise<AnalyticsTimeSeriesItem[]> {
    const data = await this.request(`/timeseries${this.toQueryString(filters)}`);
    return this.unwrapItems(data);
  }

  async getStatusDistribution(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsStatusDistributionItem[]> {
    const data = await this.request(`/status-distribution${this.toQueryString(filters)}`);
    return this.unwrapItems(data);
  }

  async getCustomerSegments(filters: AnalyticsFilters): Promise<AnalyticsCustomerSegments> {
    return (await this.request(
      `/customer-segments${this.toQueryString(filters)}`,
    )) as AnalyticsCustomerSegments;
  }

  async getChannels(filters: AnalyticsFilters): Promise<AnalyticsChannelItem[]> {
    const data = await this.request(`/channels${this.toQueryString(filters)}`);
    return this.unwrapItems(data);
  }

  async getTopProducts(filters: AnalyticsFilters, limit = 20): Promise<AnalyticsTopProductItem[]> {
    const params = this.toQueryParams(filters);
    params.set('limit', String(limit));
    const data = await this.request(`/top-products?${params.toString()}`);
    return this.unwrapItems(data);
  }

  async getDrilldownOrders(
    filters: AnalyticsFilters,
    opts: { sku?: string; limit?: number; offset?: number } = {},
  ): Promise<AnalyticsDrilldownOrderItem[]> {
    const params = this.toQueryParams(filters);
    if (opts.sku) {
      params.set('sku', opts.sku);
    }
    if (opts.limit !== undefined && opts.limit !== null) {
      params.set('limit', String(opts.limit));
    }
    if (opts.offset !== undefined && opts.offset !== null) {
      params.set('offset', String(opts.offset));
    }
    const data = await this.request(`/drilldown/orders?${params.toString()}`);
    return this.unwrapItems(data);
  }

  async downloadTopProductsCsv(filters: AnalyticsFilters, limit = 200): Promise<Blob> {
    const params = this.toQueryParams(filters);
    params.set('limit', String(limit));
    const response = await fetch(`${this.basePath}/export/top-products.csv?${params.toString()}`, {
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
