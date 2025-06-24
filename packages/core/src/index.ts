export * from './tenants/tenant.service';
export * from './tenants/tenant.types';
export * from './rbac/rbac.service';
export * from './rbac/rbac.types';
export * from './settings/settings.service';
export * from './settings/settings.types';
export * from './audit/audit.service';

export const core = () => {
  return 'core';
};
