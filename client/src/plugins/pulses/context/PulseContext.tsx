import React, { createContext } from 'react';

import type { PulseLogEntry, PulseSettings } from '../types/pulse';

export interface PulseContextType {
  isPulsesPanelOpen: boolean;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  currentPulse: null;
  pulseHistory: PulseLogEntry[];
  totalCount: number;
  settings: PulseSettings | null;
  loading: boolean;
  openPulsePanel: () => void;
  closePulsePanel: () => void;
  openPulseForView: (_item: unknown) => void;
  openPulsesSettings: () => void;
  closePulseSettingsView: () => void;
  pulsesContentView: 'list' | 'settings';
  loadHistory: (params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }) => Promise<void>;
  pushPulseEntry: (entry: PulseLogEntry) => void;
  loadSettings: () => Promise<void>;
  testSettings: (data: {
    testTo: string;
    useSaved?: boolean;
    activeProvider?: 'twilio' | 'mock' | 'apple-messages';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) => Promise<void>;
  getPanelTitle: (mode: string, _item?: unknown, _isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, _item?: unknown) => string;
  getDeleteMessage: (_item?: unknown) => string;
  saveSettings: (data: {
    activeProvider?: 'twilio' | 'mock' | 'apple-messages';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) => Promise<void>;
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  replaceSelectedIds: (ids: string[]) => void;
  mergeIntoSelection: (ids: string[]) => void;
  deleteHistory: (ids: string[]) => Promise<void>;
}

export const PulseContext = createContext<PulseContextType | undefined>(undefined);

const EMPTY_PULSE_CONTEXT: PulseContextType = {
  isPulsesPanelOpen: false,
  panelMode: 'settings',
  currentPulse: null,
  pulseHistory: [],
  totalCount: 0,
  settings: null,
  loading: false,
  openPulsePanel: () => {},
  closePulsePanel: () => {},
  openPulseForView: () => {},
  openPulsesSettings: () => {},
  closePulseSettingsView: () => {},
  pulsesContentView: 'list',
  loadHistory: async () => {},
  pushPulseEntry: () => {},
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

export function PulseNullProvider({ children }: { children: React.ReactNode }) {
  return <PulseContext.Provider value={EMPTY_PULSE_CONTEXT}>{children}</PulseContext.Provider>;
}
