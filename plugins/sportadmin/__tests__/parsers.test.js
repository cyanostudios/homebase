const fs = require('fs');
const path = require('path');

const { discoverFromStartHtml } = require('../discovery/discoverFromHtml');
const { parseNewsDetail, parseNewsListFromHtml } = require('../parser/NewsParser');
const { parseMatchList, parseMatchDetail } = require('../parser/MatchParser');
const { parseCalendarAjax } = require('../parser/CalendarParser');
const { parseTeamFromDiscovery } = require('../parser/TeamParser');
const { parseClubPage } = require('../parser/PageParser');
const { discoverTeamModules, parseGroupPage } = require('../parser/GroupParser');
const { parseOrganization } = require('../parser/OrganizationParser');
const { normalizeResource, hashPayload } = require('../normalizer/normalize');
const { sanitizeHtml, sanitizeUrl } = require('../sanitize/sanitize');

const FIX = path.join(__dirname, '../__fixtures__');

function read(name) {
  return fs.readFileSync(path.join(FIX, name), 'utf8');
}

describe('SportAdmin parsers (fixtures)', () => {
  test('discovery finds org, teams, news, match, calendar sections', () => {
    const html = read('start.html');
    const d = discoverFromStartHtml(html, 'https://sorgenfriff.web.sportadmin.se/start/?ID=471967');
    expect(d.isSportAdmin).toBe(true);
    expect(d.orgName).toMatch(/Sorgenfri/i);
    expect(d.teams.length).toBeGreaterThanOrEqual(10);
    expect(d.teams.some((t) => t.sid === '54748')).toBe(true);
    expect(d.sections.news).toMatch(/nyheter/i);
    expect(d.sections.matches).toMatch(/match/i);
    expect(d.sections.calendar).toMatch(/kalender/i);
    expect(d.newsTeasers.length).toBeGreaterThan(0);
    expect(d.pages.length).toBeGreaterThanOrEqual(4);
    expect(d.pages.some((p) => p.kind === 'sida' && /Om Sorgenfri/i.test(p.name))).toBe(true);
    expect(d.pages.some((p) => p.kind === 'sida' && /Avgift/i.test(p.name))).toBe(true);
    expect(d.pages.some((p) => p.kind === 'start')).toBe(true);
    expect(d.pages.every((p) => !d.teams.some((t) => p.href.includes(`SID=${t.sid}`)))).toBe(true);
  });

  test('organization parser returns name and logo', () => {
    const html = read('start.html');
    const d = discoverFromStartHtml(html, 'https://sorgenfriff.web.sportadmin.se/start/?ID=471967');
    const org = parseOrganization(
      html,
      'https://sorgenfriff.web.sportadmin.se/start/?ID=471967',
      d,
    );
    expect(org.name).toMatch(/Sorgenfri/i);
    expect(org.type).toBe('organization');
  });

  test('team parser uses SID and extracts page body text + match lists', () => {
    const html = read('team-sid-54748.html');
    const team = parseTeamFromDiscovery(
      {
        sid: '54748',
        name: 'Fotbollsskola Flickor',
        category: 'Fotbollsskola',
        href: 'https://x/?SID=54748',
      },
      'https://sorgenfriff.web.sportadmin.se/?SID=54748',
      html,
    );
    expect(team.source_id).toBe('54748');
    expect(team.category).toBe('Fotbollsskola');
    expect(team.heading).toMatch(/fotbollsskola flickor/i);
    expect(team.description).toMatch(/medlemsavgift/i);
    expect(team.description.length).toBeGreaterThan(120);
    expect(team.upcoming_matches.length).toBeGreaterThan(0);
    expect(team.played_matches.length).toBeGreaterThan(0);
    expect(team.upcoming_matches[0].title.length).toBeGreaterThan(2);
    expect(team.modules.roster).toMatch(/\/grupp\/.*ID=472284/i);
    expect(team.modules.contact).toMatch(/\/sida\/.*ID=472285/i);
    expect(team.modules.matches).toMatch(/\/match\/.*ID=472286/i);
    expect(team.modules.news).toMatch(/\/nyheter\//i);
    expect(team.modules.calendar).toMatch(/\/kalender\//i);
  });

  test('team modules discovery skips gallery and parses truppen + kontakt', () => {
    const teamHtml = read('team-sid-54748.html');
    const modules = discoverTeamModules(
      teamHtml,
      'https://sorgenfriff.web.sportadmin.se/?SID=54748',
    );
    expect(modules.roster).toMatch(/grupp/i);
    expect(modules.contact).toMatch(/sida/i);
    expect(JSON.stringify(modules)).not.toMatch(/galleri/i);

    const group = parseGroupPage(
      read('team-grupp-472284.html'),
      'https://sorgenfriff.web.sportadmin.se/grupp/?ID=472284',
    );
    expect(group.players.length).toBeGreaterThanOrEqual(30);
    expect(group.players[0].name.length).toBeGreaterThan(2);
    expect(group.leaders.length).toBeGreaterThanOrEqual(1);
    expect(group.leaders[0].name.length).toBeGreaterThan(2);

    const normalized = normalizeResource({
      type: 'team',
      source_id: '54748',
      name: 'Fotbollsskola Flickor',
      modules,
      players: group.players,
      leaders: group.leaders,
      contact: 'Mail: fotbollsskolan.flickor@sorgenfriff.se',
      source_url: 'https://sorgenfriff.web.sportadmin.se/?SID=54748',
    });
    expect(normalized.payload.players.length).toBeGreaterThanOrEqual(30);
    expect(normalized.payload.leaders.length).toBeGreaterThanOrEqual(1);
    expect(normalized.payload.contact).toMatch(/fotbollsskolan\.flickor@sorgenfriff\.se/i);
    expect(normalized.payload.modules.roster).toMatch(/grupp/i);
  });

  test('team parser strips news teaser blocks that lack a news CSS class', () => {
    const mixed = `
      <div class=inner>
        <section id='Welcome'><span class=rub title='Welcome'>Welcome to the team</span></section>
        <p>Team intro about fees and training.</p>
        <p>Alla medlemmar betalar en medlemsavgift.</p>
        <section id='News item'><span class=rub title='News item'><a target=_top href=../nyheter/?ID=1&NID=99>News item</a></span></section>
        <div><span style=font-size:11px;color:#888888>2026-08-24 12:00</span></div>
        <div class=imgDiv><a href="javascript:openBox('https://cdn.sportadmin.se/news99_L.jpg')"><img src='https://cdn.sportadmin.se/news99_L.jpg'></a></div>
        <div><p>This is a long news body that should not appear in the team description at all.</p><p>Second paragraph of the news.</p></div>
        <div style=clear:both></div><div class=hr></div>
        <section id='Another'><span class=rub title='Another'><a href='../nyheter/?ID=1&NID=100'>Another news</a></span></section>
        <p>More news text</p>
      </div><div class=tbl2><div class='nyhetsflode'></div></div>
    `;
    const team = parseTeamFromDiscovery(
      { sid: '1', name: 'P10', category: 'Pojklag', href: 'https://x/?SID=1' },
      'https://x/?SID=1',
      mixed,
    );
    expect(team.description).toMatch(/medlemsavgift/i);
    expect(team.description).toMatch(/Team intro/i);
    expect(team.description).not.toMatch(/News item/i);
    expect(team.description).not.toMatch(/should not appear/i);
    expect(team.description).not.toMatch(/More news text/i);
    expect(team.heading).toMatch(/Welcome to the team/i);
    expect(team.news_items).toHaveLength(2);
    expect(team.news_items[0].title).toMatch(/News item/i);
    expect(team.news_items[0].nid).toBe('99');
    expect(team.news_items[0].when).toMatch(/2026-08-24/);
    expect(team.news_items[0].image_url).toMatch(/cdn\.sportadmin\.se\/news99_L\.jpg/);
    expect(team.news_items[0].body).toMatch(/long news body/i);
    expect(team.news_items[0].body).toMatch(/Second paragraph/i);
    expect(team.news_items[0].source_url).toMatch(/NID=99/);
    expect(team.news_items[1].nid).toBe('100');
    expect(team.news_items[1].image_url).toBeNull();
    expect(team.news_items[1].body).toMatch(/More news text/i);
  });

  test('team parser extracts description image from editorial imgDiv', () => {
    const html = `
      <div class=inner>
        <section id='Welcome'><span class=rub>Welcome</span></section>
        <div class=imgDiv><a href="javascript:openBox('/images/team/hero.png')"><img src='/images/team/hero.png'></a></div>
        <p>Team intro about fees and training with enough characters here.</p>
        <section id='News'><span class=rub><a href='../nyheter/?NID=1'>News</a></span></section>
        <div class=imgDiv><img src='https://cdn.sportadmin.se/news.jpg'></div>
      </div>
    `;
    const team = parseTeamFromDiscovery(
      { sid: '9', name: 'P10', category: 'Pojklag', href: 'https://example.com/?SID=9' },
      'https://example.com/?SID=9',
      html,
    );
    expect(team.description_image_url).toMatch(/https:\/\/example\.com\/images\/team\/hero\.png/);
    expect(team.description_image_url).not.toMatch(/news\.jpg/);
    expect(team.description).toMatch(/Team intro/i);
  });

  test('description image prefers welcome .inner over longer news collage', () => {
    // F16-style (start/?ID=472267): short welcome with hero, then a longer NID news collage.
    const longNewsPadding = 'x'.repeat(2500);
    const html = `
      <div class=inner>
        <section id='Welcome F16'><span class=rub title='Welcome F16'>Welcome F16</span></section>
        <div class=imgDiv style='margin-top:5px'><div style='display:inline-block'>
          <a href="javascript:openBox('https://cdn.sportadmin.se/2563/h/1919/hero_L.jpg')">
            <img src='https://cdn.sportadmin.se/2563/h/1919/hero_L.jpg'>
          </a>
        </div></div>
        <p>Medlemsavgift and training schedule for the team page body.</p>
      </div>
      <div class=inner>
        <section id='Long news'><span class=rub title='Long news'>
          <a target=_top href=../nyheter/?ID=1&NID=99>Long news collage</a>
        </span></section>
        <div id='kollageContainer99'>${longNewsPadding}</div>
        <div class=imgDiv><img src='https://cdn.sportadmin.se/news_collage.jpg'></div>
      </div>
    `;
    const team = parseTeamFromDiscovery(
      {
        sid: '54746',
        name: 'F16 (2010-2011)',
        category: 'Flicklag',
        href: 'https://example.com/?SID=54746',
      },
      'https://example.com/start/?ID=472267',
      html,
    );
    expect(team.description_image_url).toMatch(/hero_L\.jpg/);
    expect(team.description_image_url).not.toMatch(/news_collage/);
    expect(team.image_url).toMatch(/hero_L\.jpg/);
  });

  test('club page parser extracts sida body text', () => {
    const html = `
      <div class=inner>
        <section id='Avgifter 2026'><span class=rub title='Avgifter 2026'>Avgifter 2026</span></section>
        <div><p>Alla medlemmar betalar en medlemsavgift a 350 kr per år.</p>
        <p>Träningsavgiften är 1250 kronor per år.</p></div>
      </div>
      <style>.x{}</style>
      <div class=inner>chrome</div>
    `;
    const page = parseClubPage(
      {
        sourceId: 'sida:480418',
        pageId: '480418',
        kind: 'sida',
        name: 'Avgifter 2026',
        href: 'https://x/sida/?ID=480418',
      },
      'https://x/sida/?ID=480418',
      html,
    );
    expect(page.type).toBe('page');
    expect(page.source_id).toBe('sida:480418');
    expect(page.title).toMatch(/Avgifter/i);
    expect(page.heading).toMatch(/Avgifter 2026/i);
    expect(page.description).toMatch(/medlemsavgift/i);
    expect(page.description).toMatch(/1250/i);
  });

  test('club page parser reads sektion team/coach list pages', () => {
    const html = `
      <div class=inner style='max-width:100%'>
        <span class='rub'>Våra lag och tränare</span><br>
        <div style='margin-top:10px;'>
          <b class='rub' style=font-size:20px><a href='../?SID=54748'>Fotbollsskola Flickor</a></b>
          <div class='seperator'></div>
          <div class='infoBox'><div class='information'>Behrang Kianzad<span style=color:#888>, Ledare</span></div></div>
          <div class='infoBox'><div class='information'>Caroline Wingren<span style=color:#888>, Ledare</span></div></div>
          <b class='rub' style=font-size:20px><a href='../?SID=54749'>Fotbollsskola (P2021)</a></b>
          <div class='infoBox'><div class='information'>Eric Alftren<span style=color:#888>, Ledare</span></div></div>
        </div>
      </div>
    `;
    const page = parseClubPage(
      {
        sourceId: 'sektion:471974',
        pageId: '471974',
        kind: 'sektion',
        name: 'Våra lag och tränare',
        href: 'https://x/sektion/?ID=471974',
      },
      'https://x/sektion/?ID=471974',
      html,
    );
    expect(page.description).toMatch(/Fotbollsskola Flickor/i);
    expect(page.description).toMatch(/Behrang Kianzad/i);
    expect(page.description).toMatch(/<h3>/i);
    expect(page.description).toMatch(/<p>/i);
    expect(page.description).toMatch(/Ledare/i);
    expect(page.description).toMatch(/Fotbollsskola \(P2021\)/i);
    expect(page.description).toMatch(/Eric Alftren/i);
    expect(page.heading).toMatch(/lag och tränare/i);
  });

  test('news detail parser extracts title and NID', () => {
    const html = read('news-detail.html');
    const url = 'https://sorgenfriff.web.sportadmin.se/nyheter/?ID=471968&NID=1354232';
    const news = parseNewsDetail(html, url);
    expect(news.source_id).toBe('1354232');
    expect(news.title.length).toBeGreaterThan(3);
    expect(parseNewsListFromHtml(html, url).length).toBeGreaterThan(0);
  });

  test('match list and detail parsers extract AID and teams', () => {
    const listHtml = read('match-list.html');
    const listUrl = 'https://sorgenfriff.web.sportadmin.se/match/?ID=471975';
    const list = parseMatchList(listHtml, listUrl);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].aid).toMatch(/^\d+$/);

    const detailHtml = read('match-detail.html');
    const detailUrl = 'https://sorgenfriff.web.sportadmin.se/kalender/?ID=471975&AID=31236703';
    const match = parseMatchDetail(detailHtml, detailUrl, 'Sorgenfri FF');
    expect(match.source_id).toBe('31236703');
    expect(match.home_team || match.away_team).toBeTruthy();
  });

  test('calendar ajax parser finds AID events', () => {
    const html = read('calendar-ajax.html');
    const events = parseCalendarAjax(
      html,
      'https://sorgenfriff.web.sportadmin.se/kalender/ajaxKalender.asp?ID=471969',
    );
    expect(events.length).toBeGreaterThan(10);
  });
});

describe('SportAdmin normalize + sanitize', () => {
  test('normalize assigns stable id and hash; identical payload skips change', () => {
    const a = normalizeResource({
      type: 'news',
      source_id: '1',
      title: 'Hello',
      excerpt: 'x',
      content: '<p>Hi</p>',
      published_at: '2026-01-01',
      source_url: 'https://example.com/n',
      image_url: 'https://cdn.sportadmin.se/x.jpg',
    });
    const b = normalizeResource({
      type: 'news',
      source_id: '1',
      title: 'Hello',
      excerpt: 'x',
      content: '<p>Hi</p>',
      published_at: '2026-01-01',
      source_url: 'https://example.com/n',
      image_url: 'https://cdn.sportadmin.se/x.jpg',
    });
    expect(a.id).toBe('sportadmin:news:1');
    expect(a.content_hash).toBe(b.content_hash);
    expect(hashPayload(a.payload)).toHaveLength(64);
  });

  test('sanitize strips scripts and javascript urls', () => {
    const html = sanitizeHtml(
      '<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    );
    expect(html).toContain('<p>');
    expect(html).not.toMatch(/script/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://cdn.sportadmin.se/a.jpg')).toMatch(/^https:/);
  });
});
