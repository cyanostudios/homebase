export type AnalyticsGranularity = 'day' | 'week' | 'month';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  status?: string;
  channel?: string;
  channelInstanceId?: number;
  granularity?: AnalyticsGranularity;
}

export interface AnalyticsOverview {
  revenue: number;
  orderCount: number;
  aov: number;
  unitsSold: number;
}

export interface AnalyticsTimeSeriesItem {
  bucket: string;
  orderCount: number;
  revenue: number;
}

export interface AnalyticsChannelItem {
  channel: string;
  channelInstanceId: number | null;
  channelLabel: string | null;
  orderCount: number;
  revenue: number;
}

export interface AnalyticsTopProductItem {
  sku: string | null;
  title: string | null;
  orderCount: number;
  unitsSold: number;
  revenue: number;
}

export interface AnalyticsDrilldownOrderItem {
  id: string;
  orderNumber: number | null;
  channel: string;
  channelInstanceId: number | null;
  channelLabel: string | null;
  placedAt: string;
  status: string;
  totalAmount: number | null;
  currency: string | null;
}
