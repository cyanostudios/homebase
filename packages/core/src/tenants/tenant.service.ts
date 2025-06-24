export async function createTenant(name: string): Promise<string> {
  // Placeholder: logic to create a tenant and return its identifier will go here
  return 'tenant-id';
}

export async function getTenant(id: string): Promise<Tenant | null> {
  // Placeholder: logic to retrieve a tenant by id will go here
  return null;
}

import type { Tenant } from './tenant.types';
