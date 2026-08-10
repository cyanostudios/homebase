import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { ProviderSettings } from '../types/aiProviders';
import type { AIProvidersColumnCount } from '../utils/aiProvidersColumnCount';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function enabledBadgeClass(enabled: boolean) {
  return enabled
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

export function AIProvidersListItem({
  provider,
  title,
  onClick,
  columnCount = 1,
}: {
  provider: ProviderSettings;
  title: string;
  onClick: () => void;
  columnCount?: AIProvidersColumnCount;
}) {
  const { t } = useTranslation();
  const updatedLabel = provider.updatedAt
    ? new Date(provider.updatedAt).toLocaleDateString()
    : null;
  const metaOnTop = columnCount === 1;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="truncate font-mono">{provider.providerKey}</span>
      <span className="truncate">
        {t('aiProviders.defaultModel')}: {provider.defaultModel || '—'}
      </span>
      <span className="truncate">
        {provider.hasApiKey ? t('aiProviders.keyConfigured') : t('aiProviders.keyMissing')}
      </span>
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  );

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={onClick}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(provider)}
      data-plugin-name="ai-providers"
      role="button"
      tabIndex={0}
      aria-label={t('aiProviders.openProvider', { provider: title })}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className={cn(BADGE_CLASS, enabledBadgeClass(provider.enabled))}>
              {provider.enabled ? t('aiProviders.statusEnabled') : t('aiProviders.statusDisabled')}
            </Badge>
            {metaOnTop ? metaRow : null}
          </div>
        </div>

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{title}</h3>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
