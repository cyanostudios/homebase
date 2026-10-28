import type { SiteAuditRun } from '../../types/site-audits';
import {
  countSiteAuditFindings,
  findBatchCompetitorRun,
  getSiteAuditComparison,
} from '../siteAuditCompare';

function competitorRun(
  overrides: Partial<SiteAuditRun> & Pick<SiteAuditRun, 'id' | 'startedAt'>,
): SiteAuditRun {
  return {
    siteAuditId: '1',
    target: 'competitor',
    status: 'done',
    score: 40,
    summary: {
      score: 40,
      categories: { indexing: 40, content: 40, technical: 40, sharing: 40 },
      findings: [{ severity: 'warning', category: 'content', message: 'Thin title' }],
    },
    pages: [],
    error: null,
    finishedAt: null,
    ...overrides,
  };
}

describe('site audit compare helpers', () => {
  test('pairs the competitor leg from the same run batch', () => {
    const site = { startedAt: '2026-10-20T12:00:00.000Z' };
    const sameBatch = competitorRun({ id: '2', startedAt: '2026-10-20T12:00:01.000Z' });
    const laterBatch = competitorRun({ id: '9', startedAt: '2026-10-20T12:30:00.000Z' });

    expect(findBatchCompetitorRun(site, [laterBatch, sameBatch])?.id).toBe('2');
  });

  test('does not pair a competitor from a later batch', () => {
    const site = { startedAt: '2026-10-20T12:00:00.000Z' };
    const laterBatch = competitorRun({ id: '9', startedAt: '2026-10-20T12:30:00.000Z' });

    expect(findBatchCompetitorRun(site, [laterBatch])).toBeNull();
  });

  test('ignores an empty queued summary and keeps an attached comparison', () => {
    expect(
      getSiteAuditComparison(
        { score: 80, categories: { indexing: 80, content: 80, technical: 80, sharing: 80 } },
        {},
      ),
    ).toBeNull();

    const attached = getSiteAuditComparison(
      {
        score: 80,
        comparison: {
          siteScore: 80,
          competitorScore: 60,
          scoreDelta: 20,
          categories: {
            indexing: { site: 90, competitor: 50, delta: 40 },
          },
        },
      },
      null,
    );

    expect(attached?.scoreDelta).toBe(20);
    expect(attached?.categories.indexing?.delta).toBe(40);
  });

  test('counts findings by severity', () => {
    expect(
      countSiteAuditFindings({
        findings: [
          { severity: 'critical', category: 'indexing', message: 'noindex' },
          { severity: 'critical', category: 'indexing', message: '404' },
          { severity: 'info', category: 'sharing', message: 'missing twitter' },
        ],
      }),
    ).toEqual({ total: 3, critical: 2, warning: 0, info: 1 });
  });
});
