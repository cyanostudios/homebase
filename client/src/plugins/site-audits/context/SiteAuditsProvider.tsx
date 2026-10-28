import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { buildSlug, resolveSlug } from '@/core/utils/slugUtils';

import { siteAuditsApi } from '../api/siteAuditsApi';
import { SiteAuditDetailHeaderMenus } from '../components/SiteAuditDetailHeaderMenus';
import type { SiteAudit, SiteAuditPayload, ValidationError } from '../types/site-audits';

import {
  SiteAuditsContext,
  type SiteAuditRunStart,
  type SiteAuditsContextType,
} from './SiteAuditsContext';

interface SiteAuditsProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

const BASE_PATH = '/site-audits';

function readRunErrorMessage(err: unknown, busy: string, fallback: string): string {
  const status =
    typeof err === 'object' && err && 'status' in err
      ? Number((err as { status?: number }).status)
      : NaN;
  if (status === 429) {
    return busy;
  }
  if (err instanceof Error && err.message.trim() && err.message !== 'Request failed') {
    return err.message;
  }
  return fallback;
}

function normalizePayload(raw: SiteAuditPayload): SiteAuditPayload {
  const competitorUrl = raw.competitorUrl?.trim();
  return {
    name: raw.name.trim(),
    url: raw.url.trim(),
    competitorUrl: competitorUrl ? competitorUrl : null,
  };
}

