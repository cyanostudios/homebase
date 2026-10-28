import type { SiteAuditFinding } from '../../types/site-audits';
import {
  countSiteAuditFindingSeverities,
  selectSiteAuditPillarFindings,
  selectSiteAuditQuickWins,
  siteAuditFindingPillar,
} from '../siteAuditFindings';

function finding(
  partial: Pick<SiteAuditFinding, 'severity' | 'message'> & Partial<SiteAuditFinding>,
): SiteAuditFinding {
  return { category: 'technical', ...partial };
}

describe('site audit overview finding groups', () => {
  const findings: SiteAuditFinding[] = [
    finding({ severity: 'info', message: 'seo-info', pillar: 'seo' }),
    finding({ severity: 'warning', message: 'missing-pillar-warning' }),
    finding({ severity: 'critical', message: 'security-critical', pillar: 'security' }),
    finding({ severity: 'warning', message: 'ai-warning', pillar: 'ai' }),
    finding({ severity: 'critical', message: 'seo-critical', pillar: 'seo' }),
    finding({ severity: 'info', message: 'ai-info', pillar: 'ai' }),
    finding({ severity: 'warning', message: 'seo-warning', pillar: 'seo' }),
    Object.assign(finding({ severity: 'info', message: 'unknown-pillar-info' }), {
      pillar: 'geo',
    }),
  ];

  test('quick wins are critical then warning, with API order inside each severity', () => {
    expect(selectSiteAuditQuickWins(findings).map((item) => item.message)).toEqual([
      'security-critical',
      'seo-critical',
      'missing-pillar-warning',
      'ai-warning',
      'seo-warning',
    ]);
  });

  test('missing or unknown pillar is treated as seo', () => {
    expect(siteAuditFindingPillar(finding({ severity: 'info', message: 'bare' }))).toBe('seo');
    expect(
      siteAuditFindingPillar(
        Object.assign(finding({ severity: 'info', message: 'junk' }), { pillar: 'geo' }),
      ),
    ).toBe('seo');
  });

  test('pillar sections keep every severity and do not drop a quick win', () => {
    expect(selectSiteAuditPillarFindings(findings, 'seo').map((item) => item.message)).toEqual([
      'seo-critical',
      'missing-pillar-warning',
      'seo-warning',
      'seo-info',
      'unknown-pillar-info',
    ]);
    expect(selectSiteAuditPillarFindings(findings, 'ai').map((item) => item.message)).toEqual([
      'ai-warning',
      'ai-info',
    ]);
    expect(selectSiteAuditPillarFindings(findings, 'security').map((item) => item.message)).toEqual(
      ['security-critical'],
    );
  });

  test('counts findings by severity for collapsed section meta', () => {
    expect(countSiteAuditFindingSeverities([])).toEqual({
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
    });
    expect(countSiteAuditFindingSeverities(selectSiteAuditQuickWins(findings))).toEqual({
      total: 5,
      critical: 2,
      warning: 3,
      info: 0,
    });
    expect(countSiteAuditFindingSeverities(selectSiteAuditPillarFindings(findings, 'seo'))).toEqual(
      {
        total: 5,
        critical: 1,
        warning: 2,
        info: 2,
      },
    );
  });
});
