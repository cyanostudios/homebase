import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDateTime } from '@/core/utils/dateFormat';
import { dedupeInFlightByKey } from '@/core/utils/dedupeInFlightByKey';

import { garmentShareApi } from '../api/garmentsApi';
import type { PublicGarmentList } from '../types/garments';

import { PublicPersonMatrix } from './PersonMatrix';

interface PublicGarmentListViewProps {
  token: string;
}

export function PublicGarmentListView({ token }: PublicGarmentListViewProps) {
  const { t } = useTranslation();
  const [list, setList] = useState<PublicGarmentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t('garments.publicInvalidLink'));
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const publicList = await dedupeInFlightByKey(`public-garment-list:${token}`, () =>
          garmentShareApi.getPublicList(token),
        );
        if (!cancelled) {
          setList(publicList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('garments.publicLoadFailed'));
          setList(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <div className="text-gray-600">{t('garments.publicLoading')}</div>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('garments.publicUnavailable')}
            </h2>
            <p className="text-gray-600 mb-4">{error || t('garments.publicUnavailableHint')}</p>
          </div>
        </div>
      </div>
    );
  }

  const title = (list.name || '').trim() || '—';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-muted/30">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {list.shareValidUntil ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t('garments.publicSharedHint', {
                  date: formatDateTime(list.shareValidUntil),
                })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{t('garments.publicReadOnly')}</p>
            )}
          </div>
          <div className="p-6">
            <PublicPersonMatrix list={list} />
          </div>
        </div>
      </div>
    </div>
  );
}
