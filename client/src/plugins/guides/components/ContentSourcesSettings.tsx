import { BookOpen, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { guidesApi } from '../api/guidesApi';
import type { ContentSourceSetting } from '../types/guides';

interface ContentSourcesSettingsProps {
  className?: string;
}

export const ContentSourcesSettings: React.FC<ContentSourcesSettingsProps> = ({ className }) => {
  const { t } = useTranslation();
  const [sources, setSources] = useState<ContentSourceSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await guidesApi.getContentSources();
      setSources(result.sources);
    } catch {
      setError(t('guides.contentSources.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (sourceKey: string, enabled: boolean) => {
    setSavingKey(sourceKey);
    setError(null);
    try {
      const updated = await guidesApi.updateContentSource(sourceKey, { enabled });
      setSources((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
    } catch {
      setError(t('guides.contentSources.saveFailed'));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <DetailSection
      title={t('guides.contentSources.title')}
      icon={BookOpen}
      iconPlugin="guides"
      className={cn('p-4', className)}
    >
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">{t('guides.contentSources.description')}</p>
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('common.loading')}
          </div>
        )}
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
        {!loading && (
          <ul className="space-y-3">
            {sources.map((source) => (
              <li
                key={source.key}
                className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`content-source-${source.key}`} className="text-sm font-medium">
                    {source.label}
                  </Label>
                  {source.attribution && (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {source.attribution}
                    </p>
                  )}
                </div>
                <Switch
                  id={`content-source-${source.key}`}
                  checked={source.enabled}
                  disabled={savingKey === source.key}
                  onCheckedChange={(checked) => void onToggle(source.key, checked)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailSection>
  );
};
