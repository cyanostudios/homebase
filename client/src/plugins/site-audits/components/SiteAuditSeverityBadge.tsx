import { AlertTriangle, Info, TriangleAlert } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { cn } from '@/lib/utils';

const SEVERITY_COLOR: Record<string, string> = {
  critical: QC_STATUS_BADGE_COLORS.danger,
  warning: QC_STATUS_BADGE_COLORS.warning,
  info: QC_STATUS_BADGE_COLORS.info,
};

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: TriangleAlert,
  info: Info,
};

/** Plain-text severity label. Finding copy is never rendered as HTML. */
export function SiteAuditSeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation();
  const Icon = SEVERITY_ICON[severity] ?? Info;
  const label = t(`siteAudits.severity.${severity}`, { defaultValue: severity });

  return (
    <span
      className={cn(BADGE_CHIP_CLASS, SEVERITY_COLOR[severity] ?? QC_STATUS_BADGE_COLORS.neutral)}
    >
      <Icon aria-hidden />
      {label}
    </span>
  );
}
