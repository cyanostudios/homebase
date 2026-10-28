// plugins/site-audits/services/compare.js
// Pure comparison of two analyzeSite() summaries (site vs. competitor), by category score.
const CATEGORIES = ['indexing', 'content', 'technical', 'sharing'];

/**
 * @param {ReturnType<typeof import('./scoring').analyzeSite>} siteSummary
 * @param {ReturnType<typeof import('./scoring').analyzeSite>} competitorSummary
 */
function compareSummaries(siteSummary, competitorSummary) {
  const categories = {};
  for (const category of CATEGORIES) {
    const site = siteSummary?.categories?.[category] ?? 0;
    const competitor = competitorSummary?.categories?.[category] ?? 0;
    categories[category] = { site, competitor, delta: site - competitor };
  }

  const siteScore = siteSummary?.score ?? null;
  const competitorScore = competitorSummary?.score ?? null;

  return {
    siteScore,
    competitorScore,
    scoreDelta: (siteScore ?? 0) - (competitorScore ?? 0),
    categories,
  };
}

module.exports = { compareSummaries, CATEGORIES };
