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

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  fromAddress: string;
  hasPassword: boolean;
}

export interface ResendSettings {
  hasApiKey: boolean;
  fromAddress: string;
}

export interface MailSettings {
  provider: 'smtp' | 'resend';
  configured: {
    smtp: boolean;
    resend?: boolean;
  };
  smtp: SmtpSettings | null;
  resend: ResendSettings | null;
}
