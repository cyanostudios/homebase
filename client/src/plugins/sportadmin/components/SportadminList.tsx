// client/src/plugins/sportadmin/components/SportadminList.tsx
import { BookOpen, Bug, Link2, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { navPageToPath } from '@/core/routing/routeMap';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';

import { sportadminApi } from '../api/sportadminApi';
import type { SportadminStatus } from '../types/sportadmin';
import { formatSportadminApiError } from '../utils/formatSportadminApiError';

import { SportadminDebugPanel } from './SportadminDebugPanel';
import { SportadminIntegrationPanel } from './SportadminIntegrationPanel';
import { SportadminPagesPanel } from './SportadminPagesPanel';
import { SportadminTeamsPanel } from './SportadminTeamsPanel';

type SportadminCategory = 'integration' | 'pages' | 'teams' | 'debug';

const EMPTY_STATUS: SportadminStatus = {
  siteUrl: null,
  status: 'not_configured',
  lastSuccessfulSync: null,
  lastAttemptedSync: null,
  nextSync: null,
  lastError: null,
  counts: { pages: 0, teams: 0, news: 0, matches: 0, events: 0, links: 0 },
  connectionTest: null,
  organizationName: null,
  cronEnabled: false,
  refreshIntervalMinutes: 1440,
};

export function SportadminList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [category, setCategory] = useState<SportadminCategory>('integration');
  const [status, setStatus] = useState<SportadminStatus | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [initialSiteUrl, setInitialSiteUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'integration',
        label: t('sportadmin.categories.integration'),
        description: t('sportadmin.categories.integrationDesc'),
        icon: Link2,
      },
      {
        id: 'pages',
        label: t('sportadmin.categories.pages'),
        description: t('sportadmin.categories.pagesDesc'),
        icon: BookOpen,
      },
      {
        id: 'teams',
        label: t('sportadmin.categories.teams'),
        description: t('sportadmin.categories.teamsDesc'),
        icon: Users,
      },
      {
        id: 'debug',
        label: t('sportadmin.categories.debug'),
        description: t('sportadmin.categories.debugDesc'),
        icon: Bug,
      },
    ],
    [t],
  );

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await sportadminApi.getStatus();
      setStatus(next);
      const url = next.siteUrl ?? '';
      setSiteUrl(url);
      setInitialSiteUrl(url);
    } catch {
      setStatus(EMPTY_STATUS);
      setSiteUrl('');
      setInitialSiteUrl('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isDirty = category === 'integration' && siteUrl.trim() !== initialSiteUrl.trim();

  const handleClose = useCallback(() => {
    navigate(navPageToPath.dashboard);
  }, [navigate]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSyncMessage(null);
    setSyncError(null);
    setIsSaving(true);
    try {
      const next = await sportadminApi.saveConfig(siteUrl.trim());
      setStatus(next);
      const url = next.siteUrl ?? siteUrl.trim();
      setSiteUrl(url);
      setInitialSiteUrl(url);
    } catch (err) {
      setSaveError(formatSportadminApiError(err, t('sportadmin.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  }, [siteUrl, t]);

  return (
    <div className="plugin-sportadmin flex h-full min-h-0 flex-col overflow-hidden bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <PluginSettingsPageShell
        className="flex min-h-0 flex-1 flex-col gap-4 space-y-0"
        title={t('nav.sportadmin')}
        subtitle={t('sportadmin.subtitle')}
        categories={categories}
        activeCategory={category}
        onCategoryChange={(id) => setCategory(id as SportadminCategory)}
        onClose={handleClose}
        onSave={isDirty ? () => void handleSave() : undefined}
        isSaving={isSaving}
        saveAction={
          isDirty ? (
            <SettingsHeaderSaveButton
              onClick={() => void handleSave()}
              isSaving={isSaving}
              disabled={isSaving}
            />
          ) : null
        }
        wrapContentInCard={false}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <>
              {saveError ? (
                <p className="mb-3 shrink-0 text-sm text-destructive">{saveError}</p>
              ) : null}
              {category === 'integration' ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <SportadminIntegrationPanel
                    status={status}
                    siteUrl={siteUrl}
                    onSiteUrlChange={setSiteUrl}
                    onStatusChange={setStatus}
                    syncMessage={syncMessage}
                    syncError={syncError}
                    onSyncMessage={setSyncMessage}
                    onSyncError={setSyncError}
                  />
                </div>
              ) : null}
              {category === 'pages' ? <SportadminPagesPanel status={status} /> : null}
              {category === 'teams' ? <SportadminTeamsPanel status={status} /> : null}
              {category === 'debug' ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <SportadminDebugPanel />
                </div>
              ) : null}
            </>
          )}
        </div>
      </PluginSettingsPageShell>
    </div>
  );
}
