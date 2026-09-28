// client/src/plugins/tenants/api/tenantsApi.ts
import { createApiClient } from '@/core/api/createApiClient';

import type { TenantDetail, TenantListItem } from '../types/tenants';

const request = createApiClient('/tenants', {
  jsonOnMutationsOnly: true,
});

export const tenantsApi = {
  async list(): Promise<TenantListItem[]> {
    const res = (await request('')) as { tenants: TenantListItem[] };
    return res.tenants ?? [];
  },

  async get(tenantId: number): Promise<TenantDetail> {
    const res = (await request(`/${tenantId}`)) as { tenant: TenantDetail };
    return res.tenant;
  },

  async updatePlugins(
    tenantId: number,
    body: { enable?: string[]; disable?: string[] },
  ): Promise<TenantDetail> {
    const res = (await request(`/${tenantId}/plugins`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })) as { tenant: TenantDetail };
    return res.tenant;
  },
};
