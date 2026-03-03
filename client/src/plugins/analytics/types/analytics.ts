export type AnalyticsGranularity = 'day' | 'week' | 'month';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  status?: string;
  channel?: string;
  channelInstanceId?: number;
  granularity?: AnalyticsGranularity;
}

export interface AnalyticsOverviewByCurrency {
  currency: string;
  revenue: number;
  orderCount: number;
  aov: number;
}

export interface AnalyticsOverview {
  byCurrency: AnalyticsOverviewByCurrency[];
  unitsSold: number;
}

export interface AnalyticsTimeSeriesItem {
  bucket: string;
  channel: string;
  channelLabel: string;
  currency: string;
  orderCount: number;
  revenue: number;
}

export interface AnalyticsStatusDistributionItem {
  bucket: string;
  status: string;
  orderCount: number;
  revenue: number;
}

export interface AnalyticsChannelItem {
  channel: string;
  channelInstanceId: number | null;
  channelLabel: string | null;
  currency: string;
  orderCount: number;
  revenue: number;
}

export interface AnalyticsTopProductItem {
  sku: string | null;
  title: string | null;
  orderCount: number;
  unitsSold: number;
  revenueByCurrency: Record<string, number>;
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

export interface AnalyticsCustomerSegments {
  newCustomers: number;
  returningCustomers: number;
  newCustomerOrders: number;
  returningCustomerOrders: number;
  unidentifiedOrders: number;
}

export interface AnalyticsSummary {
  overview: AnalyticsOverview;
  timeSeries: AnalyticsTimeSeriesItem[];
  statusDistribution: AnalyticsStatusDistributionItem[];
  customerSegments: AnalyticsCustomerSegments;
  channels: AnalyticsChannelItem[];
  allChannelsForDropdown: AnalyticsChannelItem[];
}
