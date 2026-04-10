import React, { createContext } from 'react';

import type { MailLogEntry, MailSettings } from '../types/mail';

export interface MailContextType {
  isMailPanelOpen: boolean;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  currentMail: MailLogEntry | null;
  mailHistory: MailLogEntry[];
  totalCount: number;
  settings: MailSettings | null;
  loading: boolean;
  openMailPanel: () => void;
  closeMailPanel: () => void;
  openMailForView: (item: MailLogEntry) => void;
  openMailsSettings: () => void;
  closeMailSettingsView: () => void;
  mailContentView: 'list' | 'settings';
  loadHistory: (params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }) => Promise<void>;
  pushMailEntry: (entry: MailLogEntry) => void;
  loadSettings: () => Promise<void>;
  testSettings: (data: {
    testTo: string;
    useSaved?: boolean;
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) => Promise<void>;
  getPanelTitle: (mode: string, _item?: any, _isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, _item?: any) => string;
  getDeleteMessage: (_item?: any) => string;
  saveSettings: (data: {
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) => Promise<void>;
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** Replace selection (e.g. select-all-visible / union with filter). */
  replaceSelectedIds: (ids: string[]) => void;
  mergeIntoSelection: (ids: string[]) => void;
  deleteHistory: (ids: string[]) => Promise<void>;
}

export const MailContext = createContext<MailContextType | undefined>(undefined);

const EMPTY_MAIL_CONTEXT: MailContextType = {
  isMailPanelOpen: false,
  panelMode: 'settings',
  currentMail: null,
  mailHistory: [],
  totalCount: 0,
  settings: null,
  loading: false,
  openMailPanel: () => {},
  closeMailPanel: () => {},
  openMailForView: () => {},
  openMailsSettings: () => {},
  closeMailSettingsView: () => {},
  mailContentView: 'list',
  loadHistory: async () => {},
  pushMailEntry: () => {},
  loadSettings: async () => {},
  testSettings: async () => {},
  getPanelTitle: () => '',
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
  saveSettings: async () => {},
  selectedIds: [],
  selectedCount: 0,
  isSelected: () => false,
  toggleSelected: () => {},
  selectAll: () => {},
  clearSelection: () => {},
  replaceSelectedIds: () => {},
  mergeIntoSelection: () => {},
  deleteHistory: async () => {},
};

export function MailNullProvider({ children }: { children: React.ReactNode }) {
  return <MailContext.Provider value={EMPTY_MAIL_CONTEXT}>{children}</MailContext.Provider>;
}