export function SiteAuditsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: SiteAuditsProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl(BASE_PATH);

  const [isSiteAuditPanelOpen, setIsSiteAuditPanelOpen] = useState(false);
  const [currentSiteAudit, setCurrentSiteAudit] = useState<SiteAudit | null>(null);
  const [panelMode, setPanelMode] = useState<SiteAuditsContextType['panelMode']>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<ValidationError>();
  const [siteAudits, setSiteAudits] = useState<SiteAudit[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastStartedSiteAuditRun, setLastStartedSiteAuditRun] = useState<SiteAuditRunStart | null>(
    null,
  );
  const [siteAuditRunError, setSiteAuditRunError] = useState<string | null>(null);

  const loadSiteAudits = useCallback(async (): Promise<SiteAudit[]> => {
    try {
      const items = await siteAuditsApi.getSiteAudits();
      setSiteAudits(items);
      setCurrentSiteAudit((prev) => {
        if (!prev) {
          return prev;
        }
        return items.find((item) => String(item.id) === String(prev.id)) ?? prev;
      });
      return items;
    } catch (err) {
      console.error('Failed to load site audits:', err);
      setValidationErrors([{ field: 'general', message: 'Failed to load site audits.' }]);
      return [];
    }
  }, [setValidationErrors]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSiteAudits([]);
      return;
    }
    void loadSiteAudits();
  }, [isAuthenticated, loadSiteAudits]);

  const closeSiteAuditPanel = useCallback(() => {
    setIsSiteAuditPanelOpen(false);
    setCurrentSiteAudit(null);
    setPanelMode('create');
    setSiteAuditRunError(null);
    clearValidationErrors();
    navigateToBase();
  }, [clearValidationErrors, navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('site-audits', closeSiteAuditPanel);
    return () => unregisterPanelCloseFunction('site-audits');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeSiteAuditPanel]);

  const openSiteAuditPanel = useCallback(
    (item: SiteAudit | null) => {
      setCurrentSiteAudit(item);
      setPanelMode(item ? 'edit' : 'create');
      setIsSiteAuditPanelOpen(true);
      setSiteAuditRunError(null);
      clearValidationErrors();
      onCloseOtherPanels();
      if (item) {
        navigateToItem(item, siteAudits, 'name');
      }
    },
    [clearValidationErrors, navigateToItem, onCloseOtherPanels, siteAudits],
  );

  const openSiteAuditForEdit = useCallback(
    (item: SiteAudit) => {
      setCurrentSiteAudit(item);
      setPanelMode('edit');
      setIsSiteAuditPanelOpen(true);
      setSiteAuditRunError(null);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(item, siteAudits, 'name');
    },
    [clearValidationErrors, navigateToItem, onCloseOtherPanels, siteAudits],
  );

  const openSiteAuditForViewRef = useRef<(item: SiteAudit) => void>(() => {});
  const openSiteAuditForView = useCallback(
    (item: SiteAudit) => {
      if (!window.location.pathname.startsWith(BASE_PATH)) {
        navigate(`${BASE_PATH}/${buildSlug(item, siteAudits, 'name')}`);
        return;
      }
      setCurrentSiteAudit(item);
      setPanelMode('view');
      setIsSiteAuditPanelOpen(true);
      setSiteAuditRunError(null);
      clearValidationErrors();
      onCloseOtherPanels();
      navigateToItem(item, siteAudits, 'name');
    },
    [clearValidationErrors, navigate, navigateToItem, onCloseOtherPanels, siteAudits],
  );
  useEffect(() => {
    openSiteAuditForViewRef.current = openSiteAuditForView;
  }, [openSiteAuditForView]);

  const deepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (siteAudits.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'site-audits') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      deepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (deepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, siteAudits, 'name');
    deepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openSiteAuditForViewRef.current(item as SiteAudit);
    }
  }, [location.pathname, siteAudits]);

  const validate = useCallback(
    (data: SiteAuditPayload): ValidationError[] => {
      const errors: ValidationError[] = [];
      if (!data.name.trim()) {
        errors.push({ field: 'name', message: t('siteAudits.errors.nameRequired') });
      }
      if (!data.url.trim()) {
        errors.push({ field: 'url', message: t('siteAudits.errors.urlRequired') });
      }
      return errors;
    },
    [t],
  );

  const saveSiteAudit = useCallback(
    async (raw: SiteAuditPayload): Promise<boolean> => {
      const payload = normalizePayload(raw);
      const errors = validate(payload);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }

      try {
        setIsSaving(true);
        if (currentSiteAudit) {
          const saved = await siteAuditsApi.updateSiteAudit(currentSiteAudit.id, payload);
          const list = await loadSiteAudits();
          setCurrentSiteAudit(saved);
          setPanelMode('view');
          clearValidationErrors();
          navigateToItem(saved, list.length ? list : [saved], 'name');
        } else {
          const saved = await siteAuditsApi.createSiteAudit(payload);
          const list = await loadSiteAudits();
          setCurrentSiteAudit(saved);
          setPanelMode('view');
          clearValidationErrors();
          navigateToItem(saved, list.length ? list : [saved], 'name');
        }
        return true;
      } catch (err) {
        const error = err as { errors?: ValidationError[] };
        console.error('Failed to save site audit:', err);
        if (Array.isArray(error.errors) && error.errors.length > 0) {
          setValidationErrors(error.errors);
        } else {
          setValidationErrors([{ field: 'general', message: t('siteAudits.errors.saveFailed') }]);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearValidationErrors,
      currentSiteAudit,
      loadSiteAudits,
      navigateToItem,
      setValidationErrors,
      t,
      validate,
    ],
  );

  const deleteSiteAudit = useCallback(
    async (id: string) => {
      try {
        await siteAuditsApi.deleteSiteAudit(id);
      } catch (err) {
        console.error('Failed to delete site audit:', err);
        throw err;
      }
      await loadSiteAudits();
      if (currentSiteAudit?.id === id) {
        closeSiteAuditPanel();
      }
    },
    [closeSiteAuditPanel, currentSiteAudit?.id, loadSiteAudits],
  );

  const deleteSiteAudits = useCallback(
    async (ids: string[]) => {
      const normalized = Array.isArray(ids) ? ids.map(String) : [];
      if (normalized.length === 0) {
        return;
      }
      try {
        await siteAuditsApi.deleteSiteAuditsBatch(normalized);
      } catch (err) {
        console.error('Failed to bulk delete site audits:', err);
        throw err;
      }
      await loadSiteAudits();
      if (currentSiteAudit?.id && normalized.includes(String(currentSiteAudit.id))) {
        closeSiteAuditPanel();
      }
    },
    [closeSiteAuditPanel, currentSiteAudit?.id, loadSiteAudits],
  );

  const startSiteAuditRun = useCallback(
    async (id: string, options?: { mode?: 'full' | 'quick' }) => {
      setSiteAuditRunError(null);
      try {
        const result = await siteAuditsApi.startRun(id, options);
        const started: SiteAuditRunStart = {
          siteAuditId: String(id),
          run: result.run,
          competitorRun: result.competitorRun,
        };
        setLastStartedSiteAuditRun(started);
        // lastScore lands when the job finishes; refresh so the list stays aligned, then
        // loadSiteAudits merges the parent row back onto currentSiteAudit.
        void loadSiteAudits();
        setCurrentSiteAudit((prev) =>
          prev && String(prev.id) === String(id) ? { ...prev, ...result.site } : prev,
        );
        return { run: result.run, competitorRun: result.competitorRun };
      } catch (err) {
        setSiteAuditRunError(
          readRunErrorMessage(
            err,
            t('siteAudits.errors.runBusy'),
            t('siteAudits.errors.runFailed'),
          ),
        );
        throw err;
      }
    },
    [loadSiteAudits, t],
  );

  const cancelSiteAuditRun = useCallback(
    async (id: string, runId: string) => {
      setSiteAuditRunError(null);
      try {
        const result = await siteAuditsApi.cancelRun(id, runId);
        void loadSiteAudits();
        return result.run;
      } catch (err) {
        setSiteAuditRunError(
          readRunErrorMessage(
            err,
            t('siteAudits.errors.cancelFailed'),
            t('siteAudits.errors.cancelFailed'),
          ),
        );
        throw err;
      }
    },
    [loadSiteAudits, t],
  );

  const getSiteAuditRuns = useCallback((id: string, limit?: number) => {
    return siteAuditsApi.getRuns(id, limit);
  }, []);

  const getSiteAuditRun = useCallback((id: string, runId: string) => {
    return siteAuditsApi.getRun(id, runId);
  }, []);

  const getDeleteMessage = useCallback(
    (item: SiteAudit | null) => buildDeleteMessage(t, 'siteAudits', item?.name || undefined),
    [t],
  );

  const getPanelTitle = useCallback((mode?: string, item?: SiteAudit | null) => {
    if (mode === 'view' && item) {
      return <SiteAuditDetailHeaderMenus key={String(item.id)} item={item} />;
    }
    return null;
  }, []);

  const value = useMemo<SiteAuditsContextType>(
    () => ({
      isSiteAuditPanelOpen,
      currentSiteAudit,
      panelMode,
      validationErrors,
      siteAudits,
      isSaving,
      openSiteAuditPanel,
      openSiteAuditForEdit,
      openSiteAuditForView,
      closeSiteAuditPanel,
      saveSiteAudit,
      deleteSiteAudit,
      deleteSiteAudits,
      getDeleteMessage,
      clearValidationErrors,
      getPanelTitle,
      refreshSiteAudits: loadSiteAudits,
      startSiteAuditRun,
      cancelSiteAuditRun,
      getSiteAuditRuns,
      getSiteAuditRun,
      lastStartedSiteAuditRun,
      siteAuditRunError,
    }),
    [
      isSiteAuditPanelOpen,
      currentSiteAudit,
      panelMode,
      validationErrors,
      siteAudits,
      isSaving,
      openSiteAuditPanel,
      openSiteAuditForEdit,
      openSiteAuditForView,
      closeSiteAuditPanel,
      saveSiteAudit,
      deleteSiteAudit,
      deleteSiteAudits,
      getDeleteMessage,
      clearValidationErrors,
      getPanelTitle,
      loadSiteAudits,
      startSiteAuditRun,
      cancelSiteAuditRun,
      getSiteAuditRuns,
      getSiteAuditRun,
      lastStartedSiteAuditRun,
      siteAuditRunError,
    ],
  );

  return <SiteAuditsContext.Provider value={value}>{children}</SiteAuditsContext.Provider>;
}
