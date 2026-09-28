// client/src/plugins/tenants/types/tenants.ts
export type TenantListItem = {
  id: number;
  ownerUserId: number;
  ownerEmail: string | null;
  organizationName: string | null;
  enabledPluginCount: number;
  pluginsLocked?: boolean;
};

export type TenantPluginToggle = {
  pluginName: string;
  enabled: boolean;
  toggleable: boolean;
  publicApp?: boolean;
};

export type TenantDetail = {
  id: number;
  ownerUserId: number;
  ownerEmail: string | null;
  organizationName: string | null;
  plugins: TenantPluginToggle[];
  pluginsLocked?: boolean;
  reloginRequiredHint?: boolean;
};
