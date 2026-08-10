export interface PulseLogEntry {
  id: string;
  recipient: string;
  body: string;
  provider: string | null;
  status: string;
  sentAt: string;
  pluginSource: string | null;
  referenceId: string | null;
}

export interface PulseHistoryResponse {
  items: PulseLogEntry[];
  total: number;
}

export type PulseProviderKey = 'twilio' | 'mock' | 'twilio-verify' | 'stytch';

export type PulsesContentView = 'list' | 'history' | 'routing';

export type PulsePanelMode = 'create' | 'edit' | 'view';

export interface PulseCatalogField {
  key: string;
  storage: 'secret_primary' | 'secret_secondary' | 'option';
  labelKey: string;
  secret: boolean;
  required: boolean;
}

export interface PulseCatalogEntry {
  providerKey: string;
  smsNotificationCapable: boolean;
  verifyCapable: boolean;
  fields: PulseCatalogField[];
}

export interface PulseProviderSettings {
  id: string | null;
  userId: string | null;
  providerKey: string;
  enabled: boolean;
  secretPrimary: string;
  secretSecondary: string;
  hasSecretPrimary: boolean;
  hasSecretSecondary: boolean;
  options: Record<string, string>;
  configured: boolean;
  smsNotificationCapable: boolean;
  verifyCapable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PulseRoutingAssignment {
  providerKey: string | null;
}

export interface PulsePluginRoutingAssignment extends PulseRoutingAssignment {
  pluginKey: string;
  label: string;
}

export interface PulseRoutingResponse {
  global: PulseRoutingAssignment | null;
  plugins: PulsePluginRoutingAssignment[];
  routablePlugins: { key: string; label: string }[];
}

export interface SavePulseProviderSettingsInput {
  enabled?: boolean;
  secretPrimary?: string | null;
  secretSecondary?: string | null;
  options?: Record<string, string | null>;
  fields?: Record<string, string | null>;
}

export interface SavePulseRoutingInput {
  providerKey: string;
}

/** @deprecated Legacy shape — use PulseProviderSettings / routing */
export type PulseProvider = 'twilio' | 'mock';

/** @deprecated */
export interface PulseSettings {
  activeProvider?: PulseProvider;
  configured?: { twilio: boolean; mock: boolean };
  twilio?: {
    hasAccountSid: boolean;
    hasAuthToken: boolean;
    fromNumber: string;
  } | null;
}
