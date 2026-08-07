const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('public-clubdesk AppShell patterns', () => {
  const css = read('styles.css');
  const html = read('index.html');
  const js = read('app.js');
  const guide = read('guide.php');
  const priceList = read('price-list.php');
  const router = read('router.php');

  test('header uses fixed --header-h and independent --header-logo-h', () => {
    expect(css).toMatch(/--header-h:\s*4rem/);
    expect(css).toMatch(/--header-logo-h:\s*4\.5rem/);
  });

  test('brand tokens map designer coral/beige intent', () => {
    expect(css).toMatch(/--brand:\s*hsl\(16\s+100%\s+60%\)/);
    expect(css).toMatch(/--bg-page:\s*#f7f1ea/i);
  });

  test('home hub uses 2-column tiles without quick-nav', () => {
    expect(html).toMatch(/Clubdesk/);
    expect(html).not.toMatch(/id="home-hero"/);
    expect(html).not.toMatch(/guider &amp; priser/);
    expect(html).not.toMatch(/id="quick-nav"/);
    expect(html).not.toMatch(/id="hero-band"/);
    expect(html).not.toMatch(/id="shared-filter"/);
    expect(js).not.toMatch(/renderQuickNav/);
    expect(js).toMatch(/renderHomeHub/);
    expect(js).toMatch(/hub-grid/);
    expect(js).toMatch(/data-hub="guides"/);
    expect(js).toMatch(/data-hub="price-lists"/);
    expect(js).toMatch(/site-content-intro|site-content-title/);
    expect(css).toMatch(/\.hub-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
    expect(css).toMatch(/\.hub-grid\s*\{[\s\S]*?padding:\s*0\s+var\(--page-pad\)/);
    expect(css).toMatch(/--section-gap:/);
    expect(css).toMatch(
      /\.site-content-intro\s*\{[\s\S]*?padding:\s*2rem\s+var\(--page-pad\)\s+var\(--section-gap\)/,
    );
    expect(css).toMatch(/\.site-content-title\s*\{[\s\S]*?max-width:\s*28ch/);
    expect(css).toMatch(/\.site-content-html\s*\{[\s\S]*?color:\s*var\(--text-muted\)/);
    expect(css).toMatch(
      /#rows-container\s*>\s*\.hub-grid:first-child\s*\{[\s\S]*?padding-top:\s*2rem/,
    );
    expect(css).toMatch(
      /#rows-container\s*>\s*\.item-grid-section:first-child\s*>\s*\.item-grid-section__header[\s\S]*?padding-top:\s*2rem/,
    );
    expect(css).toMatch(
      /\.item-grid-section__title[\s\S]*?\.price-list-section__title\s*\{[\s\S]*?font-family:\s*var\(--font-display\)/,
    );
    expect(css).toMatch(
      /\.item-grid-section__title[\s\S]*?\.price-list-section__title\s*\{[\s\S]*?font-size:\s*clamp\(0\.925rem,\s*3\.5vw,\s*2\.375rem\)/,
    );
  });

  test('bottom tabs are Hem | Guides | Price list | Info', () => {
    expect(html).toMatch(/data-tab="home"/);
    expect(html).toMatch(/data-tab="guides"/);
    expect(html).toMatch(/data-tab="price-lists"/);
    expect(html).toMatch(/data-tab="info"/);
    expect(html).not.toMatch(/data-tab="all"/);
    expect(html).toMatch(/>Guides</);
    expect(html).toMatch(/>Price list</);
  });

  test('guide detail uses step-swipe and /guide/ paths', () => {
    expect(guide).toMatch(/Clubdesk/);
    expect(guide).toMatch(/\/guide\//);
    expect(guide).toMatch(/step-swipe/);
    expect(guide).toMatch(/step-subheader/);
    expect(router).toMatch(/\/guide/);
  });

  test('price list detail renders rows by category', () => {
    expect(priceList).toMatch(/price-list-row/);
    expect(priceList).toMatch(/formatPriceAmount/);
    expect(priceList).toMatch(/\/price-list\//);
    expect(priceList).toMatch(/class="step-subheader"/);
    expect(priceList).toMatch(/step-subheader__guide/);
    expect(priceList).toMatch(/step-subheader__step/);
    expect(priceList).toMatch(/step-subheader__inner--cart/);
    expect(priceList).toMatch(/data-cart-add/);
    expect(priceList).toMatch(/cart-toggle-btn/);
    expect(priceList).toMatch(/step-nav__btn/);
    expect(priceList).toMatch(/aria-label="Visa varukorg"/);
    expect(priceList).not.toMatch(/step-subheader__bar/);
    expect(priceList).toMatch(/id="cart-view"/);
    expect(priceList).toMatch(/Att betala/);
    expect(priceList).toMatch(/id="cart-swish"/);
    expect(priceList).toMatch(/id="cart-swish-number"/);
    expect(priceList).toMatch(/data-swish-payee/);
    expect(priceList).toMatch(/swishPayload\.js/);
    expect(priceList).toMatch(/qrcode\.bundle\.js/);
    expect(priceList).toMatch(/priceListCart\.js/);
    expect(priceList).toMatch(/price-list-cart-app\.js/);
    expect(priceList).not.toMatch(/detail-hero/);
    expect(priceList).not.toMatch(/featured_image/);
    expect(router).toMatch(/\/price-list/);
    expect(priceList).toMatch(/price-list-row__desc/);
    expect(priceList).toMatch(/price-list-row__main/);
    expect(css).toMatch(/\.price-list-row__desc\s*\{[\s\S]*?white-space:\s*pre-line/);
    expect(css).toMatch(/\.price-list-row__price/);
    expect(css).toMatch(/\.price-list-qty-btn/);
    expect(css).toMatch(/\.cart-total/);
    expect(js).toMatch(/price-list-card/);
    expect(js).not.toMatch(/renderPriceListCard[\s\S]*?itemImageUrl/);
  });

  test('list uses same-origin PHP APIs for guides and price lists', () => {
    expect(js).toMatch(/\/api\/items\.php/);
    expect(js).toMatch(/\/api\/price_lists\.php/);
    expect(js).toMatch(/\/api\/site_content\.php/);
    expect(js).toMatch(/__PUBLIC_APP_SITE_CONTENT__/);
    expect(js).toMatch(/site-content-html/);
    expect(js).not.toMatch(/\/api\/public\/clubdesk/);
    expect(js).toMatch(/\/guide\//);
    expect(js).toMatch(/\/price-list\//);
  });

  test('uses real listing URLs instead of hash routes', () => {
    expect(html).toMatch(/href="\/guides\/"/);
    expect(html).toMatch(/href="\/price-lists\/"/);
    expect(html).toMatch(/href="\/info\/"/);
    expect(html).not.toMatch(/href="#guides"/);
    expect(router).toMatch(/guides|price-lists/);
    expect(router).toMatch(/kategori/);
  });

  test('guides listing keeps category rows and grid', () => {
    expect(js).toMatch(/groupByCategory/);
    expect(js).toMatch(/item-row__scroller/);
    expect(js).toMatch(/class="item-grid"/);
  });
});
