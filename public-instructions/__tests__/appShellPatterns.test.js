const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('public-instructions AppShell patterns', () => {
  const css = read('styles.css');
  const html = read('index.html');
  const js = read('app.js');
  const item = read('instruction.php');
  const router = read('router.php');

  test('header uses fixed --header-h and independent --header-logo-h', () => {
    expect(css).toMatch(/--header-h:\s*4rem/);
    expect(css).toMatch(/--header-logo-h:\s*4\.5rem/);
    expect(css).toMatch(/height:\s*var\(--header-h\)/);
    expect(css).toMatch(/height:\s*var\(--header-logo-h\)/);
  });

  test('brand tokens map designer coral/beige intent', () => {
    expect(css).toMatch(/--brand:\s*hsl\(16\s+100%\s+60%\)/);
    expect(css).toMatch(/--bg-page:\s*#f7f1ea/i);
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

  test('info panel + display font tokens exist; favourites tab removed', () => {
    expect(css).toMatch(/--font-display/);
    expect(css).toMatch(/\.info-panel__title/);
    expect(js).toMatch(/renderInfoListing/);
    expect(html).not.toMatch(/data-tab="favourites"/);
    expect(html).toMatch(/data-tab="info"/);
  });

  test('instruction detail uses step-swipe, subheader, and prev/next without play', () => {
    expect(item).toMatch(/class="top-bar"/);
    expect(item).toMatch(/goToGuideCategory/);
    expect(item).toMatch(/categoryPath/);
    expect(item).toMatch(/\/kategori\//);
    expect(item).toMatch(/Klart, tillbaka till kategorin/);
    expect(item).toMatch(/history\.back/);
    expect(item).toMatch(/step-swipe/);
    expect(item).toMatch(/class="step-subheader"/);
    expect(item).toMatch(/step-subheader__guide/);
    expect(item).toMatch(/step-subheader__step/);
    expect(item).toMatch(/Steg 1 av/);
    expect(item).toMatch(/id="step-prev"/);
    expect(item).toMatch(/id="step-next"/);
    expect(item).toMatch(/aria-label="Föregående steg"/);
    expect(item).toMatch(/aria-label="Nästa steg"/);
    expect(item).toMatch(/goTo/);
    expect(item).toMatch(/data-step-title/);
    expect(item).not.toMatch(/audio-pod/);
    expect(item).not.toMatch(/class="progress-pod"/);
    expect(html).not.toMatch(/audio-pod/);
    expect(js).not.toMatch(/initAudioPodDemo/);
    expect(css).not.toMatch(/\.audio-pod/);
    expect(css).not.toMatch(/\.progress-pod\s*\{/);
    expect(css).toMatch(/\.detail-back-btn/);
    expect(css).toMatch(/\.step-subheader/);
    expect(css).toMatch(/\.step-subheader\s*\{[\s\S]*?position:\s*sticky/);
    expect(css).toMatch(/\.step-subheader__bar/);
    expect(css).toMatch(/\.step-nav__btn--next/);
    expect(css).toMatch(/border-radius:\s*50%/);
  });

  test('list uses same-origin PHP items API', () => {
    expect(js).toMatch(/\/api\/items\.php/);
    expect(js).not.toMatch(/\/api\/public\/instructions/);
    expect(js).toMatch(/\/instruction\//);
  });

  test('uses real listing URLs instead of hash routes', () => {
    expect(html).toMatch(/href="\/alla\/"/);
    expect(html).toMatch(/href="\/info\/"/);
    expect(html).not.toMatch(/href="#all"/);
    expect(html).not.toMatch(/href="#info"/);
    expect(html).toMatch(/listingUrls\.js/);
    expect(js).toMatch(/pathForListing/);
    expect(js).toMatch(/\/kategori\//);
    expect(js).toMatch(/history\.pushState|history\.replaceState/);
    expect(router).toMatch(/kategori/);
    expect(router).toMatch(/alla/);
    expect(item).toMatch(/href="\/alla\/"/);
    expect(item).toMatch(/href="\/info\/"/);
  });

  test('frontpage uses horizontal rows; category page uses card grid without Visa alla', () => {
    expect(js).toMatch(/groupByCategory/);
    expect(js).toMatch(/item-row__scroller/);
    expect(js).toMatch(/scroll-snap-x/);
    expect(js).toMatch(/class="item-grid"/);
    expect(js).toMatch(/item-grid-section/);
    expect(css).toMatch(/\.item-row__scroller\s*\{[\s\S]*?overflow-x:\s*auto/);
    expect(css).toMatch(/\.item-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
    const categoryBranch = js.match(/if \(filter !== 'Alla'\) \{[\s\S]*?\} else \{/);
    expect(categoryBranch?.[0] ?? '').toMatch(/item-grid/);
    expect(categoryBranch?.[0] ?? '').not.toMatch(/Visa alla/);
    expect(categoryBranch?.[0] ?? '').not.toMatch(/item-row__scroller/);
  });

  test('quick-nav and Visa alla use category paths', () => {
    expect(js).toMatch(/Urls\.categoryPath/);
    expect(js).toMatch(/tab: 'category'/);
    expect(js).toMatch(/filter === 'Alla'[\s\S]*?tab: 'all'/);
  });

  test('does not port Cupappen district listing specifics', () => {
    expect(html).not.toMatch(/district-hero/);
    expect(js).not.toMatch(/district-hero/);
    expect(css).not.toMatch(/district-page__/);
  });
});
