const {
  aggregateResources,
  THIRD_PARTY_SCRIPT_HOST_INFO_THRESHOLD,
} = require('../resourceInventory');

describe('resourceInventory', () => {
  test('aggregates third-party script hosts across pages', () => {
    const summary = aggregateResources(
      [
        {
          url: 'https://example.com/',
          analysis: {
            resources: {
              scriptCount: 2,
              scriptSrcs: ['https://cdn.example.net/a.js', '/local.js'],
              stylesheetCount: 1,
              stylesheetHrefs: ['https://fonts.googleapis.com/css'],
              imageCount: 1,
              asyncScripts: 1,
              deferScripts: 0,
              hasManifest: true,
              hasServiceWorkerHint: false,
              missingDimensionSample: ['/img.png'],
            },
          },
        },
      ],
      'example.com',
    );
    expect(summary.thirdPartyScriptHostCount).toBe(1);
    expect(summary.thirdPartyScriptHosts).toContain('cdn.example.net');
    expect(summary.hasManifest).toBe(true);
    expect(summary.thirdPartyHostCount).toBeGreaterThanOrEqual(2);
    expect(THIRD_PARTY_SCRIPT_HOST_INFO_THRESHOLD).toBe(10);
  });
});
