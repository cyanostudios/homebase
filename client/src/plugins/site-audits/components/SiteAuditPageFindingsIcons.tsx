import { AlertTriangle, Info, TriangleAlert } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { cn } from '@/lib/utils';

import type { SiteAuditFinding } from '../types/site-audits';
import { countSiteAuditFindingSeverities } from '../utils/siteAuditFindings';

const ICON_CLASS = 'h-3.5 w-3.5 shrink-0';

/**
 * Compact severity icons for a pages-table row.
 * Shows one icon per severity that appears on the page (critical → warning → info).
 */
export function SiteAuditPageFindingsIcons({
  findings,
}: {
  findings: readonly SiteAuditFinding[];
}) {
  const { t } = useTranslation();
  const counts = countSiteAuditFindingSeverities(findings);

  if (counts.total === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  const parts: string[] = [];
  if (counts.critical > 0) {
    parts.push(t('siteAudits.sectionMeta.critical', { count: counts.critical }));
  }
  if (counts.warning > 0) {
    parts.push(t('siteAudits.sectionMeta.warning', { count: counts.warning }));
  }
  if (counts.info > 0) {
    parts.push(t('siteAudits.sectionMeta.info', { count: counts.info }));
  }
  const label = parts.join(t('siteAudits.sectionMeta.separator'));

  return (
    <span className="inline-flex items-center gap-1" title={label} aria-label={label}>
      {counts.critical > 0 ? (
        <AlertTriangle className={cn(ICON_CLASS, QC_STATUS_BADGE_COLORS.danger)} aria-hidden />
      ) : null}
      {counts.warning > 0 ? (
        <TriangleAlert className={cn(ICON_CLASS, QC_STATUS_BADGE_COLORS.warning)} aria-hidden />
      ) : null}
      {counts.info > 0 ? (
        <Info className={cn(ICON_CLASS, QC_STATUS_BADGE_COLORS.info)} aria-hidden />
      ) : null}
    </span>
  );
}
