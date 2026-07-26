const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('public-app AppShell patterns (ported from Cupappen)', () => {
  const css = read('styles.css');
  const html = read('index.html');
  const js = read('app.js');
  const item = read('item.php');

  test('header uses fixed --header-h and independent --header-logo-h', () => {
    expect(css).toMatch(/--header-h:\s*4rem/);
    expect(css).toMatch(/--header-logo-h:\s*4\.5rem/);
    expect(css).toMatch(/height:\s*var\(--header-h\)/);
    expect(css).toMatch(/height:\s*var\(--header-logo-h\)/);
  });

  test('top-bar frosted glass uses ~0.5 white + blur saturate', () => {
    expect(css).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.5\)/);
    expect(css).toMatch(/saturate\(160%\)/);
    expect(css).toMatch(/\.top-bar__inner[\s\S]*?padding:\s*0\s+var\(--page-pad\)/);
  });

  test('hero-band wraps home hero, shared-filter slot, and quick-nav', () => {
    expect(html).toMatch(/id="hero-band"/);
    expect(html).toMatch(/id="home-hero"/);
    expect(html).toMatch(/id="shared-filter"/);
    const band = html.match(/id="hero-band"[\s\S]*?<\/div>\s*\n\s*<p id="status"/);
    expect(band).toBeTruthy();
    expect(band[0]).toMatch(/id="quick-nav"/);
    expect(css).toMatch(/\.hero-band\s*\{/);
    expect(js).toMatch(/syncHeroVisibility/);
  });

  test('info panel + display font tokens exist', () => {
    expect(css).toMatch(/--font-display/);
    expect(css).toMatch(/\.info-panel__title/);
    expect(js).toMatch(/renderInfoPanel/);
  });

  test('item detail header shares AppShell back-btn pattern', () => {
    expect(item).toMatch(/class="top-bar"/);
    expect(item).toMatch(/detail-back-btn/);
    expect(css).toMatch(/\.detail-back-btn/);
  });

  test('does not port Cupappen district listing specifics', () => {
    expect(html).not.toMatch(/district-hero/);
    expect(js).not.toMatch(/district-hero/);
    expect(css).not.toMatch(/district-page__/);
  });
});
