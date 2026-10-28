const { compareSummaries } = require('../compare');

describe('compareSummaries', () => {
  test('computes per-category and overall score deltas (site minus competitor)', () => {
    const site = {
      score: 80,
      categories: { indexing: 90, content: 70, technical: 85, sharing: 60 },
    };
    const competitor = {
      score: 60,
      categories: { indexing: 50, content: 80, technical: 65, sharing: 55 },
    };

    const result = compareSummaries(site, competitor);

    expect(result.siteScore).toBe(80);
    expect(result.competitorScore).toBe(60);
    expect(result.scoreDelta).toBe(20);
    expect(result.categories.indexing).toEqual({ site: 90, competitor: 50, delta: 40 });
    expect(result.categories.content).toEqual({ site: 70, competitor: 80, delta: -10 });
  });

  test('tolerates missing data by treating absent scores as 0', () => {
    const result = compareSummaries(null, { score: 40, categories: { indexing: 40 } });
    expect(result.siteScore).toBeNull();
    expect(result.competitorScore).toBe(40);
    expect(result.scoreDelta).toBe(-40);
    expect(result.categories.indexing).toEqual({ site: 0, competitor: 40, delta: -40 });
  });
});
