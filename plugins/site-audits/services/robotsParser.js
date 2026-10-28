// plugins/site-audits/services/robotsParser.js
// Minimal robots.txt parser: groups by User-agent, longest-match Allow/Disallow resolution,
// and Sitemap directive extraction. Not a full spec implementation (no wildcard/$ anchors),
// but covers the common cases crawlers rely on for respecting robots.txt.

const DEFAULT_USER_AGENT = 'HomebaseSiteAudits';

/**
 * @param {string} text - raw robots.txt contents
 * @param {{ userAgent?: string }} [options]
 * @returns {{ sitemaps: string[], isAllowed: (path: string) => boolean, groups: Array }}
 */
function parseRobots(text, { userAgent = DEFAULT_USER_AGENT } = {}) {
  const lines = String(text || '').split(/\r?\n/);
  const groups = [];
  const sitemaps = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'user-agent') {
      // A new User-agent line after rules were already seen starts a new group; consecutive
      // User-agent lines (no rules in between) belong to the same group.
      if (!current || current.rules.length > 0) {
        current = { agents: [value.toLowerCase()], rules: [] };
        groups.push(current);
      } else {
        current.agents.push(value.toLowerCase());
      }
    } else if (key === 'allow' || key === 'disallow') {
      if (!current) {
        current = { agents: ['*'], rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: key, path: value });
    } else if (key === 'sitemap' && value) {
      sitemaps.push(value);
    }
  }

  /** Pick the most specific group for `agent`, falling back to the wildcard group. */
  function selectGroupFor(agent) {
    const lower = agent.toLowerCase();
    let wildcard = null;
    for (const group of groups) {
      if (group.agents.includes(lower)) {
        return group;
      }
      if (!wildcard && group.agents.includes('*')) {
        wildcard = group;
      }
    }
    return wildcard;
  }

  const targetGroup = selectGroupFor(userAgent) || selectGroupFor('*');

  /**
   * Longest-prefix-match wins (standard robots.txt resolution). An empty-path `Disallow:`
   * is a no-op (conventionally means "disallow nothing").
   * @param {string} pathToCheck
   */
  function isAllowed(pathToCheck) {
    if (!targetGroup || targetGroup.rules.length === 0) {
      return true;
    }
    const path = pathToCheck || '/';
    let matched = null;
    let matchedLength = -1;

    for (const rule of targetGroup.rules) {
      if (rule.path === '' && rule.type === 'disallow') {
        continue; // "Disallow:" with no value allows everything
      }
      if (path.startsWith(rule.path) && rule.path.length > matchedLength) {
        matched = rule;
        matchedLength = rule.path.length;
      }
    }

    return !matched || matched.type === 'allow';
  }

  return { sitemaps, isAllowed, groups };
}

// AI crawlers Sitegrade-style reports call out. `*` is included so a wildcard
// `Disallow: /` is visible even when no bot-specific group exists.
const AI_BOT_AGENTS = Object.freeze([
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'CCBot',
  'PerplexityBot',
]);

/**
 * Root allow/disallow for `*` and the AI bots. A bot is `disallow` only when its
 * applicable group blocks `/` (specific group, else `*`). A narrower `Disallow: /admin`
 * does not count — the warning is for a root block. Group precedence is the same
 * heuristic as {@link parseRobots} (SA-R6).
 * @param {string} text
 * @returns {{ byAgent: Record<string, 'allow'|'disallow'>, blocked: string[] }}
 */
function summarizeAiBots(text) {
  const agents = ['*', ...AI_BOT_AGENTS];
  const byAgent = {};
  for (const agent of agents) {
    const parsed = parseRobots(text, { userAgent: agent });
    byAgent[agent] = parsed.isAllowed('/') ? 'allow' : 'disallow';
  }
  return {
    byAgent,
    blocked: AI_BOT_AGENTS.filter((agent) => byAgent[agent] === 'disallow'),
  };
}

module.exports = { parseRobots, summarizeAiBots, AI_BOT_AGENTS, DEFAULT_USER_AGENT };
