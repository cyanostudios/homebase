const { parseCupSource, detectCupSourceProfile } = require('../parseCupSource');

describe('parseCupSource (light fixtures)', () => {
  test('detects svff_table profile for Cupnamn HTML table', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>Cupnamn</th><th>Datum</th><th>Arrangör</th></tr>
          <tr><td>Testcupen</td><td>1-2 juni</td><td>IFK Test</td></tr>
        </table>
      </body></html>
    `;
    expect(detectCupSourceProfile(html, 'https://vasterbotten.svenskfotboll.se/cups', 'html')).toBe(
      'svff_table',
    );
  });

  test('parseCupSource returns named cups from svff_table', () => {
    const html = `
      <table>
        <tr><th>Cupnamn</th><th>Datum</th><th>Arrangör</th><th>Åldersgrupp</th></tr>
        <tr><td>Sommarcupen</td><td>10-12 juni</td><td>FC Example</td><td>P12</td></tr>
        <tr><td>Höstcupen</td><td>1-2 sep</td><td>BK Demo</td><td>F13</td></tr>
      </table>
    `;
    const items = parseCupSource({
      html,
      sourceUrl: 'https://example.svenskfotboll.se/cups',
      sourceType: 'html',
    });
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.map((i) => i.name)).toEqual(expect.arrayContaining(['Sommarcupen', 'Höstcupen']));
    expect(items.every((i) => i.external_id)).toBe(true);
  });

  test('empty html yields empty list', () => {
    expect(
      parseCupSource({ html: '', sourceUrl: 'https://example.com', sourceType: 'html' }),
    ).toEqual([]);
  });
});
