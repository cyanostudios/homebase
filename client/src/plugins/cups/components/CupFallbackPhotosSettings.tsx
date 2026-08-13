import { ImagePlus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DetailSection } from '@/core/ui/DetailSection';
import { filesApi } from '@/plugins/files/api/filesApi';

import { cupsApi } from '../api/cupsApi';

const MAX_FALLBACK_IMAGES = 100;

function urlsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((url, i) => url === b[i]);
}

export function CupFallbackPhotosSettings({
  onDirtyChange,
  onSavingChange,
  saveRef,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  /** Parent assigns `current.save = () => Promise<void>` for the header Save button. */
  saveRef?: React.MutableRefObject<{ save: (() => Promise<void>) | null }>;
} = {}) {
  const { t } = useTranslation();
  const [urls, setUrls] = useState<string[]>([]);
  const [initialUrls, setInitialUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(() => !urlsEqual(urls, initialUrls), [urls, initialUrls]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await cupsApi.getFallbackImages();
      setUrls(loaded);
      setInitialUrls(loaded);
    } catch {
      setError(t('cups.fallbackPhotos.loadError'));
      setUrls([]);
      setInitialUrls([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await cupsApi.setFallbackImages(urls);
      setUrls(saved);
      setInitialUrls(saved);
    } catch {
      setError(t('cups.fallbackPhotos.saveError'));
    } finally {
      setIsSaving(false);
    }
  }, [t, urls]);

  useEffect(() => {
    if (!saveRef) return;
    saveRef.current.save = handleSave;
    return () => {
      saveRef.current.save = null;
    };
  }, [handleSave, saveRef]);

  const handleRemove = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const remaining = MAX_FALLBACK_IMAGES - urls.length;
    if (remaining <= 0) {
      setError(t('cups.fallbackPhotos.maxReached', { max: MAX_FALLBACK_IMAGES }));
      return;
    }
    const files = Array.from(fileList).slice(0, remaining);
    setIsUploading(true);
    setError(null);
    try {
      const items = await filesApi.uploadFiles(files);
      const newUrls = items
        .map((item) => String(item?.url || '').trim())
        .filter((url) => /^https?:\/\//i.test(url));
      if (newUrls.length === 0) {
        setError(t('cups.fallbackPhotos.uploadError'));
        return;
      }
      setUrls((prev) => {
        const seen = new Set(prev);
        const merged = [...prev];
        for (const url of newUrls) {
          if (seen.has(url)) continue;
          seen.add(url);
          merged.push(url);
          if (merged.length >= MAX_FALLBACK_IMAGES) break;
        }
        return merged;
      });
    } catch {
      setError(t('cups.fallbackPhotos.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('cups.fallbackPhotos.loading')}</p>;
  }

  return (
    <DetailSection title={t('cups.fallbackPhotos.title')} className="pt-0">
      <p className="text-sm text-muted-foreground mb-3">{t('cups.fallbackPhotos.help')}</p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 hover:bg-accent">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {t('cups.fallbackPhotos.upload')}
          </span>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            disabled={isUploading || urls.length >= MAX_FALLBACK_IMAGES}
            className="sr-only"
            onChange={(e) => {
              const list = e.target.files;
              e.target.value = '';
              void handleUpload(list);
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          {t('cups.fallbackPhotos.count', { count: urls.length, max: MAX_FALLBACK_IMAGES })}
        </span>
      </div>
      {isUploading ? (
        <p className="text-xs text-muted-foreground mb-2">{t('cups.fallbackPhotos.uploading')}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive mb-2">{error}</p> : null}
      {urls.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('cups.fallbackPhotos.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 list-none p-0 m-0">
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="relative rounded-lg border border-border overflow-hidden bg-muted/30"
            >
              <img src={url} alt="" className="h-28 w-full object-cover" loading="lazy" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-1.5 right-1.5 h-8 px-2"
                onClick={() => handleRemove(index)}
                aria-label={t('cups.fallbackPhotos.remove')}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
