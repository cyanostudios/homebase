// client/src/plugins/sportadmin/components/SportadminDebugPanel.tsx
import { Bug } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DETAIL_EMPTY_STATE_CLASS } from '@/core/ui/detailViewCardStyles';

import { sportadminApi } from '../api/sportadminApi';
import type { SportadminDiscovery, SportadminDiscoveryNode } from '../types/sportadmin';

import { SportadminSectionCard } from './SportadminSectionCard';

function DiscoveryTree({ node }: { node: SportadminDiscoveryNode }) {
  const countLabel =
    typeof node.count === 'number' ? `: ${node.count}` : node.warning ? ': ⚠' : '';
  return (
    <li className="font-mono text-xs leading-relaxed">
      <span>
        {node.label}
        {countLabel}
      </span>
      {node.children && node.children.length > 0 ? (
        <ul className="ml-4 list-none border-l border-border/60 pl-3">
          {node.children.map((child) => (
            <DiscoveryTree key={child.label} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SportadminDebugPanel() {
  const { t } = useTranslation();
  const [discovery, setDiscovery] = useState<SportadminDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sportadminApi.getDiscovery();
      setDiscovery(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sportadmin.debugLoadFailed'));
      setDiscovery(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <SportadminSectionCard title={t('sportadmin.sections.discovery')} icon={Bug}>
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !error && !discovery?.tree ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.debugEmpty')}</p>
        ) : null}

        {discovery?.siteUrl ? (
          <p className="mb-3 text-sm">
            <span className="text-muted-foreground">{t('sportadmin.urlLabel')}: </span>
            <span className="break-all font-medium">{discovery.siteUrl}</span>
          </p>
        ) : null}

        {discovery?.tree ? (
          <ul className="list-none">
            <DiscoveryTree node={discovery.tree} />
          </ul>
        ) : null}

        {discovery?.resources && discovery.resources.length > 0 ? (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              {t('sportadmin.debug.resources')}
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
              {discovery.resources.map((resource) => (
                <li key={resource.id} className="break-all">
                  [{resource.type}] {resource.id}
                  {resource.source_url ? ` → ${resource.source_url}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {discovery?.errors && discovery.errors.length > 0 ? (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              {t('sportadmin.debug.errors')}
            </p>
            <ul className="space-y-1 text-xs text-destructive">
              {discovery.errors.map((err) => (
                <li key={`${err.at}:${err.resource}:${err.message}`} className="break-words">
                  {err.resource}: {err.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SportadminSectionCard>
    </div>
  );
}
