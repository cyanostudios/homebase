const { parseRobots, summarizeAiBots, AI_BOT_AGENTS } = require('../robotsParser');

describe('parseRobots', () => {
  test('allows everything when robots.txt is empty', () => {
    const { isAllowed } = parseRobots('');
    expect(isAllowed('/anything')).toBe(true);
  });

  test('respects Disallow rules for User-agent: *', () => {
    const txt = `
      User-agent: *
      Disallow: /admin
      Disallow: /private/
    `;
    const { isAllowed } = parseRobots(txt);
    expect(isAllowed('/admin')).toBe(false);
    expect(isAllowed('/private/secret')).toBe(false);
    expect(isAllowed('/public')).toBe(true);
  });

  test('a more specific Allow overrides a broader Disallow', () => {
    const txt = `
      User-agent: *
      Disallow: /private/
      Allow: /private/public-page
    `;
    const { isAllowed } = parseRobots(txt);
    expect(isAllowed('/private/public-page')).toBe(true);
    expect(isAllowed('/private/secret')).toBe(false);
  });

  test('prefers a group targeting HomebaseSiteAudits over the wildcard group', () => {
    const txt = `
      User-agent: *
      Disallow: /

      User-agent: HomebaseSiteAudits
      Disallow: /admin
    `;
    const { isAllowed } = parseRobots(txt, { userAgent: 'HomebaseSiteAudits' });
    expect(isAllowed('/')).toBe(true);
    expect(isAllowed('/admin')).toBe(false);
  });

  test('falls back to the wildcard group when no specific group matches', () => {
    const txt = `
      User-agent: SomeOtherBot
      Disallow: /

      User-agent: *
      Disallow: /admin
    `;
    const { isAllowed } = parseRobots(txt, { userAgent: 'HomebaseSiteAudits' });
    expect(isAllowed('/')).toBe(true);
    expect(isAllowed('/admin')).toBe(false);
  });

  test('an empty Disallow value allows everything (no-op)', () => {
    const txt = `
      Sitemap: https://example.com/sitemap.xml
      User-agent: *
      Disallow:
    `;
    const { sitemaps, isAllowed } = parseRobots(txt);
    expect(sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(isAllowed('/anything')).toBe(true);
  });

  test('extracts multiple sitemap directives regardless of placement', () => {
    const txt = `
      User-agent: *
      Disallow: /admin
      Sitemap: https://example.com/sitemap1.xml
      Sitemap: https://example.com/sitemap2.xml
    `;
    const { sitemaps } = parseRobots(txt);
    expect(sitemaps).toEqual([
      'https://example.com/sitemap1.xml',
      'https://example.com/sitemap2.xml',
    ]);
  });

  test('ignores comments', () => {
    const txt = `
      # comment line
      User-agent: * # inline comment
      Disallow: /secret # another comment
    `;
    const { isAllowed } = parseRobots(txt);
    expect(isAllowed('/secret')).toBe(false);
    expect(isAllowed('/open')).toBe(true);
  });
});

describe('summarizeAiBots', () => {
  test('covers the AI user agents plus the wildcard group', () => {
    expect(AI_BOT_AGENTS).toEqual([
      'GPTBot',
      'ClaudeBot',
      'Google-Extended',
      'CCBot',
      'PerplexityBot',
    ]);
    const summary = summarizeAiBots('');
    expect(Object.keys(summary.byAgent)).toEqual(['*', ...AI_BOT_AGENTS]);
    expect(summary.blocked).toEqual([]);
    expect(summary.byAgent['*']).toBe('allow');
  });

  test('a wildcard Disallow: / blocks every AI bot', () => {
    const summary = summarizeAiBots('User-agent: *\nDisallow: /\n');
    expect(summary.byAgent['*']).toBe('disallow');
    for (const bot of AI_BOT_AGENTS) {
      expect(summary.byAgent[bot]).toBe('disallow');
    }
    expect(summary.blocked).toEqual([...AI_BOT_AGENTS]);
  });

  test('a bot-specific Allow overrides a wildcard Disallow: /', () => {
    const summary = summarizeAiBots(`
      User-agent: *
      Disallow: /

      User-agent: GPTBot
      Allow: /
    `);
    expect(summary.byAgent.GPTBot).toBe('allow');
    expect(summary.byAgent.ClaudeBot).toBe('disallow');
    expect(summary.byAgent['Google-Extended']).toBe('disallow');
    expect(summary.blocked).not.toContain('GPTBot');
    expect(summary.blocked).toContain('ClaudeBot');
  });

  test('a bot-specific Disallow: / blocks only that bot', () => {
    const summary = summarizeAiBots(`
      User-agent: Google-Extended
      Disallow: /

      User-agent: *
      Allow: /
    `);
    expect(summary.byAgent['Google-Extended']).toBe('disallow');
    expect(summary.byAgent.GPTBot).toBe('allow');
    expect(summary.byAgent.CCBot).toBe('allow');
    expect(summary.byAgent.PerplexityBot).toBe('allow');
    expect(summary.byAgent.ClaudeBot).toBe('allow');
    expect(summary.blocked).toEqual(['Google-Extended']);
  });

  test('Disallow of a subpath does not mark the root as blocked', () => {
    const summary = summarizeAiBots(`
      User-agent: *
      Disallow: /admin

      User-agent: CCBot
      Disallow: /private
      Allow: /
    `);
    expect(summary.byAgent['*']).toBe('allow');
    expect(summary.byAgent.CCBot).toBe('allow');
    expect(summary.blocked).toEqual([]);
  });

  test('Disallow: / still blocks the bot when a longer path is allowed', () => {
    const summary = summarizeAiBots(`
      User-agent: ClaudeBot
      Disallow: /
      Allow: /public
    `);
    expect(summary.byAgent.ClaudeBot).toBe('disallow');
    expect(summary.blocked).toContain('ClaudeBot');
    expect(summary.byAgent.GPTBot).toBe('allow');
  });
});
