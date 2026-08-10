export interface MailLogEntry {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  pluginSource: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface MailHistoryResponse {
  items: MailLogEntry[];
  total: number;
}

export type MailProviderKey = 'smtp' | 'resend';

export type MailContentView = 'list' | 'history' | 'routing';

export type MailPanelMode = 'create' | 'edit' | 'view';

export interface MailCatalogField {
  key: string;
  storage: 'secret_primary' | 'secret_secondary' | 'option';
  labelKey: string;
  secret: boolean;
  required: boolean;
}

export interface MailCatalogEntry {
  providerKey: string;
  emailCapable: boolean;
  fields: MailCatalogField[];
}

export interface MailProviderSettings {
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
  emailCapable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MailRoutingAssignment {
  providerKey: string | null;
}

export interface MailPluginRoutingAssignment extends MailRoutingAssignment {
  pluginKey: string;
  label: string;
}

export interface MailRoutingResponse {
  global: MailRoutingAssignment | null;
  plugins: MailPluginRoutingAssignment[];
  routablePlugins: { key: string; label: string }[];
}

export interface SaveMailProviderSettingsInput {
  enabled?: boolean;
  secretPrimary?: string | null;
  secretSecondary?: string | null;
  options?: Record<string, string | null>;
  fields?: Record<string, string | null>;
}

export interface SaveMailRoutingInput {
  providerKey: string;
}

/** @deprecated Legacy flat shape — use MailProviderSettings / routing */
export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  fromAddress: string;
  hasPassword: boolean;
}

/** @deprecated */
export interface ResendSettings {
  hasApiKey: boolean;
  fromAddress: string;
}

/** @deprecated */
export interface MailSettings {
  provider: 'smtp' | 'resend';
  configured: {
    smtp: boolean;
    resend?: boolean;
  };
  smtp: SmtpSettings | null;
  resend: ResendSettings | null;
}
