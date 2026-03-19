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

export interface PulseTwilioSettings {
  hasAccountSid: boolean;
  hasAuthToken: boolean;
  fromNumber: string;
}

export interface PulseSettings {
  activeProvider: 'twilio' | 'mock' | 'apple-messages';
  configured: { twilio: boolean; mock: boolean; appleMessages: boolean };
  twilio: PulseTwilioSettings | null;
}
