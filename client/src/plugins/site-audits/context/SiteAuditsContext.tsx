import React, { createContext, useContext } from 'react';

import type {
  PanelMode,
  SiteAudit,
  SiteAuditPayload,
  SiteAuditRun,
  StartSiteAuditRunOptions,
  ValidationError,
} from '../types/site-audits';

/** Latest successful `POST /:id/runs`, so every Run audit entry point updates the open view. */
export interface SiteAuditRunStart {
  siteAuditId: string;
  run: SiteAuditRun;
  competitorRun: SiteAuditRun | null;
}

export interface SiteAuditsContextType {
  isSiteAuditPanelOpen: boolean;
  currentSiteAudit: SiteAudit | null;
  panelMode: PanelMode;
  validationErrors: ValidationError[];
  siteAudits: SiteAudit[];
  isSaving: boolean;
  openSiteAuditPanel: (item: SiteAudit | null) => void;
  openSiteAuditForEdit: (item: SiteAudit) => void;
  openSiteAuditForView: (item: SiteAudit) => void;
  closeSiteAuditPanel: () => void;
  saveSiteAudit: (data: SiteAuditPayload) => Promise<boolean>;
  deleteSiteAudit: (id: string) => Promise<void>;
  deleteSiteAudits: (ids: string[]) => Promise<void>;
  getDeleteMessage: (item: SiteAudit | null) => string;
  clearValidationErrors: () => void;
  getPanelTitle: (mode?: string, item?: SiteAudit | null) => React.ReactNode;
  /** Re-fetches the list (e.g. after a run updates `lastScore`/`lastRunAt`). */
  refreshSiteAudits: () => Promise<SiteAudit[]>;
  /** Starts a manual run (site + competitor leg when `competitorUrl` is set). 202 Accepted. */
  startSiteAuditRun: (
    id: string,
    options?: StartSiteAuditRunOptions,
  ) => Promise<{ run: SiteAuditRun; competitorRun: SiteAuditRun | null }>;
  /** Stops an active run (and same-job competitor leg when present). */
  cancelSiteAuditRun: (id: string, runId: string) => Promise<SiteAuditRun>;
  /** Fetches the run history for a site audit (most recent first). */
  getSiteAuditRuns: (id: string, limit?: number) => Promise<SiteAuditRun[]>;
  /** Fetches a single run (used for polling while queued/running). */
  getSiteAuditRun: (id: string, runId: string) => Promise<SiteAuditRun>;
  /** Set after a successful start so the open view can poll even if another control started it. */
  lastStartedSiteAuditRun: SiteAuditRunStart | null;
  /** Localized message when start fails (for example the one-run-at-a-time limit). */
  siteAuditRunError: string | null;
}

export const SiteAuditsContext = createContext<SiteAuditsContextType | undefined>(undefined);

export function useSiteAuditsContext(): SiteAuditsContextType {
  const ctx = useContext(SiteAuditsContext);
  if (!ctx) {
    throw new Error('useSiteAuditsContext must be used within a SiteAuditsProvider');
  }
  return ctx;
}

const EMPTY_SITE_AUDITS_CONTEXT: SiteAuditsContextType = {
  isSiteAuditPanelOpen: false,
  currentSiteAudit: null,
  panelMode: 'create',
  validationErrors: [],
  siteAudits: [],
  isSaving: false,
  openSiteAuditPanel: () => {},
  openSiteAuditForEdit: () => {},
  openSiteAuditForView: () => {},
  closeSiteAuditPanel: () => {},
  saveSiteAudit: async () => false,
  deleteSiteAudit: async () => {},
  deleteSiteAudits: async () => {},
  getDeleteMessage: () => '',
  clearValidationErrors: () => {},
  getPanelTitle: () => null,
  refreshSiteAudits: async () => [],
  startSiteAuditRun: async () => ({ run: null as unknown as SiteAuditRun, competitorRun: null }),
  cancelSiteAuditRun: async () => {
    throw new Error('SiteAuditsNullProvider: cancelSiteAuditRun is not available');
  },
  getSiteAuditRuns: async () => [],
  getSiteAuditRun: async () => {
    throw new Error('SiteAuditsNullProvider: getSiteAuditRun is not available');
  },
  lastStartedSiteAuditRun: null,
  siteAuditRunError: null,
};

export function SiteAuditsNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <SiteAuditsContext.Provider value={EMPTY_SITE_AUDITS_CONTEXT}>
      {children}
    </SiteAuditsContext.Provider>
  );
}
