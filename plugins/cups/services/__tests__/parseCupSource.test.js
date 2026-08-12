const {
  parseCupSource,
  detectCupSourceProfile,
  resolveMaybeRelativeUrl,
} = require('../parseCupSource');

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

  test('Västmanland: Cupnamn table inside accordion prefers svff_table (not accordion title)', () => {
    const html = `
      <div class="accordion__item">
        <button class="accordion__header">Sanktionerade cuper</button>
        <div class="accordion__content">
          <table>
            <tr><th>Datum</th><th>Cupnamn</th><th>Åldersgrupp</th><th>Arrangör</th></tr>
            <tr><td>14-15 feb. 2026</td><td>Byggmästercup</td><td>PF8-13</td><td>Västerås IK</td></tr>
            <tr><td>14 feb. 2026</td><td>Elasticofutsalcup</td><td>P10</td><td>Elastico FC</td></tr>
            <tr><td>20-22 mars 2026</td><td>Västeråscupen</td><td>PF13-15</td><td>IK Franke</td></tr>
          </table>
        </div>
      </div>
      <p>Caroline Larsson Tävlingskonsulent Ungdom caroline@vff.se</p>
    `;
    const url = 'https://vastmanland.svenskfotboll.se/tavling/cuper/';
    expect(detectCupSourceProfile(html, url, 'html')).toBe('svff_table');
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Byggmästercup', 'Elasticofutsalcup', 'Västeråscupen']),
    );
    expect(items.every((i) => i.name !== 'Sanktionerade cuper')).toBe(true);
    expect(items.length).toBe(3);
  });

  test('Dalarna: h3 + Arrangör/Datum/Spelort (not Jämtland paragraph blob names)', () => {
    const html = `
      <main>
        <div class="rich-text">
          <h2>Cuper 2026</h2>
          <h3>Forssacupen 2026</h3>
          <p><strong>Arrangör:</strong> Forssa BK<br />
          <strong>Datum:</strong> 9-11/1 2026<br />
          <strong>Spelort:</strong> Borlänge<br />
          <strong>Åldersgrupp:</strong> Seniorer Dam och Seniorer Herr<br />
          <strong>Hemsida: </strong><a href="https://www.procup.se/cup/39566.htm">Forssacupen</a></p>
          <h3>Falu sommarcup</h3>
          <p><strong>Arrangör:</strong> Korsnäs IF FK<br />
          <strong>Datum:</strong> 12/6-14/6 2026<br />
          <strong>Spelort:</strong> Falun<br />
          <strong>Åldersgrupp:</strong> F/P10/11</p>
        </div>
      </main>
    `;
    const url = 'https://www.dalafotboll.nu/tavling/administration/cuper-i-dalarna/';
    expect(detectCupSourceProfile(html, url, 'html')).toBe('dalarna_h3_labeled');
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Forssacupen 2026');
    expect(items[0].organizer).toBe('Forssa BK');
    expect(items[0].location).toBe('Borlänge');
    expect(items[0].start_date).toBeTruthy();
    expect(items[0].registration_url).toContain('procup.se');
    expect(items[1].name).toBe('Falu sommarcup');
    expect(items.every((i) => !String(i.name).startsWith('Arrangör:'))).toBe(true);
  });

  it('clamps invalid calendar days from district typos (e.g. 31/9)', () => {
    const html = `
      <main>
        <div class="rich-text">
          <h2>Cuper 2026</h2>
          <h3>ICA Kvarnen Ligan</h3>
          <p><strong>Arrangör:</strong> Kvarnsvedens IK<br />
          <strong>Datum:</strong> 1/5-31/9<br />
          <strong>Spelort:</strong> Borlänge<br />
          <strong>Åldersgrupp:</strong> F/P 7</p>
        </div>
      </main>
    `;
    const url = 'https://www.dalafotboll.nu/tavling/administration/cuper-i-dalarna/';
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(1);
    expect(items[0].start_date).toBe('2026-05-01');
    expect(items[0].end_date).toBe('2026-09-30');
  });

  it('Dalarna: extracts Datum when label is inside strong with br (dalafotboll markup)', () => {
    const html = `
      <main>
        <div class="rich-text">
          <h2>Cuper 2026</h2>
          <h3><strong>Aprilcupen</strong></h3>
          <p><strong>Arrangör: </strong>Forssa BK<strong><br />Datum: </strong>25-26/4<strong><br />Spelort: </strong>Borlänge<strong><br />Åldersgrupp: </strong>F/P2014-2016</p>
        </div>
      </main>
    `;
    const url = 'https://www.dalafotboll.nu/tavling/administration/cuper-i-dalarna/';
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Aprilcupen');
    expect(items[0].organizer).toBe('Forssa BK');
    expect(items[0].location).toBe('Borlänge');
    expect(items[0].categories).toMatch(/F\/P2014/);
    expect(items[0].start_date).toBe('2026-04-25');
    expect(items[0].end_date).toBe('2026-04-26');
  });

  it('Gästrikland: Beviljade cuper ul/li with name, organizer, categories, date', () => {
    const html = `
      <article>
        <p><strong>Beviljade cuper 2026</strong></p>
        <p><strong>Fotboll</strong></p>
        <ul>
          <li>Valbocupen, Valbo FF, Dam (senior), 30/1 - 1/2</li>
          <li>Godiscupen, Gävle GIK FK, P2013 och P2016 och P2017, 13-15/2</li>
          <li>HIF-cupen 2026, Hedesunda IF, 10-12 år (7mot7), 22-23/8</li>
        </ul>
        <p><strong>Futsal</strong></p>
        <ul>
          <li>Bilma Cup, Ockelbo IF, dam/herr, 9-11/1</li>
          <li>Göransson Cup, Sandvikens IF, ungdom, 30/1 - 2/2</li>
        </ul>
      </article>
    `;
    const url = 'https://gestrikland.svenskfotboll.se/tavling/adminstration/tillstandsansokan/';
    expect(detectCupSourceProfile(html, url, 'html')).toBe('svff_beviljade_list');
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({
      name: 'Valbocupen',
      organizer: 'Valbo FF',
      categories: 'Dam (senior)',
      start_date: '2026-01-30',
      end_date: '2026-02-01',
    });
    expect(items[1].name).toBe('Godiscupen');
    expect(items[1].start_date).toBe('2026-02-13');
    expect(items[1].end_date).toBe('2026-02-15');
    expect(items[2].match_format).toMatch(/7\s*mot\s*7/i);
    expect(items[3].name).toBe('Bilma Cup');
    expect(items[3].categories).toMatch(/Futsal/i);
    expect(items[4].start_date).toBe('2026-01-30');
    expect(items[4].end_date).toBe('2026-02-02');
  });

  it('Småland: multi-weekend Datum 14-15, 21-22, 28-29/11 yields ISO range', () => {
    const html = `
      <p>Tävlingens namn: Novembercupen</p>
      <p>Arrangör: IF Test</p>
      <p>Datum: 14-15, 21-22, 28-29/11</p>
      <p>Plats: Växjö</p>
      <p>Ålder: P12</p>
    `;
    const url = 'https://www.smalandboll.se/cuper';
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(1);
    expect(items[0].start_date).toBe('2026-11-14');
    expect(items[0].end_date).toBe('2026-11-29');
    expect(items[0].description).toMatch(/14-15, 21-22, 28-29\/11/);
  });

  it('Stockholm PDF: skips page numbers and parses april/juni + cross-year dates', () => {
    const text = `
Sanktionerade cuper 2025-2026
Cupens namn Arrangör Datum Kategorier Länk till hemsida
Qarsob Cup Afghanska FF 24 dec Herr
ST-cupen Tyresö FF 26 dec – 6 jan Dam-F2017
GF Cupen FC Stockholm Internazionale 4-5 april P2014
Juni 5:an Bele Barkarby FF 13-14 juni F/P2017-2018
JOHAN WALLBERG
2
3
Mini Tiger Cup Spårvägens FF 14-16 aug F/P2014-2019 Hemsida
`;
    const url =
      'https://www.stff.se/globalassets/distrikt/stockholm/dokument/tavling/2026/cuper/sanktionerade-cuper-2025-26.pdf';
    expect(detectCupSourceProfile(text, url, 'pdf')).toBe('stockholm_pdf_table');
    const items = parseCupSource({ html: text, sourceUrl: url, sourceType: 'pdf' });
    expect(items.every((i) => !/^\d+$/.test(i.name))).toBe(true);
    expect(items.every((i) => !/WALLBERG|Sanktionerade/i.test(i.name))).toBe(true);
    const gf = items.find((i) => /GF Cupen/i.test(i.name));
    expect(gf).toBeTruthy();
    expect(gf.start_date).toBe('2026-04-04');
    expect(gf.end_date).toBe('2026-04-05');
    expect(gf.organizer).toMatch(/Stockholm Internazionale/i);
    const juni = items.find((i) => /Juni 5/i.test(i.name));
    expect(juni?.start_date).toBe('2026-06-13');
    const st = items.find((i) => /ST-cupen/i.test(i.name));
    expect(st?.start_date).toBe('2026-12-26');
    expect(st?.end_date).toBe('2027-01-06');
    const mini = items.find((i) => /Mini Tiger/i.test(i.name));
    expect(mini?.start_date).toBe('2026-08-14');
  });

  it('Uppland: structured description + info link from following paragraph', () => {
    const html = `
      <main>
        <p><strong>6/6 Nationaldagscupen</strong><br />
        Arr. förening: Roslagsbro IF<br />
        Kontaktperson: <a href="mailto:nationaldagscupen@roslagsbroif.se">Helena Gräns</a></p>
        <p><a href="https://www.cupmate.nu/cup/roslagsbro-if-ungdom-nationaldagscupen">Klicka här för information om cupen.</a></p>
        <p><strong>12/6 - 14/6 Rimbo Cup</strong><br />
        Arr. förening: Rimbo IF<br />
        Kontaktsperson: <a href="mailto:cup@rimboif.com">Anders Lindberg</a></p>
        <p><a href="https://www.procup.se/cup/39721.htm">Klicka här för information om cupen.</a></p>
      </main>
    `;
    const url = 'https://uppland.svenskfotboll.se/tavling/cuper2/';
    expect(detectCupSourceProfile(html, url, 'html')).toBe('svff_paragraph_list');
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Nationaldagscupen');
    expect(items[0].organizer).toBe('Roslagsbro IF');
    expect(items[0].start_date).toBe('2026-06-06');
    expect(items[0].registration_url).toContain('cupmate.nu');
    expect(items[0].description).toMatch(/^Arrangör:/m);
    expect(items[0].description).toMatch(/^Datum:/m);
    expect(items[0].description).toMatch(/^Kontakt:/m);
    expect(items[0].description).toMatch(/Helena Gräns/);
    expect(items[0].description).toMatch(/E-post:/);
    expect(items[0].description).not.toMatch(/Arr\. förening:.*Kontaktperson:/);
    expect(items[1].name).toBe('Rimbo Cup');
    expect(items[1].registration_url).toContain('procup.se');
    expect(items[1].description).toMatch(/^Kontakt:/m);
  });

  it('Halland: extracts dates, organizer, speltid and splits description', () => {
    const html = `
      <div class="accordion__item">
        <button class="accordion__expand-button">
          <span class="accordion__text">IFC Cupen Halmstad (okt)</span>
        </button>
        <div class="accordion__content">
          <p><strong>Arrangerande förening:</strong> IF Centern<br />
          <strong>Startdatum:</strong> 2026-10-03. S<strong>lutdatum:</strong> 2026-10-04.</p>
          <p><strong>Aktuella kategorier:<br /></strong>Flickor 10-12 år, pojkar 8-9 år.</p>
          <p><strong>Aktuella spelformer: </strong>7mot7 med 2 perioder.<br />
          <strong>Speltid minuter/period i spelformen 7v7:</strong> 2x12 minuter.<br />
          <strong>Tävlingsform:</strong> Serie.<br />
          <strong>Antal lag, totalt, som kan delta:</strong> 100.</p>
          <p><strong>Tävlingens upplägg, organisation och genomförande:</strong> IFC Cupen genomförs som en avslutande cup.</p>
          <p><strong>Webbadress till anmälan: </strong>https://www.procup.se/cup/40343.htm</p>
          <p><strong>Kontaktperson:</strong> Mikael Winterquist<br />
          <strong>E-post kontaktperson: </strong>mikael@example.com<br />
          <strong>Mobilnummer kontaktperson:</strong> 0707-610098</p>
        </div>
      </div>
      <div class="accordion__item">
        <button class="accordion__expand-button">
          <span class="accordion__text">Vintercupen (dec)</span>
        </button>
        <div class="accordion__content">
          <p><strong>Arrangerande förening:</strong> Test IF<br />
          <strong>Startdatum:</strong> 2026-12-27. <strong>Slutdatum:</strong> 2026-12-28.</p>
          <p><strong>Beskrivning av tävlingen:</strong> Spelas 27-28 dec i Kollaskolans idrottshall. 12 lag per klass.</p>
        </div>
      </div>
    `;
    const url = 'https://halland.svenskfotboll.se/tavling/cuper/';
    expect(detectCupSourceProfile(html, url, 'html')).toBe('skane_accordion');
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('IFC Cupen Halmstad (okt)');
    expect(items[0].organizer).toBe('IF Centern');
    expect(items[0].start_date).toBe('2026-10-03');
    expect(items[0].end_date).toBe('2026-10-04');
    expect(items[0].location).toBe('Halmstad');
    expect(items[0].categories).toMatch(/Flickor/);
    expect(items[0].match_format).toMatch(/7\s*vs\s*7/i);
    expect(items[0].team_count).toBe(100);
    expect(items[0].registration_url).toContain('procup.se');
    expect(items[0].description).toMatch(/Arrangör:/);
    expect(items[0].description).toMatch(/Speltid:/);
    expect(items[0].description).toMatch(/IFC Cupen genomförs/);
    expect(items[0].description).not.toMatch(/Föreningen intygar/);
    expect(items[1].location).toMatch(/Kollaskolans idrottshall/i);
    expect(items[1].start_date).toBe('2026-12-27');
  });

  it('Värmland: only Cuptillstånd accordion cups (not other dokumentbank accordions)', () => {
    const html = `
      <div class="accordion">
        <div class="accordion__item">
          <button class="accordion__expand-button">
            <span class="accordion__text">Dispenser 2026</span>
          </button>
          <div class="accordion__content"><p>Irrelevant</p></div>
        </div>
        <div class="accordion__item">
          <button class="accordion__expand-button">
            <span class="accordion__text">Cuptillstånd 2026</span>
          </button>
          <div class="accordion__content">
            <h2>JANUARI - 2026</h2>
            <h3>Matchcamp</h3>
            <p>Åldersgrupp: Pojkar 2013<br />Datum: 2 januari<br />Arrangörsförening: IF Karlstad Fotboll</p>
            <h3>Hertzöga BK:s Inomhuscup (F)</h3>
            <p>Åldersgrupp: Senior herrar<br />Datum: 6 januari<br />Arrangörsförening: Hertzöga BK</p>
            <h3>Woody's FC och Intersport Cup</h3>
            <p>Åldersgrupp: Senior herrar<br />Datum: 6 januari<br />Arrangörsförening: Woody's FC<br />
            <a href="/docs/inbjudan-woodys.pdf" target="_blank">Inbjudan &gt;&gt;</a></p>
            <h3>Lux Hyer Invite G2013</h3>
            <p>Åldersgrupp: Flickor 2013<br />Datum: 30 januari-1 februari<br />Arrangörsförening: IFK Kristinehamn Fotboll</p>
            <h2>FEBRUARI - 2026</h2>
            <h3>Actemium Cup</h3>
            <p>Åldersgrupp: Senior herrar<br />Datum: 27 februari - 1 mars<br />Arrangör: Värmlands FF</p>
          </div>
        </div>
      </div>
    `;
    const url = 'https://www.varmlandsff.se/tavling/dokumentbank-ny/';
    expect(detectCupSourceProfile(html, url, 'html')).toBe('varmland_cuptillstand');
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.name)).not.toContain('Dispenser 2026');
    expect(items[0]).toMatchObject({
      name: 'Matchcamp',
      organizer: 'IF Karlstad Fotboll',
      categories: 'Pojkar 2013',
      start_date: '2026-01-02',
      end_date: '2026-01-02',
    });
    expect(items[1].match_format).toBe('Futsal');
    expect(items[2].registration_url).toBe('https://www.varmlandsff.se/docs/inbjudan-woodys.pdf');
    expect(items[3].start_date).toBe('2026-01-30');
    expect(items[3].end_date).toBe('2026-02-01');
    expect(items[4].start_date).toBe('2026-02-27');
    expect(items[4].end_date).toBe('2026-03-01');
    expect(items[4].organizer).toBe('Värmlands FF');
  });

  it('resolveMaybeRelativeUrl allows only http(s) (blocks data: and javascript:)', () => {
    const base = 'https://www.varmlandsff.se/tavling/dokumentbank-ny/';
    expect(resolveMaybeRelativeUrl('/docs/inbjudan.pdf', base)).toBe(
      'https://www.varmlandsff.se/docs/inbjudan.pdf',
    );
    expect(resolveMaybeRelativeUrl('https://example.com/a.pdf', base)).toBe(
      'https://example.com/a.pdf',
    );
    expect(resolveMaybeRelativeUrl('http://example.com/a.pdf', base)).toBe(
      'http://example.com/a.pdf',
    );
    expect(resolveMaybeRelativeUrl('data:text/html,xss', base)).toBeNull();
    expect(resolveMaybeRelativeUrl('javascript:alert(1)', base)).toBeNull();
    expect(resolveMaybeRelativeUrl('#section', base)).toBeNull();
    expect(resolveMaybeRelativeUrl('//evil.example/phish', base)).toBe(
      'https://evil.example/phish',
    );
  });

  it('Värmland: drops non-http(s) Inbjudan hrefs', () => {
    const html = `
      <div class="accordion__item">
        <button class="accordion__expand-button">
          <span class="accordion__text">Cuptillstånd 2026</span>
        </button>
        <div class="accordion__content">
          <h2>JANUARI - 2026</h2>
          <h3>Bad Link Cup</h3>
          <p>Åldersgrupp: Senior herrar<br />Datum: 6 januari<br />Arrangörsförening: Test IF<br />
          <a href="data:text/html,xss">Inbjudan &gt;&gt;</a></p>
        </div>
      </div>
    `;
    const url = 'https://www.varmlandsff.se/tavling/dokumentbank-ny/';
    const items = parseCupSource({ html, sourceUrl: url, sourceType: 'html' });
    expect(items).toHaveLength(1);
    expect(items[0].registration_url).toBeNull();
  });
});
