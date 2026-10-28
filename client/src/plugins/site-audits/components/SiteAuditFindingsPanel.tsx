/**
 * Shared findings list / section for Overview pillars and dedicated category tabs.
 * Plain text only — never render finding copy as HTML.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_EMPTY_STATE_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';

import type { SiteAuditFinding, SiteAuditPillar, SiteAuditRun } from '../types/site-audits';
import {
  countSiteAuditFindingSeverities,
  selectSiteAuditPillarFindings,
  selectSiteAuditQuickWins,
} from '../utils/siteAuditFindings';
import { siteAuditFindingKey } from '../utils/siteAuditFormat';

import { SiteAuditOutboundUrl } from './SiteAuditOutboundUrl';
import { SiteAuditSeverityBadge } from './SiteAuditSeverityBadge';

export type SiteAuditFindingsMode = 'quickWins' | SiteAuditPillar;

function FindingHint({ code }: { code: string }) {
  const { t, i18n } = useTranslation();
  const whyKey = `siteAudits.findingHints.${code}.why`;
  const fixKey = `siteAudits.findingHints.${code}.fix`;
  if (!i18n.exists(whyKey) && !i18n.exists(fixKey)) {
    return null;
  }
  const why = i18n.exists(whyKey) ? t(whyKey) : null;
  const fix = i18n.exists(fixKey) ? t(fixKey) : null;
  return (
    <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
      {why ? (
        <p>
          <span className="font-medium">{t('siteAudits.findingHintWhy')}</span> {why}
        </p>
      ) : null}
      {fix ? (
        <p>
          <span className="font-medium">{t('siteAudits.findingHintFix')}</span> {fix}
        </p>
      ) : null}
    </div>
  );
}

function FindingList({ findings }: { findings: SiteAuditFinding[] }) {
  const seenFindingKeys = new Map<string, number>();
  return (
    <ul className="space-y-2">
      {findings.map((finding) => (
        <li key={siteAuditFindingKey(finding, seenFindingKeys)} className="flex items-start gap-2">
          <SiteAuditSeverityBadge severity={finding.severity} />
          <div className="min-w-0">
            <p className="text-xs text-foreground">{finding.message}</p>
            {typeof finding.code === 'string' && finding.code ? (
              <FindingHint code={finding.code} />
            ) : null}
            {finding.url ? (
              <p className="text-[11px] text-muted-foreground">
                <SiteAuditOutboundUrl url={finding.url} />
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatFindingsSectionMeta(
  findings: SiteAuditFinding[],
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const counts = countSiteAuditFindingSeverities(findings);
  if (counts.total === 0) {
    return t('siteAudits.sectionMeta.none');
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
  return parts.join(t('siteAudits.sectionMeta.separator'));
}

export function SiteAuditFindingsSection({
  title,
  findings,
  emptyLabel,
  defaultOpen = true,
}: {
  title: string;
  findings: SiteAuditFinding[];
  emptyLabel: string;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const meta = formatFindingsSectionMeta(findings, t);

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={title}
        subtleTitle
        className="p-4 sm:p-6"
        collapsible
        defaultOpen={defaultOpen}
        titleAside={
          <span className="truncate text-[11px] font-medium tabular-nums text-muted-foreground">
            {meta}
          </span>
        }
      >
        {findings.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{emptyLabel}</p>
        ) : (
          <FindingList findings={findings} />
        )}
      </DetailSection>
    </Card>
  );
}

function selectFindingsForMode(
  findings: SiteAuditFinding[],
  mode: SiteAuditFindingsMode,
): SiteAuditFinding[] {
  if (mode === 'quickWins') {
    return selectSiteAuditQuickWins(findings);
  }
  return selectSiteAuditPillarFindings(findings, mode);
}

function titleForMode(mode: SiteAuditFindingsMode, t: (key: string) => string): string {
  if (mode === 'quickWins') {
    return t('siteAudits.quickWins');
  }
  return t(`siteAudits.pillars.${mode}`);
}

function emptyLabelForMode(mode: SiteAuditFindingsMode, t: (key: string) => string): string {
  if (mode === 'quickWins') {
    return t('siteAudits.emptyQuickWins');
  }
  return t('siteAudits.pillars.empty');
}

/** One category tab: Quick wins, SEO, AI readiness, or Security findings. */
export function SiteAuditFindingsPanel({
  run,
  mode,
  runsLoading,
}: {
  run: SiteAuditRun | null;
  mode: SiteAuditFindingsMode;
  runsLoading?: boolean;
}) {
  const { t } = useTranslation();

  if (runsLoading) {
    return (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={titleForMode(mode, t)}
          subtleTitle
          className="p-4 sm:p-6"
          collapsible
          defaultOpen
        >
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('common.loading')}</p>
        </DetailSection>
      </Card>
    );
  }

  if (!run) {
    return (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={titleForMode(mode, t)}
          subtleTitle
          className="p-4 sm:p-6"
          collapsible
          defaultOpen
        >
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('siteAudits.noRunsYet')}</p>
        </DetailSection>
      </Card>
    );
  }

  const findings = Array.isArray(run.summary?.findings) ? run.summary.findings : [];
  const selected = selectFindingsForMode(findings, mode);

  return (
    <SiteAuditFindingsSection
      title={titleForMode(mode, t)}
      findings={selected}
      emptyLabel={emptyLabelForMode(mode, t)}
      defaultOpen
    />
  );
}
