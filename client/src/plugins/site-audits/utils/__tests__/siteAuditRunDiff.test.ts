import type { SiteAuditRun } from '../../types/site-audits';
import {
  computeSiteAuditRunDiff,
  findPreviousDoneSiteRun,
  formatSiteAuditScoreDelta,
  siteAuditFindingFingerprint,
} from '../siteAuditRunDiff';

function siteRun(
  overrides: Partial<SiteAuditRun> & Pick<SiteAuditRun, 'id' | 'startedAt'>,
): SiteAuditRun {
  return {
    siteAuditId: 'sa-1',
    target: 'site',
    status: 'done',
    score: 70,
    summary: {
      score: 70,
      categories: { indexing: 70, content: 70, technical: 70, sharing: 70 },
      findings: [],
    },
    pages: [],
    error: null,
    finishedAt: '2026-10-20T12:05:00.000Z',
    ...overrides,
  };
}

describe('siteAuditRunDiff', () => {
  test('fingerprint prefers code (+ url) when present', () => {
    expect(
      siteAuditFindingFingerprint({
        severity: 'warning',
        category: 'content',
        message: 'Missing H1',
        code: 'missing_h1',
        url: 'https://ex.com/a',
      }),
    ).toBe('missing_h1|https://ex.com/a');

    expect(
      siteAuditFindingFingerprint({
        severity: 'warning',
        category: 'content',
        message: 'Missing H1',
        code: 'missing_h1',
      }),
    ).toBe('missing_h1');

    expect(
      siteAuditFindingFingerprint({
        severity: 'warning',
        category: 'content',
        message: 'Odd custom message',
        url: 'https://ex.com/b',
      }),
    ).toBe('odd custom message|https://ex.com/b');
  });

  test('finds the previous done site run by startedAt', () => {
    const selected = siteRun({ id: '3', startedAt: '2026-10-22T12:00:00.000Z', score: 80 });
    const olderDone = siteRun({ id: '1', startedAt: '2026-10-20T12:00:00.000Z', score: 60 });
    const midDone = siteRun({ id: '2', startedAt: '2026-10-21T12:00:00.000Z', score: 70 });
    const cancelled = siteRun({
      id: 'c',
      startedAt: '2026-10-21T18:00:00.000Z',
      status: 'cancelled',
      score: null,
    });
    const failed = siteRun({
      id: 'f',
      startedAt: '2026-10-21T19:00:00.000Z',
      status: 'failed',
      score: null,
    });

    expect(
      findPreviousDoneSiteRun(selected, [selected, cancelled, failed, midDone, olderDone])?.id,
    ).toBe('2');
  });

  test('ignores non-done statuses as baseline', () => {
    const selected = siteRun({ id: '2', startedAt: '2026-10-22T12:00:00.000Z' });
    const running = siteRun({
      id: '1',
      startedAt: '2026-10-21T12:00:00.000Z',
      status: 'running',
    });
    expect(findPreviousDoneSiteRun(selected, [selected, running])).toBeNull();
  });

  test('computes score / category deltas and added / resolved findings', () => {
    const baseline = siteRun({
      id: '1',
      startedAt: '2026-10-20T12:00:00.000Z',
      score: 60,
      summary: {
        score: 60,
        categories: { indexing: 50, content: 60, technical: 70, sharing: 60 },
        findings: [
          {
            severity: 'critical',
            category: 'content',
            message: 'Missing <title>',
            code: 'missing_title',
            url: 'https://ex.com/',
          },
          {
            severity: 'warning',
            category: 'technical',
            message: 'No HSTS',
            code: 'no_hsts',
          },
          {
            severity: 'info',
            category: 'sharing',
            message: 'Missing twitter:card',
            code: 'missing_twitter_card',
          },
        ],
      },
    });
    const current = siteRun({
      id: '2',
      startedAt: '2026-10-22T12:00:00.000Z',
      score: 72,
      summary: {
        score: 72,
        categories: { indexing: 55, content: 70, technical: 75, sharing: 65 },
        findings: [
          {
            severity: 'warning',
            category: 'technical',
            message: 'No HSTS',
            code: 'no_hsts',
          },
          {
            severity: 'critical',
            category: 'indexing',
            message: 'robots.txt not found',
            code: 'robots_txt_missing',
          },
        ],
      },
    });

    const diff = computeSiteAuditRunDiff(current, baseline);
    expect(diff?.scoreDelta).toBe(12);
    expect(diff?.categoryDeltas.indexing).toBe(5);
    expect(diff?.categoryDeltas.content).toBe(10);
    expect(diff?.added.map((f) => f.code)).toEqual(['robots_txt_missing']);
    expect(diff?.resolved.map((f) => f.code)).toEqual(['missing_title']);
    // info-only finding ignored for added/resolved
    expect(diff?.resolved.some((f) => f.code === 'missing_twitter_card')).toBe(false);
  });

  test('formatSiteAuditScoreDelta signs compactly', () => {
    expect(formatSiteAuditScoreDelta(4.2)).toBe('+4');
    expect(formatSiteAuditScoreDelta(-2.6)).toBe('-3');
    expect(formatSiteAuditScoreDelta(0)).toBe('0');
    expect(formatSiteAuditScoreDelta(null)).toBeNull();
  });
});
