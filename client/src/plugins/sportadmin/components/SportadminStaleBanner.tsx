// client/src/plugins/sportadmin/components/SportadminStaleBanner.tsx
import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { cn } from '@/lib/utils';

import { formatSportadminDateTime } from '../utils/formatSportadminDate';

export function SportadminStaleBanner({
  lastSuccessfulSync,
  lastError,
}: {
  lastSuccessfulSync: string | null;
  lastError: string | null;
}) {
  const { t } = useTranslation();
  if (!lastError) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm',
        QC_STATUS_BADGE_COLORS.warning,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          {t('sportadmin.staleBanner', {
            datetime: formatSportadminDateTime(lastSuccessfulSync),
          })}
        </p>
        {lastError ? (
          <p className="text-xs text-muted-foreground break-words">{lastError}</p>
        ) : null}
      </div>
    </div>
  );
}
