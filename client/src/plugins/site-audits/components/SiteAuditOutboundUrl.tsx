/**
 * Plain-text URL with an icon that opens http(s) targets in a new tab.
 * Unsafe schemes / credentials stay text-only (see isSafeSiteAuditHttpUrl).
 */
import { ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { isSafeSiteAuditHttpUrl } from '../utils/siteAuditUrl';

export function SiteAuditOutboundUrl({
  url,
  className,
  textClassName,
}: {
  url: string;
  className?: string;
  textClassName?: string;
}) {
  const { t } = useTranslation();
  const safe = isSafeSiteAuditHttpUrl(url);

  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1', className)}>
      <span className={cn('min-w-0 truncate', textClassName)}>{url}</span>
      {safe ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('siteAudits.openUrl')}
          title={t('siteAudits.openUrl')}
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
    </span>
  );
}
