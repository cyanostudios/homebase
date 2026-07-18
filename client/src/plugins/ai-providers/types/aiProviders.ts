export interface ProviderSettings {
  id: string | null;
  userId: string | null;
  providerKey: string;
  enabled: boolean;
  defaultModel: string;
  /** Masked (`••••••••`) when a key is stored; empty string when unset. */
  apiKey: string;
  hasApiKey: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProviderCatalogModel {
  id: string;
  label: string;
}

export interface ProviderCatalogEntry {
  providerKey: string;
  defaultModel: string;
  /** True when Guides has a registered text adapter for this provider. */
  textGenerationCapable?: boolean;
  models: ProviderCatalogModel[];
}

export interface ProvidersSettingsResponse {
  providers: ProviderSettings[];
}

export interface ProviderCatalogResponse {
  providers: ProviderCatalogEntry[];
}

export interface SaveProviderSettingsInput {
  enabled?: boolean;
  apiKey?: string | null;
  defaultModel?: string;
}

export interface TestConnectionInput {
  apiKey?: string | null;
  defaultModel?: string;
  useSaved?: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  provider: string;
  model: string;
}

export type AIProvidersPanelMode = 'create' | 'edit' | 'view';

export type AIProvidersContentView = 'list' | 'routing';

export interface ProviderRoutingAssignment {
  providerKey: string | null;
  model: string | null;
}

export interface PluginRoutingAssignment extends ProviderRoutingAssignment {
  pluginKey: string;
  label: string;
}

export interface RoutablePluginEntry {
  key: string;
  label: string;
}

export interface ProviderRoutingResponse {
  global: ProviderRoutingAssignment | null;
  plugins: PluginRoutingAssignment[];
  routablePlugins: RoutablePluginEntry[];
}

export interface SaveProviderRoutingInput {
  providerKey: string;
  model?: string | null;
}
